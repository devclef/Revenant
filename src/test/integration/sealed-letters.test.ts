// End-to-end integration test: seal, store, open, record answers, prove
// immutability (spec 02-sealed-letters, Task 5; design.md; crypto.md).
//
// Unlike the browser-only crypto unit tests and the schema/store integration
// test, this suite exercises the WHOLE round trip against a real Postgres: it
// seals a v1 payload in the test (as the browser would), stores it through
// `storePersonaLetter`, reads it back through the exported route handlers,
// releases the server secret, verifies the envelope hash, decrypts, and asserts
// the decrypted payload deep-equals the original. It then records recall
// answers, and proves the immutability triggers and the letters 3-month lock
// CHECK with direct parameterised inserts.
//
// Like `schema.test.ts`, the suite runs only against a real test database via
// `describeDb` (skips locally when `DATABASE_URL` does not name a database
// containing `test`, fails — never skips — in CI). Every test uses fresh random
// IDs and asserts only on rows it created, so the suite is order-independent and
// safe against a shared test database. It never UPDATEs or DELETEs a row it
// expects to keep; the trigger tests prove those operations raise.

import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, expect, it, vi } from "vitest";
import postgres from "postgres";
import type { Sql } from "postgres";

import {
  sealLetter,
  openLetter,
  encryptOpeningRecord,
  decryptOpeningRecord,
  generateBackupKey,
} from "@/lib/crypto";
import type { SealResult, BackupKeyBytes } from "@/lib/crypto";
import { storePersonaLetter } from "@/lib/letter-store/store";
import {
  envelopeHash,
  encodeBase64url,
  decodeBase64url,
} from "@/lib/seal-format";
import type { PayloadV1 } from "@/lib/seal-format";
import { describeDb } from "./setup";

// Route handlers under test, aliased to names that read in the test body.
import { GET as getLetter } from "@/app/api/letters/[id]/route";
import { GET as getSecret } from "@/app/api/letters/[id]/secret/route";
import { POST as postOpening } from "@/app/api/openings/route";

// Per-file 60s timeout: a full seal/open round trip plus real Postgres
// round-trips and the one-time migration in `beforeAll` can exceed Vitest's
// default 5s, especially on a cold container.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// --- Fixtures and helpers ----------------------------------------------------

/** A fresh random valid letter ID: 16 random bytes as 22 canonical chars. */
function freshLetterId(): string {
  return encodeBase64url(new Uint8Array(randomBytes(16)));
}

/** A fresh 32-byte server secret (the per-letter time-lock secret). */
function freshServerSecret(): Uint8Array {
  return new Uint8Array(randomBytes(32));
}

/**
 * Build a valid v1 payload: one official figure with full provenance, its
 * metric definition, one written-out number recall question, and the
 * `format_version`/field shape `payloadV1Schema` requires. The letter text is
 * well under 5,000 characters. The values here are obvious test fixtures, not
 * real figures — this payload is only ever sealed inside a test, never stored
 * as a demo or real letter (data-integrity.md).
 */
function buildPayload(): PayloadV1 {
  return {
    format_version: 1,
    letter_text:
      "A letter to my future self. Some things will have changed by the " +
      "time you read this, and some will be exactly as they are now. I hope " +
      "you remember the ordinary days.",
    metrics: [
      {
        id: "fuel-fixture",
        display_name: "Fixture fuel price",
        unit: "USD per gallon",
        region: "U.S. city average",
        source: "FIXTURE source",
        series_id: "FIXTURE_FUEL_001",
      },
    ],
    figures: [
      {
        kind: "official",
        metric_id: "fuel-fixture",
        value: "3.412",
        unit: "USD per gallon",
        region: "U.S. city average",
        period: "2024-10",
        source: "FIXTURE source",
        series_id: "FIXTURE_FUEL_001",
        retrieved_at: "2024-10-30T14:02:11Z",
        source_url: "https://example.invalid/fixture/fuel",
      },
    ],
    recall_questions: [
      {
        id: "q-fuel",
        answer_type: "number",
        text: "What do you think a gallon of fuel cost then?",
        metric_id: "fuel-fixture",
      },
    ],
  };
}

