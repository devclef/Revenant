// Unit tests for `storeLiveLetter`, with no Postgres.
//
// `@/lib/db/client` is replaced so `getDb` returns a fake whose `transaction`
// runs the callback against an in-memory `tx`. The fake renders each Drizzle
// statement with the Postgres dialect and answers it from in-memory rows. It
// understands only the statements `storeLiveLetter` issues and throws on any
// other SQL, so a new query cannot pass silently.
//
// The transaction fake restores its rows when the callback throws. That is how
// the rollback tests check that a failed seal leaves the Draft in place. The
// real advisory-lock and `FOR UPDATE` semantics are covered by the Postgres
// integration suite, not here.

import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db/client";
import { canonicalize, envelopeHash } from "@/lib/seal-format";
import { encodeBase64url } from "@/lib/seal-format/base64url";
import {
  DRAFT_LIFETIME_MS,
  LOCK_DURATION_MS,
  LOCK_MAX_AHEAD_MS,
} from "@/lib/seal-format/live-constants";
import {
  LIVE_KIND,
  LIVE_SEAL_CAP,
  LIVE_SEAL_WINDOW_MS,
  SEAL_LOCK_KEY,
} from "@/lib/letter-store/live-constants";

import { LetterStoreError, storeLiveLetter } from "./store";

vi.mock("@/lib/db/client", () => ({
  getDb: vi.fn(),
}));

/** The database clock the fake returns from `clock_timestamp()`. */
const CLOCK = new Date("2026-11-01T21:00:00.000Z");

/** A valid 22-character letter ID (16 bytes of 0x01). */
const ID = encodeBase64url(new Uint8Array(16).fill(1));

/** The envelope base from the sealed-letter tests; only the timestamps vary here. */
const BASE_ENVELOPE = {
  formatVersion: 1,
  letterId: ID,
  opensAt: "2026-11-01T21:00:30.000Z",
  payloadCiphertext: "REREREREREREREREREREREREREREREREREREREREREQ",
  payloadNonce: "MzMzMzMzMzMzMzMz",
  sealedAt: "2026-11-01T21:00:00.000Z",
  wrappedDeks: [
    {
      factor: "backup",
      nonce: "ERERERERERERERER",
      wrappedKey:
        "IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIi",
    },
  ],
} as const;

/** A valid Live_Letter envelope sealed at `sealedAt` and opening at `opensAt`. */
function liveEnvelope(sealedAt: Date, opensAt: Date) {
  return {
    ...BASE_ENVELOPE,
    sealedAt: sealedAt.toISOString(),
    opensAt: opensAt.toISOString(),
  };
}

/** The standard valid Live_Letter: sealed at the clock, opening 30 seconds later. */
const VALID_ENVELOPE = liveEnvelope(
  CLOCK,
  new Date(CLOCK.getTime() + LOCK_DURATION_MS),
);

interface FakeDraft {
  id: string;
  serverSecret: Buffer;
  createdAt: Date;
}

interface FakeDemoRow {
  id: string;
  kind: string;
  sealedAt: Date;
  opensAt?: Date;
  envelope?: string;
  envelopeHash?: string;
  serverSecret?: Buffer;
}

interface FakeOptions {
  drafts?: FakeDraft[];
  /** IDs already present in `letters`. */
  letterIds?: string[];
  /** Rows already present in `demo_letters`. */
  demoRows?: FakeDemoRow[];
  /** Make the existence check report no collision, so only the insert can catch one. */
  hideExistence?: boolean;
  /** Make the insert fail with a driver error that carries a secret-looking value. */
  failInsert?: boolean;
}

const dialect = new PgDialect();

/**
 * Build the fake database. `statements` records every rendered statement so a
 * test can check the order: lock, clock, Draft lock, then the rest.
 */
