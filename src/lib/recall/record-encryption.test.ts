import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  encryptOpeningRecord,
  decryptOpeningRecord,
  sealLetter,
  openLetter,
  parseBackupKey,
  PUBLIC_DEMO_BACKUP_KEY,
} from "@/lib/crypto";
import type { PayloadV1 } from "@/lib/seal-format";
import { recallRecordSchemaFor, type RecallRecordV1 } from "./record";

// Feature: 03-persona-demo — recall records survive encryption unchanged.
//
// A judge's recall answers (a Recall_Record) are encrypted in the browser with
// the per-letter opening key before they reach the server (crypto.md, R3.*).
// This file proves the round trip is lossless: encrypting a valid record and
// decrypting it with the same opening key, letter ID and record yields exactly
// the record that went in, as validated by the letter's bound schema.
//
// The opening key is obtained the way the design does it: seal a fresh letter
// with the PUBLIC demo backup key, then open it (openLetter) to get the
// non-extractable openingKey CryptoKey. WebCrypto runs under the node test
// environment via globalThis.crypto.

// --- Opening-key fixture ----------------------------------------------------

const SEALED_AT = "2026-10-31T12:00:00.000Z";
const OPENS_AT = "2027-02-01T00:00:00.000Z";

/** A fresh 16-byte letter ID. */
function freshLetterId(): Uint8Array {
  const id = new Uint8Array(16);
  globalThis.crypto.getRandomValues(id);
  return id;
}

/** A fresh 32-byte server secret. */
function freshServerSecret(): Uint8Array {
  const s = new Uint8Array(32);
  globalThis.crypto.getRandomValues(s);
  return s;
}

/** A minimal valid v1 payload (empty figure/metric/question lists). */
function minimalPayload(): PayloadV1 {
  return {
    format_version: 1,
    letter_text: "a letter sealed to obtain an opening key",
    metrics: [],
    figures: [],
    recall_questions: [],
  };
}

/** The parsed public demo backup key (for demo letters only). */
function demoBackupKey() {
  const parsed = parseBackupKey(PUBLIC_DEMO_BACKUP_KEY);
  if (!parsed.ok) {
    throw new Error("the public demo backup key must parse");
  }
  return parsed.key;
}

/**
 * Seal a fresh letter with the demo backup key and open it to obtain the
 * per-letter opening key and the exact letter ID bytes that key is bound to.
 * This mirrors how the Opening_Flow gets the opening key in the design.
 */
async function freshOpeningKey(): Promise<{
  openingKey: CryptoKey;
  letterId: Uint8Array;
}> {
  const letterId = freshLetterId();
  const serverSecret = freshServerSecret();
  const backupKey = demoBackupKey();

  const { envelope, envelopeHash } = await sealLetter({
    payload: minimalPayload(),
    letterId,
    serverSecret,
    backupKey,
    sealedAt: SEALED_AT,
    opensAt: OPENS_AT,
  });

  const result = await openLetter({
    envelope,
    envelopeHash,
    serverSecret,
    backupKey,
  });
  if (!result.ok) {
    throw new Error(`openLetter failed: ${result.error.kind}`);
  }
  return { openingKey: result.openingKey, letterId };
}

// --- Generators -------------------------------------------------------------

/** A valid R3.3 number string: 1-40 chars, digits with optional `.digits`. */
const validNumberArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.array(fc.constantFrom(..."0123456789".split("")), {
      minLength: 1,
      maxLength: 20,
    }),
    fc.option(
      fc.array(fc.constantFrom(..."0123456789".split("")), {
        minLength: 1,
        maxLength: 19,
      }),
      { nil: null },
    ),
  )
  .map(([intPart, fracPart]) => {
    const head = intPart.join("");
    const tail = fracPart === null ? "" : `.${fracPart.join("")}`;
    return head + tail;
  })
  .filter((s) => s.length <= 40);

/** 1-20 distinct question ids, `q1`..`qN`. */
const idsArb: fc.Arbitrary<string[]> = fc
  .integer({ min: 1, max: 20 })
  .map((n) => Array.from({ length: n }, (_, i) => `q${i + 1}`));

/** One valid answer entry for a question id. */
const answerForArb = (id: string) =>
  fc.oneof(
    validNumberArb.map(
      (value) => ({ question_id: id, kind: "number", value }) as const,
    ),
    fc.constant({ question_id: id, kind: "no_answer" } as const),
  );

/** A valid Recall_Record: exactly one answer per id, in id order. */
const validRecordArb: fc.Arbitrary<{
  ids: string[];
  record: RecallRecordV1;
}> = idsArb.chain((ids) =>
  fc
    .tuple(...ids.map((id) => answerForArb(id)))
    .map((answers) => ({
      ids,
      record: { version: 1 as const, answers: [...answers] },
    })),
);

// --- Property 11 ------------------------------------------------------------

// Feature: 03-persona-demo, Property 11: Recall records survive encryption unchanged
describe("Property 11: Recall records survive encryption unchanged", () => {
  it("encrypt then decrypt round-trips any valid record under its bound schema", async () => {
    await fc.assert(
      fc.asyncProperty(validRecordArb, async ({ ids, record }) => {
        const { openingKey, letterId } = await freshOpeningKey();

        const box = await encryptOpeningRecord(openingKey, letterId, record);
        const decrypted = await decryptOpeningRecord(openingKey, letterId, box);
        const parsed = recallRecordSchemaFor(ids).parse(decrypted);

        expect(parsed).toEqual(record);
      }),
      { numRuns: 25 },
    );
  });
});
