// Unit tests for the server-only `findLetter` / `insertOpening` queries, with
// the database fully mocked.
//
// These tests run with no Postgres: `@/lib/db/client` is replaced so `getDb`
// returns a spy. They pin the invariants the routes rely on:
//   - `findLetter` issues ONE parameterised statement that reads `now()`
//     alongside the row, binds `id` as a parameter (never interpolated), maps
//     `demo` from the source table, and returns `null` on an empty result
//     (R6.4, R8.4).
//   - `insertOpening` writes `letter_id` XOR `demo_letter_id` by `demo`, leaves
//     `opened_at` to the DB default, and returns the DB `opened_at` / id
//     (R4.9, R7.4).
//
// The real-Postgres behaviour (the integration suite) is task 5, out of scope
// here; the point of mocking is to assert the SHAPE of the statements without a
// database.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";

// --- Mock the database client ------------------------------------------------
//
// `getDb` returns an object whose `execute` and `insert` are spies. `execute`
// records the single `SQL` statement `findLetter` builds; `insert` returns a
// chainable `values().returning()` stub that records the inserted row and
// yields a fixed RETURNING result.

const executeSpy =
  vi.fn<(statement: SQL) => Promise<Record<string, unknown>[]>>();

let insertedValues: Record<string, unknown> | undefined;
let returningResult: Record<string, unknown>[] = [];

const returningSpy = vi.fn(() => Promise.resolve(returningResult));
const valuesSpy = vi.fn((row: Record<string, unknown>) => {
  insertedValues = row;
  return { returning: returningSpy };
});
const insertSpy = vi.fn(() => ({ values: valuesSpy }));

vi.mock("@/lib/db/client", () => ({
  getDb: vi.fn(() => ({
    execute: executeSpy,
    insert: insertSpy,
  })),
}));

// Import after the mock is registered. The module is server-only, but the
// `typeof window` guard is a no-op under the `node` test environment.
import { findLetter, insertOpening } from "./queries";
import { getDb } from "@/lib/db/client";

/**
 * Collect the literal SQL chunks of a drizzle `SQL` object. Drizzle keeps
 * static SQL as `StringChunk` objects and bound values as `Param` objects in
 * `.queryChunks`, so flattening the string chunks gives the statement text with
 * NO interpolated values, and counting the non-string chunks tells us how many
 * bound parameters it carries.
 */
function inspectSql(statement: SQL): { text: string; paramCount: number } {
  const chunks = (statement as unknown as { queryChunks: unknown[] })
    .queryChunks;
  let text = "";
  let paramCount = 0;
  for (const chunk of chunks) {
    const value = (chunk as { value?: unknown }).value;
    if (typeof value === "string") {
      text += value;
    } else if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
      // A StringChunk's `value` is a string[]; join it.
      text += value.join("");
    } else {
      // A Param (bound value) or an embedded column/table reference.
      paramCount += 1;
    }
  }
  return { text, paramCount };
}