/** The result of {@link sealOne}: everything a later step needs to open it. */
interface SealedLetter {
  /** The 22-char canonical letter ID. */
  letterId: string;
  /** The same ID as its 16 raw bytes (for AAD and ID-byte APIs). */
  letterIdBytes: Uint8Array;
  /** The 32-byte time-lock server secret. */
  serverSecret: Uint8Array;
  /** The 16-byte backup key used to wrap the DEK. */
  backupKey: BackupKeyBytes;
  /** The sealed envelope and its hash from `sealLetter`. */
  sealResult: SealResult;
  /** The plaintext payload that was sealed. */
  payload: PayloadV1;
}

/**
 * Seal a fresh letter for a given opening instant.
 *
 * Generates a test backup key, a random 16-byte letter ID and a random 32-byte
 * server secret, computes a `sealedAt` and the given `opensAt` as
 * millisecond-precision ISO `Z` strings, and seals a {@link buildPayload}
 * payload. `sealedAt` is fixed well before any demo opening date so a past
 * `opensAt` is consistent; the letters 3-month lock is enforced by the DB only
 * for real letters, not for the persona store this suite uses.
 */
async function sealOne({ opensAt }: { opensAt: string }): Promise<SealedLetter> {
  const backupKey = generateBackupKey();
  const letterIdBytes = new Uint8Array(randomBytes(16));
  const letterId = encodeBase64url(letterIdBytes);
  const serverSecret = freshServerSecret();
  const sealedAt = "2023-10-31T12:00:00.000Z";
  const payload = buildPayload();

  const sealResult = await sealLetter({
    payload,
    letterId: letterIdBytes,
    serverSecret,
    backupKey,
    sealedAt,
    opensAt,
  });

  return {
    letterId,
    letterIdBytes,
    serverSecret,
    backupKey,
    sealResult,
    payload,
  };
}

