// Unit tests for `storeRealLetter`, `findRealDraft` and `findRealLetter`, with no
// Postgres.
//
// `@/lib/db/client` is replaced so `getDb` returns a fake. Its `transaction`
// runs the callback against an in-memory `tx` and restores the rows when the
// callback throws, which is how the rollback tests check that a failed seal
// leaves the draft in place. The fake renders each Drizzle statement with the
// Postgres dialect and answers only the statements `real.ts` issues. It throws
// on any other SQL, so a new query cannot pass silently.
//
// Advisory-lock and `FOR UPDATE` semantics, and the database's own 3-month CHECK,
// are covered by the Postgres integration suite, not here.

import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db/client";
import {
  addCalendarMonthsUtc,
  canonicalize,
  encodeBase64url,
  envelopeHash,
  REAL_LOCK_MONTHS,
} from "@/lib/seal-format";
import { DRAFT_LIFETIME_MS } from "@/lib/seal-format/live-constants";
import { LetterStoreError } from "@/lib/letter-store/store";

import { findRealDraft, findRealLetter, storeRealLetter } from "./real";

vi.mock("@/lib/db/client", () => ({
  getDb: vi.fn(),
}));

/** The database clock the fake returns from `clock_timestamp()`. */
const CLOCK = new Date("2026-11-01T21:00:00.000Z");

/** The earliest opening that the 3-calendar-month rule accepts at CLOCK. */
const EARLIEST = new Date(
  addCalendarMonthsUtc(CLOCK.getTime(), REAL_LOCK_MONTHS),
);

/** A valid 22-character letter ID (16 bytes of 0x01). */
const ID = encodeBase64url(new Uint8Array(16).fill(1));

/** Envelope fields other than the timestamps; the timestamps vary per test. */
const BASE_ENVELOPE = {
  formatVersion: 1,
  letterId: ID,
  opensAt: EARLIEST.toISOString(),
  payloadCiphertext: "REREREREREREREREREREREREREREREREREREREREREQ",
  payloadNonce: "MzMzMzMzMzMzMzMz",
  sealedAt: CLOCK.toISOString(),
  wrappedDeks: [
    {
      factor: "backup",
      nonce: "ERERERERERERERER",
      wrappedKey:
        "IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIi",
    },
  ],
} as const;

/** A real-letter envelope sealed at `sealedAt` and opening at `opensAt`. */
function realEnvelope(opensAt: Date, sealedAt: Date = CLOCK) {
  return {
    ...BASE_ENVELOPE,
    sealedAt: sealedAt.toISOString(),
    opensAt: opensAt.toISOString(),
  };
}

/** The standard valid real letter: sealed at the clock, opening at the earliest allowed time. */
const VALID_ENVELOPE = realEnvelope(EARLIEST);

interface DraftRow {
  id: string;
  serverSecret: Buffer;
  createdAt: Date;
}

interface LetterFakeRow {
  id: string;
  envelope: string;
  envelopeHash: string;
  sealedAt: Date;
  opensAt: Date;
  serverSecret: Buffer;
}

interface FakeOptions {
  drafts?: DraftRow[];
  letters?: LetterFakeRow[];
  /** IDs already present in `demo_letters`. */
  demoIds?: string[];
  /** Make the insert fail with a Postgres unique violation (SQLSTATE 23505). */
  uniqueViolationOnInsert?: boolean;
  /** Make the insert fail with a driver error that carries a secret-looking value. */
  driverErrorOnInsert?: boolean;
}

const dialect = new PgDialect();

/** A draft row for `id` created `ageMs` before the fake clock. */
function draftAged(id: string, ageMs: number): DraftRow {
  return {
    id,
    serverSecret: Buffer.alloc(32, 9),
    createdAt: new Date(CLOCK.getTime() - ageMs),
  };
}

