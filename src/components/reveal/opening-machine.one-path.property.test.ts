// Feature: 10-own-questions, Property 7
//
// Property: opening goes straight to Testify on one path. For any opened
// payload, OPENED from `verifying` (persona) and OPENED from `unlocking` (live)
// give the same next state. That state is `open_failed` with `invalid_payload`
// when the payload has more than TEXT_ANSWERS_MAX text questions (C3.9).
// Otherwise it is `recall` with one empty draft per question.
//
// The sample map (C5.4) is an input: OPENED carries the samples, and each
// number question's draft starts from its Sample_Answer. The first property
// checks the empty-draft case; the samples case is checked below it.
//
// Validates: Requirements C1.1, C1.2, C3.9.

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { PayloadV1 } from "@/lib/seal-format";
import { TEXT_ANSWERS_MAX } from "@/lib/recall/limits";
import {
  reduce,
  type FlowState,
  type Opened,
} from "./opening-machine";

const UNLOCKING: FlowState = {
  tag: "unlocking",
  envelope: {},
  envelopeHash: "h",
  unlock: { passkey: null, backup: true },
};

const KIND = fc.constantFrom("text" as const, "number" as const);

/** A payload whose recall questions follow the generated kinds, in order. */
function openedFor(kinds: ("text" | "number")[]): Opened {
  const recall_questions = kinds.map((kind, i) =>
    kind === "text"
      ? { id: `t${i}`, answer_type: "text", text: "Author question" }
      : {
          id: `n${i}`,
          answer_type: "number",
          text: "Number question",
          metric_id: "m1",
        },
  );
  const payload = { recall_questions } as unknown as PayloadV1;
  return {
    letterId: "abc123",
    header: {
      sealedAt: "2024-05-01T00:00:00.000Z",
      opensAt: "2024-06-01T00:00:00.000Z",
    },
    payload,
    openingKey: {} as unknown as CryptoKey,
    envelopeHash:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  };
}

describe("Property 7: opening goes straight to Testify on one path", () => {
  it("gives the same state from both arms and applies the text cap", () => {
    fc.assert(
      fc.property(fc.array(KIND, { maxLength: 8 }), (kinds) => {
        const opened = openedFor(kinds);
        const viaVerify = reduce(
          { tag: "verifying" },
          { type: "OPENED", opened },
        );
        const viaUnlock = reduce(UNLOCKING, { type: "OPENED", opened });
        expect(viaUnlock).toEqual(viaVerify);

        const textCount = kinds.filter((kind) => kind === "text").length;
        if (textCount > TEXT_ANSWERS_MAX) {
          expect(viaVerify).toEqual({
            tag: "open_failed",
            kind: "invalid_payload",
          });
          return;
        }

        expect(viaVerify.tag).toBe("recall");
        if (viaVerify.tag !== "recall") return;
        expect(Object.keys(viaVerify.drafts).sort()).toEqual(
          opened.payload.recall_questions.map((q) => q.id).sort(),
        );
        for (const draft of Object.values(viaVerify.drafts)) {
          expect(draft).toEqual({ text: "", noAnswer: false });
        }
      }),
      { numRuns: 100 },
    );
  });
});

// Property 7, extended with samples (spec 10 C5.4). A Sample_Answer for a number
// question seeds that question's draft; every other draft stays empty. Both
// OPENED arms give the same state, so the Sample_Pick never makes the path
// differ.
describe("Property 7 with samples: both arms seed the same drafts", () => {
  it("prefills only the number questions that have a sample", () => {
    fc.assert(
      fc.property(
        fc.array(KIND, { maxLength: 8 }),
        fc.array(fc.constantFrom("3.59", "1.20", "0.00"), { maxLength: 8 }),
        (kinds, values) => {
          const opened = openedFor(kinds);
          const samples: Record<string, string> = {};
          kinds.forEach((kind, i) => {
            const value = values[i];
            if (kind === "number" && value !== undefined) {
              samples[`n${i}`] = value;
            }
          });
          const viaVerify = reduce(
            { tag: "verifying" },
            { type: "OPENED", opened, samples },
          );
          const viaUnlock = reduce(UNLOCKING, {
            type: "OPENED",
            opened,
            samples,
          });
          expect(viaUnlock).toEqual(viaVerify);
          // More than TEXT_ANSWERS_MAX text questions goes to open_failed, which
          // has no drafts to seed (C3.9). Both arms still agree, checked above.
          if (viaVerify.tag !== "recall") {
            return;
          }
          for (const [id, text] of Object.entries(viaVerify.drafts)) {
            expect(text).toEqual({
              text: samples[id] ?? "",
              noAnswer: false,
            });
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