describeDb("seal, store, open, record answers, immutability (integration)", () => {
  // A dedicated raw client for the direct parameterised inserts and the trigger
  // tests, which the store/route API does not expose. Opened once in beforeAll
  // and closed in afterAll, mirroring schema.test.ts.
  let sql: Sql;

  beforeAll(() => {
    // `describeDb` has already asserted DATABASE_URL names a test database.
    sql = postgres(process.env.DATABASE_URL as string, { max: 1 });
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  // Placeholder so the suite is discoverable while the real tests (steps 2-6)
  // are added. It also pins every imported symbol and helper as used, so the
  // file lints and type-checks on its own.
  it("exposes the round-trip helpers and route handlers", async () => {
    // The raw client is live for the trigger/direct-insert tests added later.
    const [{ one }] = await sql<{ one: number }[]>`SELECT 1 AS one`;
    expect(one).toBe(1);

    // Route handlers and crypto/store entry points are all present.
    expect(typeof getLetter).toBe("function");
    expect(typeof getSecret).toBe("function");
    expect(typeof postOpening).toBe("function");
    expect(typeof sealLetter).toBe("function");
    expect(typeof openLetter).toBe("function");
    expect(typeof encryptOpeningRecord).toBe("function");
    expect(typeof decryptOpeningRecord).toBe("function");
    expect(typeof storePersonaLetter).toBe("function");

    // Fixtures produce well-formed values.
    const id = freshLetterId();
    expect(id).toHaveLength(22);
    expect(decodeBase64url(id, 16)).toHaveLength(16);
    expect(freshServerSecret()).toHaveLength(32);

    const payload = buildPayload();
    expect(payload.format_version).toBe(1);

    // The seal helper produces a real envelope whose stored hash matches.
    const sealed = await sealOne({ opensAt: "2024-11-05T00:00:00.000Z" });
    expect(sealed.sealResult.envelope.formatVersion).toBe(1);
    expect(sealed.sealResult.envelopeHash).toBe(
      await envelopeHash(sealed.sealResult.envelope),
    );
    expect(sealed.letterIdBytes).toHaveLength(16);
    expect(sealed.serverSecret).toHaveLength(32);
  });

  // --- Step 2: openable letter, full seal -> store -> read -> secret ->
  // hash-verify -> decrypt -> deep-equal round trip. -------------------------
  it("seals, stores, reads back and reveals an openable letter", async () => {
    // Seal a fresh letter with a PAST opening instant. `sealedAt` inside
    // `sealOne` is fixed in 2023, far enough before this 2024 opening that a
    // real letter's 3-month lock would also hold; the persona store accepts a
    // past `opensAt` either way, since persona letters carry historical dates.
    const sealed = await sealOne({ opensAt: "2024-11-05T00:00:00.000Z" });

    // Store it as a persona (demo) letter. The store re-derives and checks the
    // hash, so passing the sealed hash through proves it round-trips.
    await storePersonaLetter({
      envelope: sealed.sealResult.envelope,
      envelopeHash: sealed.sealResult.envelopeHash,
      serverSecret: sealed.serverSecret,
    });

    // Read the letter back through the exported route GET handler. Because the
    // opening instant is in the past, the row is openable and the route hands
    // back the full envelope and hash.
    const letterRes = await getLetter(
      new Request(`https://revenant.test/api/letters/${sealed.letterId}`),
      { params: Promise.resolve({ id: sealed.letterId }) },
    );
    expect(letterRes.status).toBe(200);
    const letterBody = (await letterRes.json()) as {
      status: string;
      demo: boolean;
      opensAt: string;
      envelope: unknown;
      envelopeHash: string;
    };
    expect(letterBody.status).toBe("openable");
    expect(letterBody.demo).toBe(true);
    // The envelope the route returns is the stored canonical JSON parsed back
    // to its values, so it deep-equals the sealed envelope exactly.
    expect(letterBody.envelope).toEqual(sealed.sealResult.envelope);
    expect(letterBody.envelopeHash).toBe(sealed.sealResult.envelopeHash);

    // Release the time-lock server secret through the exported secret route
    // GET handler. The opening instant is past, so the secret is released.
    const secretRes = await getSecret(
      new Request(
        `https://revenant.test/api/letters/${sealed.letterId}/secret`,
      ),
      { params: Promise.resolve({ id: sealed.letterId }) },
    );
    expect(secretRes.status).toBe(200);
    const secretBody = (await secretRes.json()) as { serverSecret: string };
    const releasedSecret = decodeBase64url(secretBody.serverSecret, 32);
    expect(releasedSecret).toHaveLength(32);
    // The bytes the route released are exactly the sealed server secret.
    expect(Array.from(releasedSecret)).toEqual(Array.from(sealed.serverSecret));

    // Open the letter in the browser's shoes: the route-supplied envelope and
    // hash, the released secret and the test backup key. This verifies the
    // hash, unwraps the DEK, decrypts the payload and parses it.
    const opened = await openLetter({
      envelope: letterBody.envelope,
      envelopeHash: letterBody.envelopeHash,
      serverSecret: releasedSecret,
      backupKey: sealed.backupKey,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      throw new Error("expected the letter to open");
    }
    // The decrypted payload deep-equals the plaintext that was sealed.
    expect(opened.payload).toEqual(sealed.payload);
    // The opening-records key is a real CryptoKey, ready to seal recall answers.
    expect(opened.openingKey).toBeInstanceOf(CryptoKey);
  });

  // --- Step 3: a sealed letter whose opening instant is in the FUTURE hides
  // everything — no envelope, no hash, no secret, and it records nothing. ----
  it("hides everything while a future-dated letter is still sealed", async () => {
    // Seal and store a SECOND persona letter opening far in the future, so the
    // database clock cannot be at or after it during this test. `sealedAt`
    // (2023, inside `sealOne`) stays before this opening instant, so the seal
    // is consistent; the persona store accepts any opening instant.
    const sealed = await sealOne({ opensAt: "2099-01-01T00:00:00.000Z" });
    await storePersonaLetter({
      envelope: sealed.sealResult.envelope,
      envelopeHash: sealed.sealResult.envelopeHash,
      serverSecret: sealed.serverSecret,
    });

    // (a) The letter route returns 200 but reveals ONLY the sealed status, the
    // opening instant and the demo flag — never the envelope or its hash, so a
    // scan before `opens_at` learns nothing about the contents.
    const letterRes = await getLetter(
      new Request(`https://revenant.test/api/letters/${sealed.letterId}`),
      { params: Promise.resolve({ id: sealed.letterId }) },
    );
    expect(letterRes.status).toBe(200);
    const letterBody = (await letterRes.json()) as Record<string, unknown>;
    expect(letterBody).toEqual({
      status: "sealed",
      opensAt: "2099-01-01T00:00:00.000Z",
      demo: true,
    });
    // Belt-and-braces: the sealed body carries no envelope material at all.
    expect(letterBody).not.toHaveProperty("envelope");
    expect(letterBody).not.toHaveProperty("envelopeHash");

    // (b) The secret route refuses to release the time-lock secret before the
    // opening instant: 403, and its body carries only the opening instant —
    // never the server secret.
    const secretRes = await getSecret(
      new Request(
        `https://revenant.test/api/letters/${sealed.letterId}/secret`,
      ),
      { params: Promise.resolve({ id: sealed.letterId }) },
    );
    expect(secretRes.status).toBe(403);
    const secretBody = (await secretRes.json()) as Record<string, unknown>;
    expect(secretBody).toEqual({ opensAt: "2099-01-01T00:00:00.000Z" });
    expect(secretBody).not.toHaveProperty("serverSecret");

    // (c) Posting an opening before the letter opens is refused with 403, and
    // nothing is recorded. The ciphertext/nonce below are well-formed so the
    // request passes every earlier check and is rejected solely on the
    // not-yet-openable gate.
    const ciphertext = encodeBase64url(new Uint8Array(randomBytes(48)));
    const nonce = encodeBase64url(new Uint8Array(randomBytes(12)));
    const openingRes = await postOpening(
      new Request("https://revenant.test/api/openings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ letterId: sealed.letterId, ciphertext, nonce }),
      }),
    );
    expect(openingRes.status).toBe(403);

    // The letter is a persona (demo) letter, so any opening row would reference
    // it by `demo_letter_id`. The raw client confirms none was recorded.
    const [{ count }] = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM openings
      WHERE demo_letter_id = ${sealed.letterId}
    `;
    expect(count).toBe(0);
  });

  // --- Step 4: record recall answers for an openable letter. The browser
  // encrypts the answers under the per-letter opening key and POSTs the
  // ciphertext BEFORE anything is shown ("Recall first", R7); the operator only
  // ever stores ciphertext (operator-blind, R8). This proves the record lands
  // as exactly one append-only row and decrypts back to the original answers. -
  it("records encrypted recall answers that round-trip for an openable letter", async () => {
    // Seal and store a FRESH openable letter so this test depends on no earlier
    // one. A past opening instant makes it openable immediately.
    const sealed = await sealOne({ opensAt: "2024-11-05T00:00:00.000Z" });
    await storePersonaLetter({
      envelope: sealed.sealResult.envelope,
      envelopeHash: sealed.sealResult.envelopeHash,
      serverSecret: sealed.serverSecret,
    });

    // Open it to obtain the per-letter opening key, exactly as the reveal flow
    // does: read the stored envelope/hash back, release the secret, open.
    const opened = await openLetter({
      envelope: sealed.sealResult.envelope,
      envelopeHash: sealed.sealResult.envelopeHash,
      serverSecret: sealed.serverSecret,
      backupKey: sealed.backupKey,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      throw new Error("expected the letter to open");
    }
    const openingKey = opened.openingKey;

    // The reader's answers to the sealed recall questions. Any JSON value is
    // accepted; a map keyed by question id is the natural shape.
    const answers = {
      "q-fuel": { answer_type: "number", value: "2.89" },
    };

    // Encrypt in the browser's shoes, binding the record to this letter's ID
    // bytes as AAD, then POST the ciphertext/nonce to the openings route.
    const record = await encryptOpeningRecord(
      openingKey,
      sealed.letterIdBytes,
      answers,
    );
    const openingRes = await postOpening(
      new Request("https://revenant.test/api/openings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          letterId: sealed.letterId,
          ciphertext: record.ciphertext,
          nonce: record.nonce,
        }),
      }),
    );
    expect(openingRes.status).toBe(201);

    // Exactly one opening row now references this (demo) letter. The raw client
    // reads it back; the ciphertext and nonce are stored as bytea, so re-encode
    // the returned bytes as base64url to feed the decrypt step.
    const rows = await sql<
      { ciphertext: Uint8Array; nonce: Uint8Array }[]
    >`
      SELECT ciphertext, nonce
      FROM openings
      WHERE demo_letter_id = ${sealed.letterId}
    `;
    expect(rows).toHaveLength(1);
    const stored = {
      ciphertext: encodeBase64url(new Uint8Array(rows[0].ciphertext)),
      nonce: encodeBase64url(new Uint8Array(rows[0].nonce)),
    };

    // Decrypt the stored record with the same opening key and letter ID bytes.
    // The AAD-bound GCM box authenticates and the plaintext parses back to the
    // exact answers the reader gave — operator-blind storage round-trips.
    const decrypted = await decryptOpeningRecord(
      openingKey,
      sealed.letterIdBytes,
      stored,
    );
    expect(decrypted).toEqual(answers);
  });

  // --- Step 5: immutability triggers. Every sealed table carries a
  // `revenant_forbid_change` BEFORE UPDATE OR DELETE trigger that raises, so no
  // application code can alter or remove a sealed row (data-integrity.md:
  // "Enforce this at the database level, not just in app logic"). This proves it
  // directly with the raw client on one row of each table — `letters`,
  // `demo_letters` and `openings` — and shows each row is byte-for-byte
  // unchanged after both a rejected UPDATE and a rejected DELETE. -------------
  it("rejects UPDATE and DELETE on letters, demo_letters and openings rows", async () => {
    // A real `letters` row, inserted directly with a parameterised INSERT (the
    // store writes `demo_letters`, never `letters`). The envelope, hash and
    // 32-byte secret come from a real seal so every row CHECK is satisfied;
    // `opens_at` is set exactly 3 months + 1 day after `sealed_at` so the
    // letters 3-month lock CHECK holds. Fresh random ID → independent row.
    const realSealed = await sealOne({ opensAt: "2024-11-05T00:00:00.000Z" });
    const realSealedAt = "2024-01-01T00:00:00.000Z";
    const realOpensAt = "2024-04-02T00:00:00.000Z"; // 3 months + 1 day later
    await sql`
      INSERT INTO letters (id, envelope, envelope_hash, sealed_at, opens_at, server_secret)
      VALUES (
        ${realSealed.letterId},
        ${JSON.stringify(realSealed.sealResult.envelope)},
        ${realSealed.sealResult.envelopeHash},
        ${realSealedAt},
        ${realOpensAt},
        ${Buffer.from(realSealed.serverSecret)}
      )
    `;

    // A `demo_letters` row via the store, openable (past opening instant) so the
    // opening row below can be recorded through the POST route.
    const demoSealed = await sealOne({ opensAt: "2024-11-05T00:00:00.000Z" });
    await storePersonaLetter({
      envelope: demoSealed.sealResult.envelope,
      envelopeHash: demoSealed.sealResult.envelopeHash,
      serverSecret: demoSealed.serverSecret,
    });

    // An `openings` row, recorded through the POST route for the demo letter —
    // the only write path for openings. Open the demo letter to get its opening
    // key, encrypt an answer bound to its ID bytes, and POST it.
    const opened = await openLetter({
      envelope: demoSealed.sealResult.envelope,
      envelopeHash: demoSealed.sealResult.envelopeHash,
      serverSecret: demoSealed.serverSecret,
      backupKey: demoSealed.backupKey,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      throw new Error("expected the demo letter to open");
    }
    const record = await encryptOpeningRecord(
      opened.openingKey,
      demoSealed.letterIdBytes,
      { "q-fuel": { answer_type: "number", value: "2.89" } },
    );
    const openingRes = await postOpening(
      new Request("https://revenant.test/api/openings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          letterId: demoSealed.letterId,
          ciphertext: record.ciphertext,
          nonce: record.nonce,
        }),
      }),
    );
    expect(openingRes.status).toBe(201);

    // The three rows now exist, each identified by a stable predicate the raw
    // client can re-read after each failed write.
    type Row = Record<string, unknown>;

    /**
     * Prove a single row is immutable: read it, assert a parameterised UPDATE
     * and a parameterised DELETE each reject (the `revenant_forbid_change`
     * trigger raises), and after each rejection re-read the row and assert it
     * deep-equals the pre-attempt read. `readOne`, `attemptUpdate` and
     * `attemptDelete` all target the same single row by its key.
     */
    async function proveImmutable(opts: {
      readOne: () => Promise<Row[]>;
      attemptUpdate: () => Promise<unknown>;
      attemptDelete: () => Promise<unknown>;
    }): Promise<void> {
      const before = await opts.readOne();
      expect(before).toHaveLength(1);

      await expect(opts.attemptUpdate()).rejects.toThrow(/not allowed/);
      const afterUpdate = await opts.readOne();
      expect(afterUpdate).toEqual(before);

      await expect(opts.attemptDelete()).rejects.toThrow(/not allowed/);
      const afterDelete = await opts.readOne();
      expect(afterDelete).toEqual(before);
    }

    // letters: a harmless UPDATE (reusing the stored hash) and a DELETE by ID.
    await proveImmutable({
      readOne: () =>
        sql`SELECT * FROM letters WHERE id = ${realSealed.letterId}`,
      attemptUpdate: () =>
        sql`
          UPDATE letters
          SET envelope_hash = ${realSealed.sealResult.envelopeHash}
          WHERE id = ${realSealed.letterId}
        `,
      attemptDelete: () =>
        sql`DELETE FROM letters WHERE id = ${realSealed.letterId}`,
    });

    // demo_letters: same pattern against the stored persona row.
    await proveImmutable({
      readOne: () =>
        sql`SELECT * FROM demo_letters WHERE id = ${demoSealed.letterId}`,
      attemptUpdate: () =>
        sql`
          UPDATE demo_letters
          SET envelope_hash = ${demoSealed.sealResult.envelopeHash}
          WHERE id = ${demoSealed.letterId}
        `,
      attemptDelete: () =>
        sql`DELETE FROM demo_letters WHERE id = ${demoSealed.letterId}`,
    });

    // openings: identify the single row by its demo letter, then prove it too
    // is immutable. The UPDATE re-sets the nonce to its own value.
    await proveImmutable({
      readOne: () =>
        sql`SELECT * FROM openings WHERE demo_letter_id = ${demoSealed.letterId}`,
      attemptUpdate: () =>
        sql`
          UPDATE openings
          SET nonce = nonce
          WHERE demo_letter_id = ${demoSealed.letterId}
        `,
      attemptDelete: () =>
        sql`DELETE FROM openings WHERE demo_letter_id = ${demoSealed.letterId}`,
    });
  });
});
