// Unit tests for `storePersonaLetter`, with the database fully mocked.
//
// These tests run with no Postgres: `@/lib/db/client` is replaced so `getDb`
// returns a spy whose `transaction`/`execute` record every call. The property
// below proves that a hash mismatch is rejected before any database access, so
// the spy must observe zero calls.
//
// Feature: 02-sealed-letters, Property 19

import fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { encodeBase64url } from "@/lib/seal-format/base64url";
import { envelopeHash } from "@/lib/seal-format";

// --- Mock the database client ------------------------------------------------
//
// `getDb` returns an object whose `transaction` and `execute` are spies. If the
// store touches the database at all, these record the call and the property's
// final assertion fails. They also throw, so a touched database can never be
// mistaken for a successful store.

const transactionSpy = vi.fn(() => {
  throw new Error("database must not be touched on a hash mismatch");
});
const executeSpy = vi.fn(() => {
  throw new Error("database must not be touched on a hash mismatch");
});

vi.mock("@/lib/db/client", () => ({
  getDb: vi.fn(() => ({
    transaction: transactionSpy,
    execute: executeSpy,
  })),
}));

// Import after the mock is registered. `storePersonaLetter` is server-only but
// the `typeof window` guard is a no-op under the `node` test environment.
import { storePersonaLetter, LetterStoreError } from "./store";
import { getDb } from "@/lib/db/client";

// --- A valid envelope, varied across its mutable header fields ---------------
//
// Base header from the golden v1 fixture. The opaque fields (ciphertext, nonce,
// wrapped DEK) are valid base64url of the required sizes, so varying only the
// letter ID and the two timestamps keeps every header the schema accepts.
const BASE_ENVELOPE = {
  formatVersion: 1,
  letterId: "AAECAwQFBgcICQoLDA0ODw",
  opensAt: "2027-02-01T00:00:00.000Z",
  payloadCiphertext: "REREREREREREREREREREREREREREREREREREREREREQ",
  payloadNonce: "MzMzMzMzMzMzMzMz",
  sealedAt: "2026-10-31T12:00:00.000Z",
  wrappedDeks: [
    {
      factor: "backup",
      nonce: "ERERERERERERERER",
      wrappedKey:
        "IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIi",
    },
  ],
} as const;

/** An arbitrary 22-char canonical base64url letter ID (16 random bytes). */
const letterIdArb = fc
  .uint8Array({ minLength: 16, maxLength: 16 })
  .map((bytes) => encodeBase64url(bytes));

/** A millisecond-Z timestamp, in the canonical `toISOString()` form. */
const millisecondZArb = fc
  .integer({ min: 0, max: 4_102_444_800_000 }) // 1970-01-01 .. 2100-01-01
  .map((ms) => new Date(ms).toISOString());

/** A valid v1 envelope with a varying letter ID and sealing/opening instants. */
const envelopeArb = fc
  .record({
    letterId: letterIdArb,
    sealedAt: millisecondZArb,
    opensAt: millisecondZArb,
  })
  .map((fields) => ({ ...BASE_ENVELOPE, ...fields }));

/** 64 lowercase hex characters: the shape of an envelope hash. */
const hexHashArb = fc
  .array(fc.integer({ min: 0, max: 15 }), { minLength: 64, maxLength: 64 })
  .map((nibbles) => nibbles.map((n) => n.toString(16)).join(""));

/** A valid 32-byte server secret, so the hash check is the one that fires. */
const serverSecretArb = fc
  .uint8Array({ minLength: 32, maxLength: 32 })
  .map((bytes) => new Uint8Array(bytes));

describe("storePersonaLetter — hash mismatch (Property 19)", () => {
  beforeEach(() => {
    transactionSpy.mockClear();
    executeSpy.mockClear();
    vi.mocked(getDb).mockClear();
  });

  it("rejects any hash that differs from the envelope's real hash, without touching the database", async () => {
    await fc.assert(
      fc.asyncProperty(
        envelopeArb,
        hexHashArb,
        serverSecretArb,
        async (envelope, candidateHash, serverSecret) => {
          const realHash = await envelopeHash(envelope);
          // Only exercise the mismatch case; a chance collision is skipped.
          fc.pre(candidateHash !== realHash);

          let thrown: unknown;
          try {
            await storePersonaLetter({
              envelope,
              envelopeHash: candidateHash,
              serverSecret,
            });
          } catch (error) {
            thrown = error;
          }

          expect(thrown).toBeInstanceOf(LetterStoreError);
          expect((thrown as LetterStoreError).check).toBe("hash_mismatch");

          // The core of the property: the database was never reached.
          expect(getDb).not.toHaveBeenCalled();
          expect(transactionSpy).not.toHaveBeenCalled();
          expect(executeSpy).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });
});
