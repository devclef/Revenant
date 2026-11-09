// Property 4: Author_Questions are sealed as v1 text questions, first
// (spec 10, C2.7, C2.8, C2.9).
//
// buildLivePayload turns the trimmed Author_Question rows into text questions
// `a1`… with no metric_id, placed before the generator's `q1`… questions. The
// payload must pass payloadV1Schema. A Real_Letter with no figures and one to
// three questions is also a valid letter (C2.9).

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { payloadV1Schema } from "@/lib/seal-format";
import type { LoadedFigures } from "@/lib/figures";

import { questionsForSeal } from "./author-questions";
import { buildLivePayload } from "./build-payload";
import { RECALL_SUBJECTS } from "./recall-subjects";
import {
  catalogueMetric,
  fixtureMetric,
  makeFigures,
  type SeriesInput,
} from "./test-figures";

const SEALED_DATE = "2026-11-02";
const LISTABLE_IDS = Object.keys(RECALL_SUBJECTS);

function metricFor(id: string) {
  return id.startsWith("fixture-") ? fixtureMetric(id) : catalogueMetric(id);
}

// Every listable series gets one figure on or before the sealing day, so each
// selected metric has a then figure.
function figuresFor(ids: readonly string[]): LoadedFigures {
  const entries: SeriesInput[] = ids.map((id) => ({
    metric: metricFor(id),
    figures: [{ period: "2026-10-05", value: "3.412" }],
  }));
  return makeFigures(entries);
}

// A code point from anywhere in Unicode except surrogates.
const codePointArb = fc
  .integer({ min: 0, max: 0x10ffff })
  .filter((n) => n < 0xd800 || n > 0xdfff);

// A row as typed: up to 200 code points with surrounding whitespace allowed.
const rowArb: fc.Arbitrary<string> = fc
  .array(codePointArb, { minLength: 0, maxLength: 200 })
  .map((codePoints) => String.fromCodePoint(...codePoints));

// 0 to 3 rows as typed, kept as trimmed rows the way the seal step passes them.
const questionsArb: fc.Arbitrary<string[]> = fc
  .array(rowArb, { minLength: 0, maxLength: 3 })
  .map((rows) => questionsForSeal(rows));

// 1 to 6 listable ids, in a random order.
const selectionArb: fc.Arbitrary<string[]> = fc.uniqueArray(
  fc.constantFrom(...LISTABLE_IDS),
  {
    minLength: 1,
    maxLength: 6,
  },
);

const letterTextArb = fc.constant("Dear future me, a short letter.");

function checkSealedOrder(
  questions: readonly string[],
  recall: readonly {
    id: string;
    answer_type: string;
    text: string;
    metric_id?: string;
  }[],
): void {
  // The author questions come first, in order, as text with no metric_id.
  questions.forEach((text, i) => {
    expect(recall[i]).toEqual({ id: `a${i + 1}`, answer_type: "text", text });
    expect(recall[i]).not.toHaveProperty("metric_id");
  });

  // The generator's questions follow, with their own ids (q1…).
  for (const generated of recall.slice(questions.length)) {
    expect(generated.id).toMatch(/^q\d+$/);
  }

  // Every id is unique across the whole list.
  const ids = recall.map((q) => q.id);
  expect(new Set(ids).size).toBe(ids.length);
}

describe("Property 4: Author_Questions are sealed as v1 text questions, first", () => {
  it("passes payloadV1Schema, with the author text first and the generator's q-questions after it", () => {
    fc.assert(
      fc.property(
        questionsArb,
        selectionArb,
        letterTextArb,
        (questions, ids, text) => {
          const figures = figuresFor(ids);
          const result = buildLivePayload({
            text,
            metricIds: ids,
            authorQuestions: questions,
            sealedDate: SEALED_DATE,
            figures,
          });
          expect(result.ok).toBe(true);
          if (!result.ok) return;

          const parsed = payloadV1Schema.safeParse(result.payload);
          expect(parsed.success).toBe(true);
          expect(result.payload.format_version).toBe(1);

          checkSealedOrder(questions, result.payload.recall_questions);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("a Real_Letter with 0 figures and 1 to 3 questions passes payloadV1Schema", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }).chain((n) =>
          fc.array(
            rowArb.filter((row) => row.trim().length > 0),
            { minLength: n, maxLength: n },
          ),
        ),
        letterTextArb,
        (rows, text) => {
          const questions = questionsForSeal(rows);
          const result = buildLivePayload({
            text,
            metricIds: [],
            authorQuestions: questions,
            sealedDate: SEALED_DATE,
            figures: makeFigures([]),
          });
          expect(result.ok).toBe(true);
          if (!result.ok) return;

          expect(payloadV1Schema.safeParse(result.payload).success).toBe(true);
          expect(result.payload.figures).toHaveLength(0);
          checkSealedOrder(questions, result.payload.recall_questions);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("Author_Questions example cases", () => {
  it("a 0-figure Real_Letter with one question passes payloadV1Schema", () => {
    const result = buildLivePayload({
      text: "Written before the opening.",
      metricIds: [],
      authorQuestions: ["What do you want to remember?"],
      sealedDate: SEALED_DATE,
      figures: makeFigures([]),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const parsed = payloadV1Schema.safeParse(result.payload);
    expect(parsed.success).toBe(true);
    expect(result.payload.recall_questions).toEqual([
      { id: "a1", answer_type: "text", text: "What do you want to remember?" },
    ]);
  });
});
