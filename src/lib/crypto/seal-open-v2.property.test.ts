import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { sealLetter } from "./seal";
import { openLetter } from "./open";
import { generateBackupKey } from "./backup-key";
import type { PayloadV2 } from "../seal-format";

// Feature: 15-the-flow, format version 2, Property 1: a version 2 payload
// round-trips through sealLetter and openLetter unchanged. WebCrypto only.

const SEALED_AT = "2026-10-31T12:00:00.000Z";
const OPENS_AT = "2027-02-01T00:00:00.000Z";

function freshLetterId(): Uint8Array {
  const id = new Uint8Array(16);
  globalThis.crypto.getRandomValues(id);
  return id;
}

function freshServerSecret(): Uint8Array {
  const s = new Uint8Array(32);
  globalThis.crypto.getRandomValues(s);
  return s;
}

// Text that is not whitespace-only, 1-200 code points (kept short so runs stay fast).
const nonBlank = fc
  .string({ minLength: 1, maxLength: 200 })
  .filter((s) => s.trim().length > 0);

// A version 2 payload with 0-5 text questions, each with its sealed answer.
// Question ids are index-based so they are unique, as the schema requires.
const payloadV2Arbitrary: fc.Arbitrary<PayloadV2> = fc
  .record({
    letter_text: nonBlank,
    written_as_of: fc.option(fc.constant("2026-10-31"), { nil: undefined }),
    questions: fc.array(
      fc.record({
        text: nonBlank.filter((s) => s.length <= 500),
        sealed_answer: nonBlank,
      }),
      { minLength: 0, maxLength: 5 },
    ),
  })
  .map(({ letter_text, written_as_of, questions }) => ({
    format_version: 2 as const,
    letter_text,
    ...(written_as_of !== undefined ? { written_as_of } : {}),
    metrics: [],
    figures: [],
    recall_questions: questions.map((q, i) => ({
      id: `q${i}`,
      answer_type: "text" as const,
      text: q.text,
      sealed_answer: q.sealed_answer,
    })),
  }));

describe("Property 1: a version 2 payload round-trips through seal and open", () => {
  it("opens to exactly the payload that was sealed, for arbitrary text questions and answers", async () => {
    await fc.assert(
      fc.asyncProperty(payloadV2Arbitrary, async (payload) => {
        const letterId = freshLetterId();
        const serverSecret = freshServerSecret();
        const backupKey = generateBackupKey();

        const { envelope, envelopeHash } = await sealLetter({
          payload,
          letterId,
          serverSecret,
          backupKey,
          sealedAt: SEALED_AT,
          opensAt: OPENS_AT,
        });
        expect(envelope.formatVersion).toBe(2);

        const result = await openLetter({
          envelope,
          envelopeHash,
          serverSecret,
          backupKey,
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.payload).toEqual(payload);
        }
      }),
      { numRuns: 25 },
    );
  });
});
