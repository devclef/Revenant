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
});
