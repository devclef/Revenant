// Unit tests for `createDraft`, with no Postgres.
//
// `@/lib/db/client` is replaced so `getDb` returns a fake whose `transaction`
// runs the callback against an in-memory `tx`. The fake renders each Drizzle
// statement with the Postgres dialect and answers it from a list of draft rows.
// It understands only the statements `createDraft` issues, and throws on any
// other SQL, so a new query cannot pass silently.
//
// The real SQL semantics (advisory locks, `clock_timestamp()`) are not
// exercised here. They are covered by the Postgres integration suite.

import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db/client";
import { encodeBase64url, isLetterId } from "@/lib/seal-format/base64url";
import { DRAFT_LIFETIME_MS } from "@/lib/seal-format/live-constants";
import { DRAFT_CAP, PREPARE_ID_ATTEMPTS } from "@/lib/letter-store/live-constants";
import { LetterStoreError } from "@/lib/letter-store/store";

import { createDraft } from "./drafts";

vi.mock("@/lib/db/client", () => ({
  getDb: vi.fn(),
}));

interface FakeDraft {
  id: string;
  serverSecret: Buffer;
  createdAt: Date;
}

/** The database clock the fake returns from `clock_timestamp()`. */
const CLOCK = new Date("2026-11-01T21:00:00.000Z");

const dialect = new PgDialect();

/**
 * Build a fake database. `drafts` is the mutable table; `taken` holds IDs that
 * already exist in `demo_letters` or `letters`. `clockReads` and `lockCalls`
 * count the statements that must run exactly once per transaction.
 */
function makeFakeDb(seed: { drafts?: FakeDraft[]; taken?: string[] } = {}) {
  const drafts: FakeDraft[] = [...(seed.drafts ?? [])];
  const taken = new Set(seed.taken ?? []);
  let clockReads = 0;
  let lockCalls = 0;

  const tx = {
    execute: async (query: unknown): Promise<unknown[]> => {
      const rendered = dialect.sqlToQuery(
        query as Parameters<typeof dialect.sqlToQuery>[0],
      );
      // Multi-line templates render with leading whitespace; match on the statement start.
      const text = rendered.sql.trimStart();
      const params = rendered.params;

      if (text.includes("pg_advisory_xact_lock")) {
        lockCalls += 1;
        return [];
      }
      if (text.includes("clock_timestamp()")) {
        clockReads += 1;
        return [{ t: CLOCK }];
      }
      if (text.startsWith("DELETE FROM")) {
        const cutoff = params[0] as Date;
        for (let i = drafts.length - 1; i >= 0; i--) {
          if (drafts[i].createdAt.getTime() < cutoff.getTime()) {
            drafts.splice(i, 1);
          }
        }
        return [];
      }
      if (text.includes("count(*)")) {
        return [{ n: drafts.length }];
      }
      if (text.includes("SELECT 1 AS present")) {
        const id = params[0] as string;
        const used = drafts.some((d) => d.id === id) || taken.has(id);
        return used ? [{ present: 1 }] : [];
      }
      if (text.startsWith("INSERT INTO")) {
        drafts.push({
          id: params[0] as string,
          serverSecret: params[1] as Buffer,
          createdAt: params[2] as Date,
        });
        return [];
      }
      throw new Error(`fake database received unexpected SQL: ${text}`);
    },
  };

  const db = {
    transaction: async (callback: (t: typeof tx) => Promise<unknown>) =>
      callback(tx),
  };

  return {
    db,
    drafts,
    clockReads: () => clockReads,
    lockCalls: () => lockCalls,
  };
}

/** A random-byte source that returns queued 16-byte IDs and a fixed 32-byte secret. */
function scriptedRandom(idBytes: Uint8Array[]) {
  const queue = [...idBytes];
  const calls: number[] = [];
  const fn = (n: number): Uint8Array => {
    calls.push(n);
    if (n === 16) {
      const next = queue.shift();
      if (!next) {
        throw new Error("scripted random ran out of ID bytes");
      }
      return next;
    }
    return new Uint8Array(n).fill(7);
  };
  return { fn, calls };
}

const ZEROS = new Uint8Array(16);
const ONES = new Uint8Array(16).fill(1);

/** A draft created `ageMs` before the fake clock. */
function draftAged(id: string, ageMs: number): FakeDraft {
  return {
    id,
    serverSecret: Buffer.alloc(32, 9),
    createdAt: new Date(CLOCK.getTime() - ageMs),
  };
}

/** Build `count` fresh drafts with distinct IDs, each one second old. */
function freshDrafts(count: number, prefix: string): FakeDraft[] {
  return Array.from({ length: count }, (_, i) =>
    draftAged(`${prefix}${String(i).padStart(6, "0")}`, 1_000),
  );
}