/** Build the fake database. `statements` records every rendered statement. */
function makeFakeDb(seed: FakeOptions = {}) {
  let state = {
    drafts: (seed.drafts ?? []).map((d) => ({ ...d })),
    letters: (seed.letters ?? []).map((l) => ({ ...l })),
    demoIds: [...(seed.demoIds ?? [])],
  };
  const statements: string[] = [];
  let lockCalls = 0;
  let clockReads = 0;

  const exec = async (query: unknown): Promise<unknown[]> => {
    const rendered = dialect.sqlToQuery(
      query as Parameters<typeof dialect.sqlToQuery>[0],
    );
    // Multi-line templates render with leading whitespace; match on the statement start.
    const text = rendered.sql.trimStart();
    const params = rendered.params;
    statements.push(text);

    if (text.includes("pg_advisory_xact_lock")) {
      lockCalls += 1;
      return [];
    }
    if (text.includes("clock_timestamp()")) {
      clockReads += 1;
      return [{ t: CLOCK }];
    }
    if (text.startsWith("SELECT 1 AS present")) {
      const id = params[0] as string;
      const present =
        state.letters.some((l) => l.id === id) || state.demoIds.includes(id);
      return present ? [{ present: 1 }] : [];
    }
    if (text.includes("FOR UPDATE")) {
      const id = params[0] as string;
      return state.drafts
        .filter((d) => d.id === id)
        .map((d) => ({ server_secret: d.serverSecret, created_at: d.createdAt }));
    }
    if (text.startsWith('DELETE FROM "letter_drafts"')) {
      const id = params[0] as string;
      state = { ...state, drafts: state.drafts.filter((d) => d.id !== id) };
      return [];
    }
    if (text.startsWith('INSERT INTO "letters"')) {
      if (seed.driverErrorOnInsert) {
        throw new Error("driver detail: postgres://user:secret@host");
      }
      if (seed.uniqueViolationOnInsert) {
        throw Object.assign(new Error("duplicate key"), { code: "23505" });
      }
      const [id, envelope, envelopeHashValue, sealedAt, opensAt, serverSecret] =
        params as [string, string, string, string, string, Buffer];
      if (state.letters.some((l) => l.id === id)) {
        throw Object.assign(new Error("duplicate key"), { code: "23505" });
      }
      state = {
        ...state,
        letters: [
          ...state.letters,
          {
            id,
            envelope,
            envelopeHash: envelopeHashValue,
            sealedAt: new Date(sealedAt),
            opensAt: new Date(opensAt),
            serverSecret,
          },
        ],
      };
      return [];
    }
    if (text.includes('FROM "letter_drafts"')) {
      const id = params[0] as string;
      return state.drafts
        .filter((d) => d.id === id)
        .map((d) => ({
          id: d.id,
          server_secret: d.serverSecret,
          created_at: d.createdAt,
        }));
    }
    if (text.includes('FROM "letters"')) {
      const id = params[0] as string;
      return state.letters
        .filter((l) => l.id === id)
        .map((l) => ({
          id: l.id,
          envelope: l.envelope,
          envelope_hash: l.envelopeHash,
          sealed_at: l.sealedAt,
          opens_at: l.opensAt,
          server_secret: l.serverSecret,
        }));
    }
    throw new Error(`fake database received unexpected SQL: ${text}`);
  };

  const tx = { execute: exec };

  const db = {
    execute: exec,
    transaction: async (callback: (t: typeof tx) => Promise<unknown>) => {
      const snapshot = state;
      try {
        return await callback(tx);
      } catch (error) {
        state = snapshot;
        throw error;
      }
    },
  };

  return {
    db,
    drafts: () => state.drafts,
    letters: () => state.letters,
    statements: () => statements,
    lockCalls: () => lockCalls,
    clockReads: () => clockReads,
  };
}

/** Build the store arguments for an envelope, with its real hash unless overridden. */
async function submit(envelope: unknown, hash?: string) {
  return {
    envelope,
    envelopeHash: hash ?? (await envelopeHash(envelope)),
  };
}

/** Run `storeRealLetter` and return the error it throws, or null. */
async function errorFrom(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (e: unknown) => e,
  );
}

