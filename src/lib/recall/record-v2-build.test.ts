import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { buildRecallRecordV2, type BoundQuestion } from "./record-v2";
import { recallRecordV2SchemaFor } from "./record-v2";
import type { Draft } from "./record";
import { TEXT_ANSWERS_MAX, TEXT_ANSWER_MAX_CODE_POINTS } from "./limits";
import { payloadV1Schema } from "@/lib/seal-format";
import {
  PAYLOAD_NO_FIGURES_TEXT_2,
  PAYLOAD_TEXT_0,
  PAYLOAD_TEXT_1,
  PAYLOAD_TEXT_2,
  PAYLOAD_TEXT_3,
  PAYLOAD_TEXT_4,
} from "./fixtures.test-data";

// Feature: 10-own-questions, Property 11: Building the record keeps what was
// submitted. Requirements C3.4, C3.8, C4.6, C5.8, C5.11, S2.4.
//
// The oracle below is written from the rules in the spec, not from the builder.

const NUMBER_RULE = /^[0-9]+(\.[0-9]+)?$/;

type Outcome =
  | { ok: true; answers: Record<string, unknown>[] }
  | { ok: false; invalid: string[] };

/** The written rules for one submission, applied in question order. */
function expectedOutcome(
  questions: readonly BoundQuestion[],
  drafts: Readonly<Record<string, Draft>>,
  samples: Readonly<Record<string, string>>,
): Outcome {
  const answers: Record<string, unknown>[] = [];
  const invalid: string[] = [];
  let texts = 0;

  for (const q of questions) {
    const draft = drafts[q.id];
    if (draft?.noAnswer) {
      answers.push({ question_id: q.id, kind: "no_answer" });
      continue;
    }
    const text = (draft?.text ?? "").trim();

    if (q.answer_type === "text") {
      const ok =
        text.length > 0 &&
        [...text].length <= TEXT_ANSWER_MAX_CODE_POINTS &&
        texts < TEXT_ANSWERS_MAX;
      if (!ok) {
        invalid.push(q.id);
        continue;
      }
      texts += 1;
      answers.push({ question_id: q.id, kind: "text", value: text });
      continue;
    }

    if (!NUMBER_RULE.test(text) || text.length > 40) {
      invalid.push(q.id);
      continue;
    }
    const answer: Record<string, unknown> = {
      question_id: q.id,
      kind: "number",
      value: text,
    };
    if (samples[q.id] !== undefined && samples[q.id] === text) {
      answer.sample = true;
    }
    answers.push(answer);
  }

  return invalid.length > 0 ? { ok: false, invalid } : { ok: true, answers };
}

const TEXT_SAMPLES = [
  " hi ",
  "   ",
  "",
  "x".repeat(TEXT_ANSWER_MAX_CODE_POINTS),
  "x".repeat(TEXT_ANSWER_MAX_CODE_POINTS + 1),
  "🙂".repeat(TEXT_ANSWER_MAX_CODE_POINTS),
  "🙂".repeat(TEXT_ANSWER_MAX_CODE_POINTS + 1),
  "a note about the van",
];

const NUMBER_SAMPLES = [
  "3.59",
  "3",
  "03.50",
  "3.590",
  "3,59",
  "",
  " 3.59 ",
  "1".repeat(41),
];

const questionsArb: fc.Arbitrary<BoundQuestion[]> = fc
  .uniqueArray(fc.constantFrom("a1", "a2", "a3", "a4", "q1", "q2", "q3"), {
    maxLength: 7,
  })
  .map((ids) =>
    ids.map((id) => ({
      id,
      answer_type: id.startsWith("a") ? ("text" as const) : ("number" as const),
    })),
  );

const draftArb: fc.Arbitrary<Draft | undefined> = fc.option(
  fc.record({
    text: fc.oneof(
      fc.constantFrom(...TEXT_SAMPLES),
      fc.constantFrom(...NUMBER_SAMPLES),
      fc.string({ maxLength: 12 }),
    ),
    noAnswer: fc.boolean(),
  }),
  { nil: undefined },
) as fc.Arbitrary<Draft | undefined>;

describe("buildRecallRecordV2 — Property 11", () => {
  it("returns exactly the outcome the written rules give, and never mutates the drafts", () => {
    fc.assert(
      fc.property(
        questionsArb,
        fc.array(draftArb, { minLength: 7, maxLength: 7 }),
        fc.array(
          fc.option(fc.constantFrom(...NUMBER_SAMPLES.slice(0, 4)), {
            nil: undefined,
          }),
          {
            minLength: 7,
            maxLength: 7,
          },
        ),
        (questions, draftList, sampleList) => {
          const drafts: Record<string, Draft> = {};
          questions.forEach((q, i) => {
            const d = draftList[i];
            if (d !== undefined) drafts[q.id] = d;
          });
          const samples: Record<string, string> = {};
          questions.forEach((q, i) => {
            const s = sampleList[i];
            if (s !== undefined) samples[q.id] = s;
          });

          const before = JSON.parse(JSON.stringify(drafts));
          const actual = buildRecallRecordV2(questions, drafts, samples);
          expect(drafts).toEqual(before);

          const expected = expectedOutcome(questions, drafts, samples);
          if (!expected.ok) {
            expect(actual).toEqual({ ok: false, invalid: expected.invalid });
            return;
          }

          expect(actual.ok).toBe(true);
          if (!actual.ok) return;
          expect(actual.record).toEqual({
            version: 2,
            answers: expected.answers,
          });
          // Every built record must pass the bound schema on its own.
          expect(
            recallRecordV2SchemaFor(questions).safeParse(actual.record).success,
          ).toBe(true);
        },
      ),
      { numRuns: 400 },
    );
  });
});

