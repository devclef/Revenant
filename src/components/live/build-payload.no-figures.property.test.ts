// Property 9: letters with no official figures seal as v1 (spec 11-any-letter,
// design.md; L1.1, L1.7).
//
// With no official figure chosen, buildLivePayload still returns a format
// version 1 payload that payloadV1Schema accepts. Its recall questions are the
// author's questions as v1 "text" items, in order, and its metrics and figures
// hold only the self-reported entries (empty when there are none).
//
// buildLivePayload takes no mode argument, so demo and real mode cannot change
// the payload. The property runs the same input under both mode labels and
// checks that the two results are equal.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { payloadV1Schema, type PayloadV1 } from "@/lib/seal-format";

import { buildLivePayload } from "./build-payload";
import { questionRowProblem, questionsForSeal } from "./author-questions";
import { makeFigures } from "./test-figures";
import type { SelfReportedRow } from "./write-draft";

const SEALED_DATE = "2026-11-11";
const SEALED_AT = "2026-11-11T09:00:00.000Z";
const MODES = ["demo", "real"] as const;
const NO_FIGURES = makeFigures([]);

// One to three author questions: non-empty after trimming, at most 200 code
// points, passed through questionsForSeal as the form does.
const questionArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 80 })
  .filter((text) => text.trim().length > 0 && questionRowProblem(text) === null);

const questionsArb: fc.Arbitrary<string[]> = fc
  .array(questionArb, { minLength: 1, maxLength: 3 })
  .map((rows) => questionsForSeal(rows))
  .filter((rows) => rows.length >= 1 && rows.length <= 3);

// A valid self-reported row: every text field non-empty after trimming, and a
// value that matches the figure number shape.
const textArb = fc.stringMatching(/^[A-Za-z][A-Za-z ]{0,18}[A-Za-z]$/);

const valueArb: fc.Arbitrary<string> = fc
  .tuple(fc.integer({ min: 0, max: 9999 }), fc.integer({ min: 0, max: 99 }))
  .map(([whole, cents]) => `${whole}.${cents < 10 ? "0" : ""}${cents}`);

const rowArb: fc.Arbitrary<SelfReportedRow> = fc.record({
  name: textArb,
  value: valueArb,
  unit: fc.constantFrom("per month", "USD per month"),
  region: fc.constantFrom("My city", "Home"),
  period: fc.constantFrom("2026-08", "2026-09", "2026-10"),
});

const rowsArb: fc.Arbitrary<SelfReportedRow[]> = fc.array(rowArb, { minLength: 0, maxLength: 10 });

function build(mode: (typeof MODES)[number], questions: string[], rows: SelfReportedRow[]): PayloadV1 {
  void mode; // buildLivePayload has no mode input; see the file header.
  const result = buildLivePayload({
    text: "A letter with no official figures.",
    metricIds: [],
    authorQuestions: questions,
    sealedDate: SEALED_DATE,
    figures: NO_FIGURES,
    selfReported: rows,
    sealedAt: SEALED_AT,
  });
  if (!result.ok) throw new Error(`unexpected ${result.metricId}`);
  return result.payload;
}

describe("Property 9: letters with no official figures seal as v1", () => {
  it("builds a schema-valid version 1 payload with the questions as text items, in both modes", () => {
    fc.assert(
      fc.property(questionsArb, rowsArb, (questions, rows) => {
        const payloadsByMode = MODES.map((mode) => build(mode, questions, rows));

        // Same result in demo and real mode.
        expect(payloadsByMode[0]).toEqual(payloadsByMode[1]);

        const payload = payloadsByMode[0];
        expect(payloadV1Schema.safeParse(payload).success).toBe(true);
        expect(payload.format_version).toBe(1);
        expect(payload).not.toHaveProperty("written_as_of");

        // The questions, in order, as v1 text items with no metric_id.
        expect(payload.recall_questions).toEqual(
          questions.map((text, i) => ({ id: `a${i + 1}`, answer_type: "text", text })),
        );

        // Metrics and figures hold only the self-reported entries.
        expect(payload.metrics).toHaveLength(rows.length);
        expect(payload.figures).toHaveLength(rows.length);
        payload.figures.forEach((figure, i) => {
          expect(figure.kind).toBe("self-reported");
          expect(figure.metric_id).toBe(`self-${i + 1}`);
          expect(payload.metrics[i].id).toBe(`self-${i + 1}`);
          expect(payload.metrics[i].source).toBe("self-reported");
        });
      }),
      { numRuns: 100 },
    );
  });
});

describe("letters with no official figures: examples", () => {
  it("seals 0 official figures with 1 to 3 questions in both modes as v1 text questions", () => {
    for (const mode of MODES) {
      const one = build(mode, ["Who did you tell first?"], []);
      expect(one).toEqual({
        format_version: 1,
        letter_text: "A letter with no official figures.",
        metrics: [],
        figures: [],
        recall_questions: [{ id: "a1", answer_type: "text", text: "Who did you tell first?" }],
      });

      const three = build(mode, ["First question.", "Second question.", "Third question."], []);
      expect(three.recall_questions.map((q) => q.id)).toEqual(["a1", "a2", "a3"]);
      expect(payloadV1Schema.safeParse(three).success).toBe(true);
    }
  });

  it("seals a self-reported-only letter with a question as a schema-valid v1 payload in both modes", () => {
    const rows: SelfReportedRow[] = [
      { name: "Rent", value: "950.50", unit: "per month", region: "My city", period: "2026-09" },
    ];
    for (const mode of MODES) {
      const payload = build(mode, ["What did the rent feel like?"], rows);
      expect(payloadV1Schema.safeParse(payload).success).toBe(true);
      expect(payload).toEqual({
        format_version: 1,
        letter_text: "A letter with no official figures.",
        metrics: [
          {
            id: "self-1",
            display_name: "Rent",
            unit: "per month",
            region: "My city",
            source: "self-reported",
            series_id: "self-reported",
          },
        ],
        figures: [
          {
            kind: "self-reported",
            metric_id: "self-1",
            value: "950.50",
            unit: "per month",
            region: "My city",
            period: "2026-09",
            source: "self-reported",
            series_id: "self-reported",
            retrieved_at: SEALED_AT,
          },
        ],
        recall_questions: [{ id: "a1", answer_type: "text", text: "What did the rent feel like?" }],
      });
    }
  });
});
