// Integration tests for the sealed-letter schema and the persona store, run
// against a real Postgres via `describeDb`. The suite skips locally unless
// `DATABASE_URL` names a database containing `test`, and fails (never skips) in
// CI; see ./setup.
//
// These tests assert only on rows they created (every test uses a fresh random
// letter ID), so they are safe to run against a shared test database and in any
// order. They never UPDATE, DELETE or TRUNCATE a row they expect to keep: the
// immutability triggers forbid it, and the trigger tests below prove that.
//
// Coverage:
//   - R4.2-R4.9: the id / envelope_hash / server_secret / ciphertext / nonce
//     CHECKs accept valid and reject invalid values; the letters 3-month UTC
//     lock CHECK; demo_letters.kind pinned to 'persona'; openings
//     num_nonnulls(letter_id, demo_letter_id) = 1; opened_at defaults to now();
//     the two FK indexes exist; and the BEFORE UPDATE OR DELETE row triggers and
//     BEFORE TRUNCATE statement triggers raise on all three tables.
//   - R5: storePersonaLetter end to end — a valid insert, a duplicate id, and a
//     wrong secret / hash / envelope each throwing the matching check.

import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, expect, it, vi } from "vitest";
import postgres from "postgres";
import type { Sql } from "postgres";

import { encodeBase64url, envelopeHash } from "@/lib/seal-format";
import {
  LetterStoreError,
  storePersonaLetter,
} from "@/lib/letter-store/store";
import { describeDb } from "./setup";

// Per-file 60s timeout: real Postgres round-trips and the one-time migration in
// `beforeAll` can exceed Vitest's default 5s, especially on a cold container.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// --- Fixtures ----------------------------------------------------------------
//
// A valid v1 envelope with a single backup wrap (no passkey fields), matching
// the header schema. Only the letter ID and the two timestamps vary per test;
// the opaque fields are valid base64url of the required sizes.

interface Envelope {
  formatVersion: 1;
  letterId: string;
  sealedAt: string;
  opensAt: string;
  payloadNonce: string;
  payloadCiphertext: string;
  wrappedDeks: ReadonlyArray<{
    factor: "backup";
    nonce: string;
    wrappedKey: string;
  }>;
}

const BASE_ENVELOPE = {
  formatVersion: 1,
  payloadNonce: "MzMzMzMzMzMzMzMz", // 12 bytes
  payloadCiphertext: "REREREREREREREREREREREREREREREREREREREREREQ", // 32 bytes
  wrappedDeks: [
    {
      factor: "backup",
      nonce: "ERERERERERERERER", // 12 bytes
      wrappedKey:
        "IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIi", // 48 bytes
    },
  ],
} as const;

/** A fresh random valid letter ID (16 random bytes, 22 canonical chars). */
function freshLetterId(): string {
  return encodeBase64url(new Uint8Array(randomBytes(16)));
}

/**
 * Build a valid envelope. `opensAt` defaults to four months after `sealedAt`,
 * clearing the letters 3-month lock. A caller may override either instant.
 */
function makeEnvelope(
  overrides: {
    letterId?: string;
    sealedAt?: string;
    opensAt?: string;
  } = {},
): Envelope {
  const sealedAt = overrides.sealedAt ?? "2026-10-31T12:00:00.000Z";
  const sealedMs = Date.parse(sealedAt);
  const fourMonths = new Date(sealedMs);
  fourMonths.setUTCMonth(fourMonths.getUTCMonth() + 4);
  return {
    ...BASE_ENVELOPE,
    letterId: overrides.letterId ?? freshLetterId(),
    sealedAt,
    opensAt: overrides.opensAt ?? fourMonths.toISOString(),
  };
}

/** A valid 32-byte server secret. */
function freshSecret(): Uint8Array {
  return new Uint8Array(randomBytes(32));
}

/** Store a valid persona letter and return its id and envelope. */
async function storeValidPersona(): Promise<{ id: string; envelope: Envelope }> {
  const envelope = makeEnvelope();
  const hash = await envelopeHash(envelope);
  await storePersonaLetter({
    envelope,
    envelopeHash: hash,
    serverSecret: freshSecret(),
  });
  return { id: envelope.letterId, envelope };
}