describe("createDraft", () => {
  let fake: ReturnType<typeof makeFakeDb>;

  function useFake(seed?: Parameters<typeof makeFakeDb>[0]) {
    fake = makeFakeDb(seed);
    vi.mocked(getDb).mockReturnValue(fake.db as never);
  }

  beforeEach(() => {
    vi.mocked(getDb).mockReset();
    useFake();
  });

  it("takes the advisory lock once and reads the clock once", async () => {
    await createDraft(scriptedRandom([ONES]).fn);

    expect(fake.lockCalls()).toBe(1);
    expect(fake.clockReads()).toBe(1);
  });

  it("returns an ID in the letter-ID format, the clock time, and a 32-byte secret", async () => {
    const draft = await createDraft(scriptedRandom([ONES]).fn);

    expect(draft.letterId).toBe(encodeBase64url(ONES));
    expect(isLetterId(draft.letterId)).toBe(true);
    expect(draft.serverNow).toEqual(CLOCK);
    expect(draft.serverSecret).toHaveLength(32);
  });

  it("writes the draft with created_at set to the clock read", async () => {
    const draft = await createDraft(scriptedRandom([ONES]).fn);

    expect(fake.drafts).toHaveLength(1);
    expect(fake.drafts[0].id).toBe(draft.letterId);
    expect(fake.drafts[0].createdAt).toEqual(CLOCK);
    expect(Buffer.from(draft.serverSecret).equals(fake.drafts[0].serverSecret)).toBe(true);
  });

  describe("draft cap", () => {
    it("accepts a new draft when exactly DRAFT_CAP drafts exist", async () => {
      useFake({ drafts: freshDrafts(DRAFT_CAP, "fresh") });

      await expect(createDraft(scriptedRandom([ONES]).fn)).resolves.toMatchObject({
        letterId: encodeBase64url(ONES),
      });
      expect(fake.drafts).toHaveLength(DRAFT_CAP + 1);
    });

    it("rejects with busy when DRAFT_CAP + 1 drafts exist", async () => {
      useFake({ drafts: freshDrafts(DRAFT_CAP + 1, "fresh") });

      const error = await createDraft(scriptedRandom([ONES]).fn).then(
        () => null,
        (e: unknown) => e,
      );
      expect(error).toBeInstanceOf(LetterStoreError);
      expect((error as LetterStoreError).check).toBe("busy");
      expect(fake.drafts).toHaveLength(DRAFT_CAP + 1);
    });
  });

  describe("expired drafts", () => {
    it("does not count drafts older than DRAFT_LIFETIME_MS toward the cap", async () => {
      const expired = Array.from({ length: 5 }, (_, i) =>
        draftAged(`expired${String(i).padStart(4, "0")}`, DRAFT_LIFETIME_MS + 1_000),
      );
      useFake({ drafts: [...freshDrafts(DRAFT_CAP, "fresh"), ...expired] });

      await expect(createDraft(scriptedRandom([ONES]).fn)).resolves.toBeDefined();
    });

    it("deletes expired drafts and keeps fresh ones", async () => {
      const expiredId = "expiredaaaaaaaaaaaaaa";
      const freshId = "freshaaaaaaaaaaaaaaaa";
      useFake({
        drafts: [
          draftAged(expiredId, DRAFT_LIFETIME_MS + 1_000),
          draftAged(freshId, 1_000),
        ],
      });

      const draft = await createDraft(scriptedRandom([ONES]).fn);

      const ids = fake.drafts.map((d) => d.id);
      expect(ids).not.toContain(expiredId);
      expect(ids).toContain(freshId);
      expect(ids).toContain(draft.letterId);
      expect(ids).toHaveLength(2);
    });
  });

  describe("ID collisions", () => {
    it("retries with a new ID when the first one is already a draft", async () => {
      useFake({ drafts: [draftAged(encodeBase64url(ZEROS), 1_000)] });
      const random = scriptedRandom([ZEROS, ONES]);

      const draft = await createDraft(random.fn);

      expect(draft.letterId).toBe(encodeBase64url(ONES));
      expect(random.calls).toEqual([16, 16, 32]);
    });

    it("retries when the first ID is already a demo or real letter", async () => {
      useFake({ taken: [encodeBase64url(ZEROS)] });
      const random = scriptedRandom([ZEROS, ONES]);

      const draft = await createDraft(random.fn);

      expect(draft.letterId).toBe(encodeBase64url(ONES));
      expect(random.calls).toEqual([16, 16, 32]);
    });

    it("throws a value-free error after PREPARE_ID_ATTEMPTS collisions and inserts nothing", async () => {
      useFake({ taken: [encodeBase64url(ZEROS)] });
      const random = scriptedRandom(Array.from({ length: PREPARE_ID_ATTEMPTS }, () => ZEROS));

      const error = await createDraft(random.fn).then(
        () => null,
        (e: unknown) => e,
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(LetterStoreError);
      expect((error as Error).message).toBe("The draft could not be created.");
      expect(random.calls.filter((n) => n === 16)).toHaveLength(PREPARE_ID_ATTEMPTS);
      expect(random.calls).not.toContain(32);
      expect(fake.drafts).toHaveLength(0);
    });
  });

  it("replaces driver errors with a value-free error", async () => {
    const failing = {
      transaction: async () => {
        throw new Error("connection to postgres://user:secret@host failed");
      },
    };
    vi.mocked(getDb).mockReturnValue(failing as never);

    const error = await createDraft(scriptedRandom([ONES]).fn).then(
      () => null,
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("The draft could not be created.");
    expect((error as Error).message).not.toContain("secret");
    expect((error as Error & { cause?: unknown }).cause).toBeUndefined();
  });
});