describe("storeRealLetter", () => {
  let fake: ReturnType<typeof makeFakeDb>;

  function useFake(seed?: FakeOptions) {
    fake = makeFakeDb(seed);
    vi.mocked(getDb).mockReturnValue(fake.db as never);
  }

  beforeEach(() => {
    vi.mocked(getDb).mockReset();
    useFake({ drafts: [draftAged(ID, 1_000)] });
  });

  it("stores the letter in letters and deletes its draft", async () => {
    const result = await storeRealLetter(await submit(VALID_ENVELOPE));

    expect(result.letterId).toBe(ID);
    expect(fake.letters()).toHaveLength(1);
    expect(fake.letters()[0].id).toBe(ID);
    expect(fake.drafts()).toHaveLength(0);
    expect(fake.lockCalls()).toBe(1);
    expect(fake.clockReads()).toBe(1);
  });

  it("stores the canonical envelope with its real hash", async () => {
    const submitted = await submit(VALID_ENVELOPE);
    await storeRealLetter(submitted);

    expect(fake.letters()[0].envelope).toBe(canonicalize(VALID_ENVELOPE));
    expect(fake.letters()[0].envelopeHash).toBe(submitted.envelopeHash);
  });

  it("sets sealed_at from the server clock, not from the header", async () => {
    const envelope = realEnvelope(EARLIEST, new Date("2026-10-01T00:00:00.000Z"));
    const result = await storeRealLetter(await submit(envelope));

    expect(result.sealedAt).toEqual(CLOCK);
    expect(fake.letters()[0].sealedAt).toEqual(CLOCK);
    expect(result.opensAt).toEqual(EARLIEST);
  });

  it("accepts opens_at exactly three calendar months after the clock", async () => {
    await expect(storeRealLetter(await submit(VALID_ENVELOPE))).resolves.toMatchObject({
      opensAt: EARLIEST,
    });
  });

  it("rejects opens_at one millisecond before three calendar months, and keeps the draft", async () => {
    const early = realEnvelope(new Date(EARLIEST.getTime() - 1));

    const error = await errorFrom(storeRealLetter(await submit(early)));

    expect(error).toBeInstanceOf(LetterStoreError);
    expect((error as LetterStoreError).check).toBe("opens_at_too_early");
    expect(fake.letters()).toHaveLength(0);
    expect(fake.drafts()).toHaveLength(1);
  });

  it("rejects an envelope that does not parse, before any database access", async () => {
    const error = await errorFrom(
      storeRealLetter({ envelope: { formatVersion: 99 }, envelopeHash: "0".repeat(64) }),
    );

    expect((error as LetterStoreError).check).toBe("envelope");
    expect(fake.statements()).toHaveLength(0);
  });

  it("rejects a hash that does not match the envelope, before any database access", async () => {
    const error = await errorFrom(
      storeRealLetter(await submit(VALID_ENVELOPE, "0".repeat(64))),
    );

    expect((error as LetterStoreError).check).toBe("hash_mismatch");
    expect(fake.statements()).toHaveLength(0);
    expect(fake.letters()).toHaveLength(0);
  });

  it("rejects with draft_not_found when no draft exists, and stores nothing", async () => {
    useFake({ drafts: [] });

    const error = await errorFrom(storeRealLetter(await submit(VALID_ENVELOPE)));

    expect((error as LetterStoreError).check).toBe("draft_not_found");
    expect(fake.letters()).toHaveLength(0);
  });

  it("rejects an expired draft with draft_not_found and keeps it", async () => {
    useFake({ drafts: [draftAged(ID, DRAFT_LIFETIME_MS + 1_000)] });

    const error = await errorFrom(storeRealLetter(await submit(VALID_ENVELOPE)));

    expect((error as LetterStoreError).check).toBe("draft_not_found");
    expect(fake.letters()).toHaveLength(0);
    expect(fake.drafts()).toHaveLength(1);
  });

  it("rejects with duplicate_id when a real letter already has the ID", async () => {
    useFake({
      drafts: [draftAged(ID, 1_000)],
      letters: [
        {
          id: ID,
          envelope: "{}",
          envelopeHash: "0".repeat(64),
          sealedAt: CLOCK,
          opensAt: EARLIEST,
          serverSecret: Buffer.alloc(32, 1),
        },
      ],
    });

    const error = await errorFrom(storeRealLetter(await submit(VALID_ENVELOPE)));

    expect((error as LetterStoreError).check).toBe("duplicate_id");
    expect(fake.letters()).toHaveLength(1);
    expect(fake.drafts()).toHaveLength(1);
  });

  it("rejects with duplicate_id when a demo letter already has the ID", async () => {
    useFake({ drafts: [draftAged(ID, 1_000)], demoIds: [ID] });

    const error = await errorFrom(storeRealLetter(await submit(VALID_ENVELOPE)));

    expect((error as LetterStoreError).check).toBe("duplicate_id");
    expect(fake.letters()).toHaveLength(0);
    expect(fake.drafts()).toHaveLength(1);
  });

  it("maps a unique violation on insert to duplicate_id and keeps the draft", async () => {
    useFake({ drafts: [draftAged(ID, 1_000)], uniqueViolationOnInsert: true });

    const error = await errorFrom(storeRealLetter(await submit(VALID_ENVELOPE)));

    expect((error as LetterStoreError).check).toBe("duplicate_id");
    expect(fake.drafts()).toHaveLength(1);
  });

  it("replaces a driver error with a value-free error, never chained, and keeps the draft", async () => {
    useFake({ drafts: [draftAged(ID, 1_000)], driverErrorOnInsert: true });

    const error = await errorFrom(storeRealLetter(await submit(VALID_ENVELOPE)));

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(LetterStoreError);
    expect((error as Error).message).toBe("The letter could not be stored.");
    expect((error as Error).message).not.toContain("secret");
    expect((error as Error & { cause?: unknown }).cause).toBeUndefined();
    expect(fake.drafts()).toHaveLength(1);
  });

  it("never writes to a demo table", async () => {
    await storeRealLetter(await submit(VALID_ENVELOPE));

    const writes = fake
      .statements()
      .filter((s) => s.startsWith("INSERT") || s.startsWith("DELETE"));
    expect(writes.length).toBeGreaterThan(0);
    for (const s of writes) {
      expect(s).not.toContain("demo_");
    }
  });
});