function makeFakeDb(seed: FakeOptions = {}) {
  let drafts: FakeDraft[] = [...(seed.drafts ?? [])];
  const letterIds = new Set(seed.letterIds ?? []);
  let demo: FakeDemoRow[] = [...(seed.demoRows ?? [])];
  const statements: string[] = [];
  const lockKeys: unknown[] = [];
  let clockReads = 0;

  const tx = {
    execute: async (query: unknown): Promise<unknown[]> => {
      const rendered = dialect.sqlToQuery(
        query as Parameters<typeof dialect.sqlToQuery>[0],
      );
      const text = rendered.sql.trimStart();
      const params = rendered.params;
      statements.push(text);

      if (text.includes("pg_advisory_xact_lock")) {
        lockKeys.push(params[0]);
        return [];
      }
      if (text.includes("clock_timestamp()")) {
        clockReads += 1;
        return [{ t: CLOCK }];
      }
      if (text.includes("FOR UPDATE")) {
        const id = params[0] as string;
        return drafts
          .filter((d) => d.id === id)
          .map((d) => ({ server_secret: d.serverSecret, created_at: d.createdAt }));
      }
      if (text.startsWith("SELECT 1 AS present")) {
        if (seed.hideExistence) {
          return [];
        }
        const id = params[0] as string;
        const taken = letterIds.has(id) || demo.some((r) => r.id === id);
        return taken ? [{ present: 1 }] : [];
      }
      if (text.includes("count(*)")) {
        const kind = params[0] as string;
        const cutoff = params[1] as Date;
        const n = demo.filter(
          (r) => r.kind === kind && r.sealedAt.getTime() > cutoff.getTime(),
        ).length;
        return [{ n }];
      }
      if (text.startsWith('INSERT INTO "demo_letters"')) {
        if (seed.failInsert) {
          throw new Error("driver failure: postgres://user:secret@host");
        }
        const id = params[0] as string;
        if (demo.some((r) => r.id === id)) {
          throw Object.assign(new Error("duplicate key value"), {
            code: "23505",
            detail: `Key (id)=(${id}) already exists.`,
          });
        }
        demo.push({
          id,
          kind: params[1] as string,
          envelope: params[2] as string,
          envelopeHash: params[3] as string,
          sealedAt: params[4] as Date,
          opensAt: params[5] as Date,
          serverSecret: params[6] as Buffer,
        });
        return [];
      }
      if (text.startsWith("DELETE FROM")) {
        const id = params[0] as string;
        drafts = drafts.filter((d) => d.id !== id);
        return [];
      }
      throw new Error(`fake database received unexpected SQL: ${text}`);
    },
  };

  const db = {
    transaction: async (callback: (t: typeof tx) => Promise<unknown>) => {
      // Roll back the rows when the callback throws, as Postgres does.
      const snapshotDrafts = drafts.map((d) => ({ ...d }));
      const snapshotDemo = demo.map((r) => ({ ...r }));
      try {
        return await callback(tx);
      } catch (error) {
        drafts = snapshotDrafts;
        demo = snapshotDemo;
        throw error;
      }
    },
  };

  return {
    db,
    drafts: () => drafts,
    demo: () => demo,
    statements: () => statements,
    lockKeys: () => lockKeys,
    clockReads: () => clockReads,
  };
}

/** A draft created `ageMs` before the fake clock. */
function draftAged(id: string, ageMs: number): FakeDraft {
  return {
    id,
    serverSecret: Buffer.alloc(32, 9),
    createdAt: new Date(CLOCK.getTime() - ageMs),
  };
}

/** Live rows sealed `ageMs` before the clock, each with a distinct ID. */
function liveRows(count: number, ageMs: number, kind = LIVE_KIND): FakeDemoRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `row${String(i).padStart(17, "0")}AQ`,
    kind,
    sealedAt: new Date(CLOCK.getTime() - ageMs),
  }));
}

/** Submit an envelope with its correct hash and return the thrown error, or null. */
async function sealError(envelope: unknown): Promise<unknown> {
  return storeLiveLetter({
    envelope,
    envelopeHash: await envelopeHash(envelope),
  }).then(
    () => null,
    (e: unknown) => e,
  );
}

