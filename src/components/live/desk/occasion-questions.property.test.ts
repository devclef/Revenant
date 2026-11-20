// Feature: 14-write-desk, Property 3 (design.md "Correctness Properties").
//
// Occasion picks on /demo/live never change the letter text or a row the
// author typed. `applyOccasionQuestions` returns no text at all, so the desk
// can pass the letter through unchanged. Rows the author typed, or a suggestion
// they added, keep their relative order. A row changes only when it was empty,
// missing, or still the question the previous Occasion put at that position.
//
// Validates: Requirements W3.3, W3.4, W8.3, Q2.1.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  applyOccasionQuestions,
  DEFAULT_QUESTION,
  OCCASIONS,
  OCCASION_QUESTIONS_MAX,
  type OccasionId,
  type OccasionQuestionsDraft,
} from "../occasions";

const OCCASION_IDS: readonly OccasionId[] = OCCASIONS.map((o) => o.id);
const ALL_OCCASION_QUESTIONS: readonly string[] = OCCASIONS.flatMap(
  (o) => o.questions,
);

function questionsOf(id: OccasionId): readonly string[] {
  const found = OCCASIONS.find((o) => o.id === id);
  if (!found) throw new Error(`no occasion ${id}`);
  return found.questions;
}

/** A row the author typed: non-empty after trim, not the applied question. */
function isTyped(row: string, applied: readonly string[], index: number) {
  return row.trim() !== "" && row !== applied[index];
}

/** True when `needle` appears in `haystack` in the same relative order. */
function isSubsequence(needle: readonly string[], haystack: readonly string[]) {
  let at = 0;
  for (const item of haystack) {
    if (at < needle.length && item === needle[at]) at += 1;
  }
  return at === needle.length;
}

const letterTextArb = fc.oneof(
  fc.constant(""),
  fc.constant("   "),
  fc.string({ maxLength: 200 }),
  fc.constantFrom(...OCCASIONS.map((o) => o.starter)),
);

const rowArb = fc.oneof(
  fc.constant(""),
  fc.constant("   "),
  fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim() !== ""),
  fc.constantFrom(...ALL_OCCASION_QUESTIONS, DEFAULT_QUESTION),
);

const startDraftArb = fc.record({
  questions: fc.array(rowArb, {
    minLength: 0,
    maxLength: OCCASION_QUESTIONS_MAX,
  }),
  occasion: fc.constantFrom(...OCCASION_IDS),
});

const picksArb = fc.array(fc.constantFrom(...OCCASION_IDS), {
  minLength: 1,
  maxLength: 5,
});

describe("applyOccasionQuestions (Property 3, spec 14 W3.3, W3.4, W8.3)", () => {
  it("never changes a typed row, never changes the letter text, and keeps 1 to 3 rows", () => {
    fc.assert(
      fc.property(
        letterTextArb,
        startDraftArb,
        picksArb,
        (text, start, picks) => {
          let draft: OccasionQuestionsDraft = {
            questions: [...start.questions],
            occasion: start.occasion,
            appliedQuestions: questionsOf(start.occasion),
          };

          for (const pick of picks) {
            const kept = draft.questions.filter((row, index) =>
              isTyped(row, draft.appliedQuestions, index),
            );

            const next = { text, ...applyOccasionQuestions(draft, pick) };

            // The letter text passes through unchanged, and the function
            // itself returns no text field.
            expect(next.text).toBe(text);
            expect(
              Object.keys(applyOccasionQuestions(draft, pick)),
            ).not.toContain("text");

            // Every typed row is still present, in the same relative order.
            expect(isSubsequence(kept, next.questions)).toBe(true);

            // Every row now shown is a typed row or a question of the picked
            // Occasion (the default question is the first of each).
            const pickedQuestions = questionsOf(pick);
            for (const row of next.questions) {
              expect(kept.includes(row) || pickedQuestions.includes(row)).toBe(
                true,
              );
            }

            expect(next.questions.length).toBeGreaterThanOrEqual(1);
            expect(next.questions.length).toBeLessThanOrEqual(
              OCCASION_QUESTIONS_MAX,
            );
            expect(next.occasion).toBe(pick);
            expect(next.appliedQuestions).toEqual(pickedQuestions);

            draft = {
              questions: next.questions,
              occasion: next.occasion,
              appliedQuestions: next.appliedQuestions,
            };
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it("takes the chosen Occasion's question into an empty or untouched row", () => {
    const work = questionsOf("work");
    const result = applyOccasionQuestions(
      {
        questions: [DEFAULT_QUESTION, "", ""],
        occasion: "blank",
        appliedQuestions: questionsOf("blank"),
      },
      "work",
    );
    expect(result.questions).toEqual(work);
  });

  it("keeps a typed row in place when the Occasion changes; an untouched row takes the new Occasion's question", () => {
    const typed = "What did the boiler quote say when I wrote this?";
    const result = applyOccasionQuestions(
      {
        questions: [questionsOf("work")[0], typed],
        occasion: "work",
        appliedQuestions: questionsOf("work"),
      },
      "family",
    );
    // Row 0 is untouched and takes family's default question. Row 1 keeps the
    // typed text. Family has one default, so no third row is added, exactly as
    // applyOccasion does for /seal.
    expect(result.questions).toEqual([questionsOf("family")[0], typed]);
  });

  it("never returns an empty list, even when every row is blank", () => {
    const result = applyOccasionQuestions(
      { questions: [], occasion: "blank", appliedQuestions: [] },
      "blank",
    );
    expect(result.questions).toEqual([DEFAULT_QUESTION]);
  });
});
