// Integration tests for the real-letter tables added in the 0003 migration: the
// `letter_drafts` round trip, and the database rules for a real `letters` row
// (the 3-calendar-month lock CHECK and the immutability triggers). They run
// against a real Postgres via `describeDb`, so they skip locally unless
// `DATABASE_URL` names a database containing `test`, and fail (never skip) in
// CI; see ./setup.
//
// Every test uses a fresh random letter ID and asserts only on rows it created.
// The UPDATE and DELETE tests prove the triggers raise; they never change a row
// the suite expects to keep, and they re-read the row to show it is unchanged.

import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, expect, it, vi } from "vitest";
import postgres from "postgres";
import type { Sql } from "postgres";

import { encodeBase64url } from "@/lib/seal-format";
import { describeDb } from "./setup";

// Per-file 60s timeout: real Postgres round-trips and the one-time migration in
// `beforeAll` can exceed Vitest's default 5s, especially on a cold container.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

/** A fresh random valid letter ID: 16 random bytes as 22 canonical chars. */
function freshLetterId(): string {
  return encodeBase64url(new Uint8Array(randomBytes(16)));
}

/** A 64-char lowercase hex hash. Only the format matters to the CHECK. */
const HASH = "b".repeat(64);

/** A 32-byte time-lock secret. */
const SECRET = Buffer.alloc(32, 7);

/** A minimal, valid envelope body. The database only checks its shape. */
const ENVELOPE = '{"formatVersion":1}';

describeDb("letter_drafts and real letters (integration)", () => {
  // A dedicated raw client for the direct inserts, updates and deletes that the
  // store API does not expose. Opened once in beforeAll and closed in afterAll.
  let sql: Sql;

  beforeAll(() => {
    // `describeDb` has already asserted DATABASE_URL names a test database.
    sql = postgres(process.env.DATABASE_URL as string, { max: 1 });
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("round-trips a letter_drafts row and defaults created_at to now()", async () => {
    const id = freshLetterId();
    const secret = Buffer.from(randomBytes(32));

    await sql`
      INSERT INTO letter_drafts (id, server_secret)
      VALUES (${id}, ${secret})
    `;

    const rows = await sql<
      { id: string; server_secret: Buffer; created_at: Date }[]
    >`SELECT id, server_secret, created_at FROM letter_drafts WHERE id = ${id}`;

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(id);
    expect(Buffer.compare(rows[0].server_secret, secret)).toBe(0);
    expect(rows[0].created_at).toBeInstanceOf(Date);
    expect(Math.abs(Date.now() - rows[0].created_at.getTime())).toBeLessThan(
      5 * 60_000,
    );

    await sql`DELETE FROM letter_drafts WHERE id = ${id}`;
    const after = await sql`SELECT 1 FROM letter_drafts WHERE id = ${id}`;
    expect(after).toHaveLength(0);
  });

  it("rejects a letter_drafts row whose server_secret is not 32 bytes", async () => {
    const id = freshLetterId();
    await expect(
      sql`INSERT INTO letter_drafts (id, server_secret) VALUES (${id}, ${Buffer.alloc(31, 1)})`,
    ).rejects.toThrow(/letter_drafts_server_secret_len/);
  });

  it("rejects a real letter whose opens_at is under 3 calendar months after sealing", async () => {
    // 2026-11-06 12:00 UTC plus 3 calendar months is 2027-02-06 12:00 UTC.
    // One day short of that must fail the letters_opens_at_min_lock CHECK.
    const id = freshLetterId();
    await expect(
      sql`
        INSERT INTO letters (id, envelope, envelope_hash, sealed_at, opens_at, server_secret)
        VALUES (
          ${id}, ${ENVELOPE}, ${HASH},
          '2026-11-06T12:00:00Z', '2027-02-05T12:00:00Z', ${SECRET}
        )
      `,
    ).rejects.toThrow(/letters_opens_at_min_lock/);
  });

  it("accepts a real letter exactly 3 calendar months after sealing", async () => {
    const id = freshLetterId();
    await sql`
      INSERT INTO letters (id, envelope, envelope_hash, sealed_at, opens_at, server_secret)
      VALUES (
        ${id}, ${ENVELOPE}, ${HASH},
        '2026-11-06T12:00:00Z', '2027-02-06T12:00:00Z', ${SECRET}
      )
    `;
    const rows = await sql`SELECT 1 FROM letters WHERE id = ${id}`;
    expect(rows).toHaveLength(1);
  });

  it("raises on UPDATE of a real letter and leaves the row unchanged", async () => {
    const id = freshLetterId();
    await sql`
      INSERT INTO letters (id, envelope, envelope_hash, sealed_at, opens_at, server_secret)
      VALUES (
        ${id}, ${ENVELOPE}, ${HASH},
        '2026-11-06T12:00:00Z', '2027-02-06T12:00:00Z', ${SECRET}
      )
    `;

    await expect(
      sql`UPDATE letters SET envelope = '{"tampered":true}' WHERE id = ${id}`,
    ).rejects.toThrow(/immutable/);

    const rows = await sql<{ envelope: string }[]>`
      SELECT envelope FROM letters WHERE id = ${id}
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0].envelope).toBe(ENVELOPE);
  });

  it("raises on DELETE of a real letter and leaves the row unchanged", async () => {
    const id = freshLetterId();
    await sql`
      INSERT INTO letters (id, envelope, envelope_hash, sealed_at, opens_at, server_secret)
      VALUES (
        ${id}, ${ENVELOPE}, ${HASH},
        '2026-11-06T12:00:00Z', '2027-02-06T12:00:00Z', ${SECRET}
      )
    `;

    await expect(sql`DELETE FROM letters WHERE id = ${id}`).rejects.toThrow(
      /immutable/,
    );

    const rows = await sql<{ envelope_hash: string }[]>`
      SELECT envelope_hash FROM letters WHERE id = ${id}
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0].envelope_hash).toBe(HASH);
  });
});