describeDb("sealed-letter schema (integration)", () => {
  // A dedicated raw client so the tests can issue the exact DDL/DML they need
  // (invalid inserts, trigger-tripping UPDATE/DELETE/TRUNCATE) that the store
  // API does not expose. Opened once and closed in afterAll.
  let sql: Sql;

  beforeAll(() => {
    // `describeDb` has already asserted DATABASE_URL names a test database.
    sql = postgres(process.env.DATABASE_URL as string, { max: 1 });
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  // --- R4.2 letter ID CHECK --------------------------------------------------

  it("accepts a valid letter ID and rejects a malformed one", async () => {
    const id = freshLetterId();
    const hash = "a".repeat(64);
    const secret = Buffer.from(freshSecret());
    const sealed = new Date("2026-01-01T00:00:00.000Z");
    const opens = new Date("2026-06-01T00:00:00.000Z");

    await expect(
      sql`
        INSERT INTO letters (id, envelope, envelope_hash, sealed_at, opens_at, server_secret)
        VALUES (${id}, ${"{}"}, ${hash}, ${sealed}, ${opens}, ${secret})
      `,
    ).resolves.toBeDefined();

    await expect(
      sql`
        INSERT INTO letters (id, envelope, envelope_hash, sealed_at, opens_at, server_secret)
        VALUES (${"not-a-valid-id"}, ${"{}"}, ${hash}, ${sealed}, ${opens}, ${secret})
      `,
    ).rejects.toThrow(/letters_id_format/);
  });

  // --- R4.3 envelope_hash CHECK ----------------------------------------------

  it("accepts a 64-lowercase-hex envelope hash and rejects others", async () => {
    const secret = Buffer.from(freshSecret());
    const sealed = new Date("2026-01-01T00:00:00.000Z");
    const opens = new Date("2026-06-01T00:00:00.000Z");

    await expect(
      sql`
        INSERT INTO letters (id, envelope, envelope_hash, sealed_at, opens_at, server_secret)
        VALUES (${freshLetterId()}, ${"{}"}, ${"0123456789abcdef".repeat(4)}, ${sealed}, ${opens}, ${secret})
      `,
    ).resolves.toBeDefined();

    // Uppercase hex is rejected (the CHECK pins lowercase).
    await expect(
      sql`
        INSERT INTO letters (id, envelope, envelope_hash, sealed_at, opens_at, server_secret)
        VALUES (${freshLetterId()}, ${"{}"}, ${"A".repeat(64)}, ${sealed}, ${opens}, ${secret})
      `,
    ).rejects.toThrow(/letters_envelope_hash_format/);

    // Wrong length is rejected.
    await expect(
      sql`
        INSERT INTO letters (id, envelope, envelope_hash, sealed_at, opens_at, server_secret)
        VALUES (${freshLetterId()}, ${"{}"}, ${"ab"}, ${sealed}, ${opens}, ${secret})
      `,
    ).rejects.toThrow(/letters_envelope_hash_format/);
  });

  // --- R4.4 server_secret length CHECK ---------------------------------------

  it("accepts a 32-byte server secret and rejects other lengths", async () => {
    const hash = "a".repeat(64);
    const sealed = new Date("2026-01-01T00:00:00.000Z");
    const opens = new Date("2026-06-01T00:00:00.000Z");

    await expect(
      sql`
        INSERT INTO letters (id, envelope, envelope_hash, sealed_at, opens_at, server_secret)
        VALUES (${freshLetterId()}, ${"{}"}, ${hash}, ${sealed}, ${opens}, ${Buffer.from(freshSecret())})
      `,
    ).resolves.toBeDefined();

    await expect(
      sql`
        INSERT INTO letters (id, envelope, envelope_hash, sealed_at, opens_at, server_secret)
        VALUES (${freshLetterId()}, ${"{}"}, ${hash}, ${sealed}, ${opens}, ${Buffer.alloc(31)})
      `,
    ).rejects.toThrow(/letters_server_secret_len/);
  });

  // --- R4.6 ciphertext and nonce length CHECKs (openings) --------------------

  it("accepts a valid opening and rejects a bad ciphertext or nonce length", async () => {
    const { id } = await storeValidPersona();
    const goodCipher = Buffer.alloc(32, 7);
    const goodNonce = Buffer.alloc(12, 9);

    // A valid opening against the demo letter we just stored.
    await expect(
      sql`
        INSERT INTO openings (demo_letter_id, ciphertext, nonce)
        VALUES (${id}, ${goodCipher}, ${goodNonce})
      `,
    ).resolves.toBeDefined();

    // Empty ciphertext is rejected (min length is 1 byte).
    await expect(
      sql`
        INSERT INTO openings (demo_letter_id, ciphertext, nonce)
        VALUES (${id}, ${Buffer.alloc(0)}, ${goodNonce})
      `,
    ).rejects.toThrow(/openings_ciphertext_len/);

    // A nonce that is not 12 bytes is rejected.
    await expect(
      sql`
        INSERT INTO openings (demo_letter_id, ciphertext, nonce)
        VALUES (${id}, ${goodCipher}, ${Buffer.alloc(11)})
      `,
    ).rejects.toThrow(/openings_nonce_len/);
  });

  // --- R4.7 letters 3-month UTC lock CHECK -----------------------------------

  it("rejects an opens_at under 3 months and accepts 3 months or more", async () => {
    const hash = "a".repeat(64);
    const secret = Buffer.from(freshSecret());
    const sealed = new Date("2026-01-01T00:00:00.000Z");

    // Just under three months: rejected.
    await expect(
      sql`
        INSERT INTO letters (id, envelope, envelope_hash, sealed_at, opens_at, server_secret)
        VALUES (${freshLetterId()}, ${"{}"}, ${hash}, ${sealed}, ${new Date("2026-03-31T00:00:00.000Z")}, ${secret})
      `,
    ).rejects.toThrow(/letters_opens_at_min_lock/);

    // Exactly three months: accepted.
    await expect(
      sql`
        INSERT INTO letters (id, envelope, envelope_hash, sealed_at, opens_at, server_secret)
        VALUES (${freshLetterId()}, ${"{}"}, ${hash}, ${sealed}, ${new Date("2026-04-01T00:00:00.000Z")}, ${secret})
      `,
    ).resolves.toBeDefined();
  });

  // --- R4.8 demo_letters.kind CHECK ------------------------------------------

  it("accepts kind='persona' and 'live' and rejects any other kind on demo_letters", async () => {
    const hash = "a".repeat(64);
    const secret = Buffer.from(freshSecret());
    const sealed = new Date("2024-01-01T00:00:00.000Z");
    const opens = new Date("2024-02-01T00:00:00.000Z");

    await expect(
      sql`
        INSERT INTO demo_letters (id, envelope, envelope_hash, sealed_at, opens_at, server_secret, kind)
        VALUES (${freshLetterId()}, ${"{}"}, ${hash}, ${sealed}, ${opens}, ${secret}, ${"persona"})
      `,
    ).resolves.toBeDefined();

    await expect(
      sql`
        INSERT INTO demo_letters (id, envelope, envelope_hash, sealed_at, opens_at, server_secret, kind)
        VALUES (${freshLetterId()}, ${"{}"}, ${hash}, ${sealed}, ${opens}, ${secret}, ${"other"})
      `,
    ).rejects.toThrow(/demo_letters_kind/);
  });

  // --- R4.8 demo_letters live 30-second lock CHECK ---------------------------

  it("accepts a live demo letter only when it opens exactly 30 seconds after sealing", async () => {
    const hash = "a".repeat(64);
    const secret = Buffer.from(freshSecret());
    const sealed = new Date("2024-01-01T00:00:00.000Z");

    // Opens one month later: rejected by the live-lock CHECK.
    await expect(
      sql`
        INSERT INTO demo_letters (id, envelope, envelope_hash, sealed_at, opens_at, server_secret, kind)
        VALUES (${freshLetterId()}, ${"{}"}, ${hash}, ${sealed}, ${new Date("2024-02-01T00:00:00.000Z")}, ${secret}, ${"live"})
      `,
    ).rejects.toThrow(/demo_letters_live_lock/);

    // Opens exactly 30 seconds later: accepted.
    await expect(
      sql`
        INSERT INTO demo_letters (id, envelope, envelope_hash, sealed_at, opens_at, server_secret, kind)
        VALUES (${freshLetterId()}, ${"{}"}, ${hash}, ${sealed}, ${new Date("2024-01-01T00:00:30.000Z")}, ${secret}, ${"live"})
      `,
    ).resolves.toBeDefined();
  });

  // --- R4.9 openings exactly-one-letter CHECK and opened_at default ----------

  it("rejects an opening with both or neither letter reference and accepts exactly one", async () => {
    const { id: demoId } = await storeValidPersona();

    // Insert a real letter to reference in the both-set case.
    const realId = freshLetterId();
    await sql`
      INSERT INTO letters (id, envelope, envelope_hash, sealed_at, opens_at, server_secret)
      VALUES (${realId}, ${"{}"}, ${"a".repeat(64)}, ${new Date("2026-01-01T00:00:00.000Z")}, ${new Date("2026-06-01T00:00:00.000Z")}, ${Buffer.from(freshSecret())})
    `;

    const cipher = Buffer.alloc(16, 1);
    const nonce = Buffer.alloc(12, 2);

    // Neither set: rejected.
    await expect(
      sql`
        INSERT INTO openings (ciphertext, nonce)
        VALUES (${cipher}, ${nonce})
      `,
    ).rejects.toThrow(/openings_exactly_one_letter/);

    // Both set: rejected.
    await expect(
      sql`
        INSERT INTO openings (letter_id, demo_letter_id, ciphertext, nonce)
        VALUES (${realId}, ${demoId}, ${cipher}, ${nonce})
      `,
    ).rejects.toThrow(/openings_exactly_one_letter/);

    // Exactly one set: accepted.
    await expect(
      sql`
        INSERT INTO openings (demo_letter_id, ciphertext, nonce)
        VALUES (${demoId}, ${cipher}, ${nonce})
      `,
    ).resolves.toBeDefined();
  });

  it("defaults opened_at to now()", async () => {
    const { id } = await storeValidPersona();
    const before = new Date();
    const rows = await sql<{ opened_at: Date }[]>`
      INSERT INTO openings (demo_letter_id, ciphertext, nonce)
      VALUES (${id}, ${Buffer.alloc(16, 5)}, ${Buffer.alloc(12, 6)})
      RETURNING opened_at
    `;
    const after = new Date();
    const openedAt = rows[0].opened_at;
    expect(openedAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect(openedAt.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
  });

  // --- R4.x FK indexes exist -------------------------------------------------

  it("has btree indexes on both openings foreign keys", async () => {
    const rows = await sql<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'openings'
    `;
    const names = rows.map((r) => r.indexname);
    expect(names).toContain("openings_letter_id_idx");
    expect(names).toContain("openings_demo_letter_id_idx");
  });

  // --- R4.x immutability triggers: UPDATE, DELETE, TRUNCATE all raise --------

  it("forbids UPDATE, DELETE and TRUNCATE on letters", async () => {
    const id = freshLetterId();
    await sql`
      INSERT INTO letters (id, envelope, envelope_hash, sealed_at, opens_at, server_secret)
      VALUES (${id}, ${"{}"}, ${"a".repeat(64)}, ${new Date("2026-01-01T00:00:00.000Z")}, ${new Date("2026-06-01T00:00:00.000Z")}, ${Buffer.from(freshSecret())})
    `;

    await expect(
      sql`UPDATE letters SET envelope = ${"{\"x\":1}"} WHERE id = ${id}`,
    ).rejects.toThrow(/sealed records are immutable/);
    await expect(
      sql`DELETE FROM letters WHERE id = ${id}`,
    ).rejects.toThrow(/sealed records are immutable/);
    // `openings` references `letters`, so truncating `letters` alone is
    // refused by the FK check before the trigger runs. Truncate both together
    // so the FK check passes and the BEFORE TRUNCATE trigger is what raises.
    await expect(sql`TRUNCATE letters, openings`).rejects.toThrow(
      /sealed records are immutable/,
    );
  });

  it("forbids UPDATE, DELETE and TRUNCATE on demo_letters", async () => {
    const { id } = await storeValidPersona();

    await expect(
      sql`UPDATE demo_letters SET envelope = ${"{\"x\":1}"} WHERE id = ${id}`,
    ).rejects.toThrow(/sealed records are immutable/);
    await expect(
      sql`DELETE FROM demo_letters WHERE id = ${id}`,
    ).rejects.toThrow(/sealed records are immutable/);
    // `openings` references `demo_letters`, so truncate both together (see the
    // letters case): the FK check passes and the trigger is what raises.
    await expect(sql`TRUNCATE demo_letters, openings`).rejects.toThrow(
      /sealed records are immutable/,
    );
  });

  it("forbids UPDATE, DELETE and TRUNCATE on openings", async () => {
    const { id } = await storeValidPersona();
    const rows = await sql<{ id: string }[]>`
      INSERT INTO openings (demo_letter_id, ciphertext, nonce)
      VALUES (${id}, ${Buffer.alloc(16, 3)}, ${Buffer.alloc(12, 4)})
      RETURNING id
    `;
    const openingId = rows[0].id;

    await expect(
      sql`UPDATE openings SET nonce = ${Buffer.alloc(12, 8)} WHERE id = ${openingId}`,
    ).rejects.toThrow(/sealed records are immutable/);
    await expect(
      sql`DELETE FROM openings WHERE id = ${openingId}`,
    ).rejects.toThrow(/sealed records are immutable/);
    await expect(sql`TRUNCATE openings`).rejects.toThrow(
      /sealed records are immutable/,
    );
  });

  // --- R5 storePersonaLetter end to end --------------------------------------

  it("stores a valid persona letter as kind='persona'", async () => {
    const { id } = await storeValidPersona();
    const rows = await sql<{ kind: string }[]>`
      SELECT kind FROM demo_letters WHERE id = ${id}
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("persona");
  });

  it("throws duplicate_id when the same letter ID is stored twice", async () => {
    const { envelope } = await storeValidPersona();
    const hash = await envelopeHash(envelope);

    let thrown: unknown;
    try {
      await storePersonaLetter({
        envelope,
        envelopeHash: hash,
        serverSecret: freshSecret(),
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(LetterStoreError);
    expect((thrown as LetterStoreError).check).toBe("duplicate_id");
  });

  it("throws server_secret for a secret that is not 32 bytes", async () => {
    const envelope = makeEnvelope();
    const hash = await envelopeHash(envelope);

    let thrown: unknown;
    try {
      await storePersonaLetter({
        envelope,
        envelopeHash: hash,
        serverSecret: new Uint8Array(31),
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(LetterStoreError);
    expect((thrown as LetterStoreError).check).toBe("server_secret");
  });

  it("throws hash_mismatch for a hash that does not match the envelope", async () => {
    const envelope = makeEnvelope();

    let thrown: unknown;
    try {
      await storePersonaLetter({
        envelope,
        envelopeHash: "0".repeat(64),
        serverSecret: freshSecret(),
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(LetterStoreError);
    expect((thrown as LetterStoreError).check).toBe("hash_mismatch");
  });

  it("throws envelope for an envelope that does not parse", async () => {
    let thrown: unknown;
    try {
      await storePersonaLetter({
        envelope: { formatVersion: 1, letterId: "bad" },
        envelopeHash: "0".repeat(64),
        serverSecret: freshSecret(),
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(LetterStoreError);
    expect((thrown as LetterStoreError).check).toBe("envelope");
  });
});