describe("buildRecallRecordV2 — rules by example", () => {
  const q: BoundQuestion[] = [
    { id: "a1", answer_type: "text" },
    { id: "q1", answer_type: "number" },
    { id: "q2", answer_type: "number" },
  ];

  it("trims text and keeps the number as typed apart from the trim", () => {
    const result = buildRecallRecordV2(
      q,
      {
        a1: { text: "  Mostly the move.  ", noAnswer: false },
        q1: { text: " 03.50 ", noAnswer: false },
        q2: { text: "", noAnswer: true },
      },
      {},
    );
    expect(result).toEqual({
      ok: true,
      record: {
        version: 2,
        answers: [
          { question_id: "a1", kind: "text", value: "Mostly the move." },
          { question_id: "q1", kind: "number", value: "03.50" },
          { question_id: "q2", kind: "no_answer" },
        ],
      },
    });
  });

  it("sets sample only when the submitted number equals the sample exactly", () => {
    const kept = buildRecallRecordV2(
      q,
      {
        a1: { text: "x", noAnswer: false },
        q1: { text: " 3.59 ", noAnswer: false },
        q2: { text: "3.590", noAnswer: false },
      },
      { q1: "3.59", q2: "3.59" },
    );
    expect(kept).toEqual({
      ok: true,
      record: {
        version: 2,
        answers: [
          { question_id: "a1", kind: "text", value: "x" },
          { question_id: "q1", kind: "number", value: "3.59", sample: true },
          { question_id: "q2", kind: "number", value: "3.590" },
        ],
      },
    });
  });

  it("never flags a text answer as a sample, even one equal to a sample", () => {
    const result = buildRecallRecordV2(
      [{ id: "a1", answer_type: "text" }],
      { a1: { text: "3.59", noAnswer: false } },
      { a1: "3.59" },
    );
    expect(result).toEqual({
      ok: true,
      record: {
        version: 2,
        answers: [{ question_id: "a1", kind: "text", value: "3.59" }],
      },
    });
  });

  it("returns every invalid question ID in order and nothing else", () => {
    const result = buildRecallRecordV2(
      q,
      {
        a1: { text: "   ", noAnswer: false },
        q1: { text: "3,59", noAnswer: false },
        q2: { text: "2", noAnswer: false },
      },
      {},
    );
    expect(result).toEqual({ ok: false, invalid: ["a1", "q1"] });
  });

  it("treats a question with no draft as empty and invalid", () => {
    expect(buildRecallRecordV2(q, {}, {})).toEqual({
      ok: false,
      invalid: ["a1", "q1", "q2"],
    });
  });

  it("accepts a text answer of exactly 1,000 code points and rejects 1,001", () => {
    const ok = buildRecallRecordV2(
      [{ id: "a1", answer_type: "text" }],
      {
        a1: { text: "🙂".repeat(TEXT_ANSWER_MAX_CODE_POINTS), noAnswer: false },
      },
      {},
    );
    const tooLong = buildRecallRecordV2(
      [{ id: "a1", answer_type: "text" }],
      {
        a1: {
          text: "🙂".repeat(TEXT_ANSWER_MAX_CODE_POINTS + 1),
          noAnswer: false,
        },
      },
      {},
    );
    expect(ok.ok).toBe(true);
    expect(tooLong).toEqual({ ok: false, invalid: ["a1"] });
  });

  it("marks a fourth text answer invalid (C3.3)", () => {
    const four: BoundQuestion[] = ["a1", "a2", "a3", "a4"].map((id) => ({
      id,
      answer_type: "text",
    }));
    const drafts = Object.fromEntries(
      four.map((x) => [x.id, { text: "x", noAnswer: false }]),
    );
    expect(buildRecallRecordV2(four, drafts, {})).toEqual({
      ok: false,
      invalid: ["a4"],
    });
  });
});

describe("text-question fixtures (G3.1)", () => {
  const fixtures = [
    ["0 text questions", PAYLOAD_TEXT_0, 0],
    ["1 text question", PAYLOAD_TEXT_1, 1],
    ["2 text questions", PAYLOAD_TEXT_2, 2],
    ["3 text questions", PAYLOAD_TEXT_3, 3],
    ["4 text questions", PAYLOAD_TEXT_4, 4],
    ["no figures, 2 text questions", PAYLOAD_NO_FIGURES_TEXT_2, 2],
  ] as const;

  it.each(fixtures)(
    "%s passes payloadV1Schema with the stated text count",
    (_, payload, count) => {
      expect(payloadV1Schema.safeParse(payload).success).toBe(true);
      const texts = payload.recall_questions.filter(
        (q) => q.answer_type === "text",
      );
      expect(texts.map((q) => q.id)).toEqual(
        Array.from({ length: count }, (_, i) => `a${i + 1}`),
      );
      const numbers = payload.recall_questions.filter(
        (q) => q.answer_type === "number",
      );
      const expectedNumbers =
        payload === PAYLOAD_NO_FIGURES_TEXT_2 ? [] : ["q1"];
      expect(numbers.map((q) => q.id)).toEqual(expectedNumbers);
    },
  );

  it("the no-figures fixture has no figures and no metrics", () => {
    expect(PAYLOAD_NO_FIGURES_TEXT_2.figures).toEqual([]);
    expect(PAYLOAD_NO_FIGURES_TEXT_2.metrics).toEqual([]);
  });
});