describe("findLetter", () => {
  beforeEach(() => {
    executeSpy.mockReset();
    vi.mocked(getDb).mockClear();
  });

  it("issues a single statement that selects now() alongside the row", async () => {
    executeSpy.mockResolvedValueOnce([]);
    await findLetter("AAECAwQFBgcICQoLDA0ODw");

    expect(executeSpy).toHaveBeenCalledTimes(1);
    const statement = executeSpy.mock.calls[0][0];
    const { text } = inspectSql(statement);
    // The DB clock is read in the same statement as the row.
    expect(text.toLowerCase()).toContain("now()");
    // Both source tables are read in one UNION ALL statement.
    expect(text.toLowerCase()).toContain("union all");
  });

  it("binds the id as a parameter, never interpolated into the SQL text", async () => {
    executeSpy.mockResolvedValueOnce([]);
    const id = "AAECAwQFBgcICQoLDA0ODw";
    await findLetter(id);

    const statement = executeSpy.mock.calls[0][0];
    const { text, paramCount } = inspectSql(statement);
    // The id value never appears as literal text in the statement.
    expect(text).not.toContain(id);
    // The statement carries bound parameters/references (id is one of them).
    expect(paramCount).toBeGreaterThan(0);
  });

  it("returns null when no row matches", async () => {
    executeSpy.mockResolvedValueOnce([]);
    await expect(findLetter("AAECAwQFBgcICQoLDA0ODw")).resolves.toBeNull();
  });

  it("maps a real letter row to demo = false and surfaces dbNow from the DB", async () => {
    const opensAt = new Date("2027-02-01T00:00:00.000Z");
    const dbNow = new Date("2026-11-15T09:30:00.000Z");
    const serverSecret = Buffer.alloc(32, 7);
    executeSpy.mockResolvedValueOnce([
      {
        id: "AAECAwQFBgcICQoLDA0ODw",
        envelope: "{}",
        envelope_hash: "a".repeat(64),
        opens_at: opensAt,
        server_secret: serverSecret,
        demo: false,
        db_now: dbNow,
      },
    ]);

    const row = await findLetter("AAECAwQFBgcICQoLDA0ODw");
    expect(row).not.toBeNull();
    expect(row!.demo).toBe(false);
    expect(row!.opensAt.getTime()).toBe(opensAt.getTime());
    // dbNow is the value the DB returned, not any client clock.
    expect(row!.dbNow.getTime()).toBe(dbNow.getTime());
    expect(row!.serverSecret.equals(serverSecret)).toBe(true);
  });

  it("maps a demo letter row to demo = true", async () => {
    executeSpy.mockResolvedValueOnce([
      {
        id: "AAECAwQFBgcICQoLDA0ODw",
        envelope: "{}",
        envelope_hash: "b".repeat(64),
        opens_at: new Date("2024-11-05T00:00:00.000Z"),
        server_secret: Buffer.alloc(32, 1),
        demo: true,
        db_now: new Date("2026-11-15T09:30:00.000Z"),
      },
    ]);

    const row = await findLetter("AAECAwQFBgcICQoLDA0ODw");
    expect(row!.demo).toBe(true);
  });

  it("maps a timestamp returned as a string to a Date", async () => {
    executeSpy.mockResolvedValueOnce([
      {
        id: "AAECAwQFBgcICQoLDA0ODw",
        envelope: "{}",
        envelope_hash: "c".repeat(64),
        opens_at: "2027-02-01T00:00:00.000Z",
        server_secret: Buffer.alloc(32, 2),
        demo: false,
        db_now: "2026-11-15T09:30:00.000Z",
      },
    ]);

    const row = await findLetter("AAECAwQFBgcICQoLDA0ODw");
    expect(row!.opensAt).toBeInstanceOf(Date);
    expect(row!.dbNow).toBeInstanceOf(Date);
    expect(row!.dbNow.toISOString()).toBe("2026-11-15T09:30:00.000Z");
  });

  it("never reads a client clock: dbNow always comes from the returned row", async () => {
    // A row whose db_now is far in the past proves dbNow is NOT Date.now().
    const ancient = new Date("2000-01-01T00:00:00.000Z");
    executeSpy.mockResolvedValueOnce([
      {
        id: "AAECAwQFBgcICQoLDA0ODw",
        envelope: "{}",
        envelope_hash: "d".repeat(64),
        opens_at: new Date("1999-01-01T00:00:00.000Z"),
        server_secret: Buffer.alloc(32, 0),
        demo: false,
        db_now: ancient,
      },
    ]);

    const row = await findLetter("AAECAwQFBgcICQoLDA0ODw");
    expect(row!.dbNow.getTime()).toBe(ancient.getTime());
    expect(row!.dbNow.getTime()).toBeLessThan(Date.now());
  });

  it("replaces any driver error with a value-free error (no detail leak)", async () => {
    executeSpy.mockRejectedValueOnce(
      new Error("duplicate key value: some-secret-detail"),
    );
    await expect(
      findLetter("AAECAwQFBgcICQoLDA0ODw"),
    ).rejects.toThrow("The letter could not be read.");
  });
});