describe("findRealDraft", () => {
  beforeEach(() => {
    vi.mocked(getDb).mockReset();
  });

  it("returns null when no draft has the ID", async () => {
    const fake = makeFakeDb({});
    vi.mocked(getDb).mockReturnValue(fake.db as never);

    await expect(findRealDraft(ID)).resolves.toBeNull();
  });

  it("returns the draft row with its secret and creation time", async () => {
    const fake = makeFakeDb({ drafts: [draftAged(ID, 1_000)] });
    vi.mocked(getDb).mockReturnValue(fake.db as never);

    const row = await findRealDraft(ID);

    expect(row).not.toBeNull();
    expect(row?.id).toBe(ID);
    expect(row?.createdAt).toEqual(new Date(CLOCK.getTime() - 1_000));
    expect(Buffer.isBuffer(row?.serverSecret)).toBe(true);
    expect(row?.serverSecret).toHaveLength(32);
  });

  it("replaces a driver error with a value-free error", async () => {
    vi.mocked(getDb).mockReturnValue({
      execute: async () => {
        throw new Error("connection to postgres://user:secret@host failed");
      },
    } as never);

    const error = await errorFrom(findRealDraft(ID));

    expect((error as Error).message).toBe("The draft could not be read.");
    expect((error as Error).message).not.toContain("secret");
  });
});

describe("findRealLetter", () => {
  beforeEach(() => {
    vi.mocked(getDb).mockReset();
  });

  it("returns null when no real letter has the ID", async () => {
    const fake = makeFakeDb({});
    vi.mocked(getDb).mockReturnValue(fake.db as never);

    await expect(findRealLetter(ID)).resolves.toBeNull();
  });

  it("returns the stored letter with its timestamps and secret", async () => {
    const fake = makeFakeDb({
      letters: [
        {
          id: ID,
          envelope: canonicalize(VALID_ENVELOPE),
          envelopeHash: "a".repeat(64),
          sealedAt: CLOCK,
          opensAt: EARLIEST,
          serverSecret: Buffer.alloc(32, 2),
        },
      ],
    });
    vi.mocked(getDb).mockReturnValue(fake.db as never);

    const row = await findRealLetter(ID);

    expect(row).toMatchObject({
      id: ID,
      envelope: canonicalize(VALID_ENVELOPE),
      envelopeHash: "a".repeat(64),
      sealedAt: CLOCK,
      opensAt: EARLIEST,
    });
    expect(row?.serverSecret).toHaveLength(32);
  });

  it("replaces a driver error with a value-free error", async () => {
    vi.mocked(getDb).mockReturnValue({
      execute: async () => {
        throw new Error("connection to postgres://user:secret@host failed");
      },
    } as never);

    const error = await errorFrom(findRealLetter(ID));

    expect((error as Error).message).toBe("The letter could not be read.");
    expect((error as Error).message).not.toContain("secret");
  });
});