describe("storeLiveLetter", () => {
  let fake: ReturnType<typeof makeFakeDb>;

  function useFake(seed: FakeOptions = {}) {
    fake = makeFakeDb({
      drafts: [draftAged(ID, 1_000)],
      ...seed,
    });
    vi.mocked(getDb).mockReturnValue(fake.db as never);
  }

  beforeEach(() => {
    vi.mocked(getDb).mockReset();
    useFake();
  });

  describe("success", () => {
    it("stores a live row, consumes the Draft and returns the header times", async () => {
      const result = await storeLiveLetter({
        envelope: VALID_ENVELOPE,
        envelopeHash: await envelopeHash(VALID_ENVELOPE),
      });

      expect(result).toEqual({
        letterId: ID,
        sealedAt: new Date(VALID_ENVELOPE.sealedAt),
        opensAt: new Date(VALID_ENVELOPE.opensAt),
      });

      const row = fake.demo().find((r) => r.id === ID);
      expect(row?.kind).toBe("live");
      expect(row?.envelope).toBe(canonicalize(VALID_ENVELOPE));
      expect(row?.envelopeHash).toBe(await envelopeHash(VALID_ENVELOPE));
      expect(row?.serverSecret?.equals(Buffer.alloc(32, 9))).toBe(true);
      expect(fake.drafts()).toHaveLength(0);
    });

    it("takes the seal advisory lock first, reads the clock once, then locks the Draft", async () => {
      await storeLiveLetter({
        envelope: VALID_ENVELOPE,
        envelopeHash: await envelopeHash(VALID_ENVELOPE),
      });

      expect(fake.lockKeys()).toEqual([SEAL_LOCK_KEY]);
      expect(fake.clockReads()).toBe(1);
      const draftLock = fake
        .statements()
        .findIndex((s) => s.includes("FOR UPDATE"));
      expect(fake.statements()[0]).toContain("pg_advisory_xact_lock");
      expect(draftLock).toBeGreaterThan(0);
    });
  });

  describe("envelope and hash checks run before any database access", () => {
    it("rejects an envelope that does not parse with check envelope", async () => {
      const error = await sealError({ not: "an envelope" });

      expect(error).toBeInstanceOf(LetterStoreError);
      expect((error as LetterStoreError).check).toBe("envelope");
      expect(getDb).not.toHaveBeenCalled();
    });

    it("rejects a hash that does not match the envelope with check hash_mismatch", async () => {
      const error = await storeLiveLetter({
        envelope: VALID_ENVELOPE,
        envelopeHash: "0".repeat(64),
      }).then(
        () => null,
        (e: unknown) => e,
      );

      expect(error).toBeInstanceOf(LetterStoreError);
      expect((error as LetterStoreError).check).toBe("hash_mismatch");
      expect(getDb).not.toHaveBeenCalled();
    });
  });

  describe("draft_not_found", () => {
    it("throws when no Draft exists for the letter ID, and stores nothing", async () => {
      useFake({ drafts: [] });

      const error = await sealError(VALID_ENVELOPE);

      expect((error as LetterStoreError).check).toBe("draft_not_found");
      expect(fake.demo()).toHaveLength(0);
    });

    it("treats a Draft exactly DRAFT_LIFETIME_MS old as stale", async () => {
      useFake({ drafts: [draftAged(ID, DRAFT_LIFETIME_MS)] });

      const error = await sealError(VALID_ENVELOPE);

      expect((error as LetterStoreError).check).toBe("draft_not_found");
      expect(fake.drafts()).toHaveLength(1);
    });

    it("treats a Draft created after the server clock as not fresh", async () => {
      useFake({
        drafts: [
          {
            id: ID,
            serverSecret: Buffer.alloc(32, 9),
            createdAt: new Date(CLOCK.getTime() + 1_000),
          },
        ],
      });

      const error = await sealError(VALID_ENVELOPE);

      expect((error as LetterStoreError).check).toBe("draft_not_found");
    });

    it("gives a fixed message that does not carry the letter ID", async () => {
      useFake({ drafts: [] });

      const error = (await sealError(VALID_ENVELOPE)) as LetterStoreError;

      expect(error.message).toBe("No fresh draft exists for this letter.");
      expect(error.message).not.toContain(ID);
    });
  });

  describe("duplicate_id", () => {
    it("rejects an ID already present in letters, keeps the Draft and inserts nothing", async () => {
      useFake({ letterIds: [ID] });

      const error = await sealError(VALID_ENVELOPE);

      expect((error as LetterStoreError).check).toBe("duplicate_id");
      expect(fake.demo()).toHaveLength(0);
      expect(fake.drafts()).toHaveLength(1);
    });

    it("rejects an ID already present in demo_letters", async () => {
      useFake({ demoRows: [{ id: ID, kind: "persona", sealedAt: CLOCK }] });

      const error = await sealError(VALID_ENVELOPE);

      expect((error as LetterStoreError).check).toBe("duplicate_id");
      expect(fake.drafts()).toHaveLength(1);
    });

    it("maps a unique-key violation on insert to duplicate_id and keeps the Draft", async () => {
      // The existence check misses the collision, so only the primary key catches it.
      useFake({
        hideExistence: true,
        demoRows: [{ id: ID, kind: "persona", sealedAt: CLOCK }],
      });

      const error = await sealError(VALID_ENVELOPE);

      expect((error as LetterStoreError).check).toBe("duplicate_id");
      expect(error).not.toHaveProperty("cause");
      expect(fake.drafts()).toHaveLength(1);
      expect(fake.demo()).toHaveLength(1);
    });
  });

  describe("busy and the exact LIVE_SEAL_CAP boundary", () => {
    it("rejects with busy when LIVE_SEAL_CAP + 1 live rows fall inside the window", async () => {
      useFake({ demoRows: liveRows(LIVE_SEAL_CAP + 1, 1_000) });

      const error = await sealError(VALID_ENVELOPE);

      expect((error as LetterStoreError).check).toBe("busy");
      expect(fake.drafts()).toHaveLength(1);
      expect(fake.demo()).toHaveLength(LIVE_SEAL_CAP + 1);
    });

    it("accepts when exactly LIVE_SEAL_CAP live rows fall inside the window", async () => {
      useFake({ demoRows: liveRows(LIVE_SEAL_CAP, 1_000) });

      await expect(
        storeLiveLetter({
          envelope: VALID_ENVELOPE,
          envelopeHash: await envelopeHash(VALID_ENVELOPE),
        }),
      ).resolves.toMatchObject({ letterId: ID });
      expect(fake.demo()).toHaveLength(LIVE_SEAL_CAP + 1);
    });

    it("does not count live rows sealed exactly LIVE_SEAL_WINDOW_MS ago", async () => {
      useFake({ demoRows: liveRows(LIVE_SEAL_CAP + 1, LIVE_SEAL_WINDOW_MS) });

      await expect(
        storeLiveLetter({
          envelope: VALID_ENVELOPE,
          envelopeHash: await envelopeHash(VALID_ENVELOPE),
        }),
      ).resolves.toMatchObject({ letterId: ID });
    });

    it("does not count persona rows toward the live cap", async () => {
      useFake({ demoRows: liveRows(LIVE_SEAL_CAP + 1, 1_000, "persona") });

      await expect(
        storeLiveLetter({
          envelope: VALID_ENVELOPE,
          envelopeHash: await envelopeHash(VALID_ENVELOPE),
        }),
      ).resolves.toMatchObject({ letterId: ID });
    });
  });

  describe("lock_out_of_range", () => {
    it("rejects a lock whose gap is not exactly LOCK_DURATION_MS", async () => {
      const envelope = liveEnvelope(
        CLOCK,
        new Date(CLOCK.getTime() + LOCK_DURATION_MS + 1_000),
      );

      const error = await sealError(envelope);

      expect((error as LetterStoreError).check).toBe("lock_out_of_range");
      expect(fake.drafts()).toHaveLength(1);
      expect(fake.demo()).toHaveLength(0);
    });

    it("rejects an opensAt that is not after the server clock", async () => {
      const sealed = new Date(CLOCK.getTime() - LOCK_DURATION_MS);
      const envelope = liveEnvelope(sealed, new Date(sealed.getTime() + LOCK_DURATION_MS));

      const error = await sealError(envelope);

      expect((error as LetterStoreError).check).toBe("lock_out_of_range");
    });

    it("rejects an opensAt more than LOCK_MAX_AHEAD_MS after the server clock", async () => {
      const sealed = new Date(CLOCK.getTime() + LOCK_MAX_AHEAD_MS);
      const envelope = liveEnvelope(sealed, new Date(sealed.getTime() + LOCK_DURATION_MS));

      const error = await sealError(envelope);

      expect((error as LetterStoreError).check).toBe("lock_out_of_range");
    });

    it("gives a fixed message that carries no timestamp or ID", async () => {
      const envelope = liveEnvelope(CLOCK, new Date(CLOCK.getTime() + 90_000));

      const error = (await sealError(envelope)) as LetterStoreError;

      expect(error.message).toBe(
        "The lock must open 30 seconds after sealing, within the allowed window.",
      );
      expect(error.message).not.toContain(ID);
    });
  });

  describe("rollback", () => {
    it("rolls back on a driver error, keeps the Draft and maps to a value-free error", async () => {
      useFake({ failInsert: true });

      const error = await sealError(VALID_ENVELOPE);

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(LetterStoreError);
      expect((error as Error).message).toBe("The letter could not be stored.");
      expect((error as Error).message).not.toContain("secret");
      expect((error as Error & { cause?: unknown }).cause).toBeUndefined();
      expect(fake.drafts()).toHaveLength(1);
      expect(fake.demo()).toHaveLength(0);
    });

    it("keeps the Draft when a lock check fails after the Draft was read", async () => {
      const envelope = liveEnvelope(CLOCK, new Date(CLOCK.getTime() + 90_000));

      await sealError(envelope);

      expect(fake.drafts()).toHaveLength(1);
      expect(fake.drafts()[0].id).toBe(ID);
    });
  });
});