describe("insertOpening", () => {
  beforeEach(() => {
    insertSpy.mockClear();
    valuesSpy.mockClear();
    returningSpy.mockClear();
    insertedValues = undefined;
    returningResult = [];
    vi.mocked(getDb).mockClear();
  });

  it("writes letter_id and leaves demo_letter_id null for a real letter", async () => {
    returningResult = [
      { id: "11111111-1111-1111-1111-111111111111", openedAt: new Date() },
    ];
    await insertOpening({
      letterId: "AAECAwQFBgcICQoLDA0ODw",
      demo: false,
      ciphertext: Buffer.alloc(16, 9),
      nonce: Buffer.alloc(12, 3),
    });

    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertedValues).toMatchObject({
      letterId: "AAECAwQFBgcICQoLDA0ODw",
      demoLetterId: null,
    });
  });

  it("writes demo_letter_id and leaves letter_id null for a demo letter", async () => {
    returningResult = [
      { id: "22222222-2222-2222-2222-222222222222", openedAt: new Date() },
    ];
    await insertOpening({
      letterId: "AAECAwQFBgcICQoLDA0ODw",
      demo: true,
      ciphertext: Buffer.alloc(16, 9),
      nonce: Buffer.alloc(12, 3),
    });

    expect(insertedValues).toMatchObject({
      letterId: null,
      demoLetterId: "AAECAwQFBgcICQoLDA0ODw",
    });
  });

  it("does not set opened_at (left to the DB DEFAULT now())", async () => {
    returningResult = [
      { id: "33333333-3333-3333-3333-333333333333", openedAt: new Date() },
    ];
    await insertOpening({
      letterId: "AAECAwQFBgcICQoLDA0ODw",
      demo: false,
      ciphertext: Buffer.alloc(16, 9),
      nonce: Buffer.alloc(12, 3),
    });

    expect(insertedValues).not.toHaveProperty("openedAt");
    expect(insertedValues).not.toHaveProperty("opened_at");
  });

  it("returns the id and opened_at that the DB returned", async () => {
    const openedAt = new Date("2026-11-15T09:31:22.000Z");
    returningResult = [
      { id: "44444444-4444-4444-4444-444444444444", openedAt },
    ];
    const result = await insertOpening({
      letterId: "AAECAwQFBgcICQoLDA0ODw",
      demo: false,
      ciphertext: Buffer.alloc(16, 9),
      nonce: Buffer.alloc(12, 3),
    });

    expect(result.openingId).toBe("44444444-4444-4444-4444-444444444444");
    expect(result.openedAt.getTime()).toBe(openedAt.getTime());
  });

  it("coerces a string opened_at to a Date", async () => {
    returningResult = [
      { id: "55555555-5555-5555-5555-555555555555", openedAt: "2026-11-15T09:31:22.000Z" },
    ];
    const result = await insertOpening({
      letterId: "AAECAwQFBgcICQoLDA0ODw",
      demo: true,
      ciphertext: Buffer.alloc(16, 9),
      nonce: Buffer.alloc(12, 3),
    });

    expect(result.openedAt).toBeInstanceOf(Date);
    expect(result.openedAt.toISOString()).toBe("2026-11-15T09:31:22.000Z");
  });

  it("throws a value-free error when RETURNING yields no row", async () => {
    returningResult = [];
    await expect(
      insertOpening({
        letterId: "AAECAwQFBgcICQoLDA0ODw",
        demo: false,
        ciphertext: Buffer.alloc(16, 9),
        nonce: Buffer.alloc(12, 3),
      }),
    ).rejects.toThrow("The opening could not be recorded.");
  });

  it("replaces any driver error with a value-free error (no detail leak)", async () => {
    returningSpy.mockRejectedValueOnce(
      new Error("check constraint violated: some-secret-detail"),
    );
    await expect(
      insertOpening({
        letterId: "AAECAwQFBgcICQoLDA0ODw",
        demo: false,
        ciphertext: Buffer.alloc(16, 9),
        nonce: Buffer.alloc(12, 3),
      }),
    ).rejects.toThrow("The opening could not be recorded.");
  });
});
