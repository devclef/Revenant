import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  recallRecordV2Schema,
  recallRecordV2SchemaFor,
  type BoundQuestion,
} from "./record-v2";
import { TEXT_ANSWER_MAX_CODE_POINTS } from "./limits";

// Feature: 10-own-questions, Property 10: The Recall_Record_V2 schema accepts exactly the valid records.
//
// The schema is checked against a plain oracle written from the rules in the
// spec (C3.1 to C3.5), not from the schema's own code. The oracle reads the
// same key sets, the same number rule and the same text rule, so a mismatch
// means the schema and the written rules disagree.

const NUMBER_RULE = /^[0-9]+(\.[0-9]+)?$/;
const KEYS_BY_KIND: Record<string, { required: string[]; allowed: string[] }> =
  {
    number: {
      required: ["question_id", "kind", "value"],
      allowed: ["question_id", "kind", "value", "sample"],
    },
    text: {
      required: ["question_id", "kind", "value"],
      allowed: ["question_id", "kind", "value"],
    },
    no_answer: {
      required: ["question_id", "kind"],
      allowed: ["question_id", "kind"],
    },
  };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The written rules for a Recall_Record_V2, applied to any value. */
function oracleAccepts(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (!Object.keys(value).every((k) => k === "version" || k === "answers")) {
    return false;
  }
  if (value.version !== 2) return false;
  const answers = value.answers;
  if (!Array.isArray(answers) || answers.length > 20) return false;

  let textCount = 0;
  for (const answer of answers) {
    if (!isObject(answer) || typeof answer.kind !== "string") return false;
    const spec = KEYS_BY_KIND[answer.kind];
    if (spec === undefined) return false;

    const keys = Object.keys(answer);
    if (!keys.every((k) => spec.allowed.includes(k))) return false;
    if (!spec.required.every((k) => keys.includes(k))) return false;

    const id = answer.question_id;
    if (typeof id !== "string" || id.length < 1 || id.length > 200)
      return false;

    if (answer.kind === "number") {
      if (typeof answer.value !== "string") return false;
      const trimmed = answer.value.trim();
      if (trimmed.length > 40 || !NUMBER_RULE.test(trimmed)) return false;
      if ("sample" in answer && answer.sample !== true) return false;
    } else if (answer.kind === "text") {
      textCount++;
      const text = answer.value;
      if (typeof text !== "string") return false;
      if (text !== text.trim() || text.length === 0) return false;
      if ([...text].length > TEXT_ANSWER_MAX_CODE_POINTS) return false;
    }
  }
  return textCount <= 3;
}

/** Drops keys whose value is undefined, so the generated shape is exact. */
function clean(object: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(object).filter(([, v]) => v !== undefined),
  );
}

const idArb = fc.oneof(
  fc.constantFrom("a1", "a2", "q1", "q2", "q3", "q1 "),
  fc.constant(""),
  fc.string({ maxLength: 4 }),
  fc.constant("x".repeat(200)),
  fc.constant("x".repeat(201)),
);

const numberValueArb = fc.oneof(
  fc.stringMatching(/^ {0,2}[0-9]{0,3}(\.[0-9]{0,2})? {0,2}$/),
  fc.string({ maxLength: 12 }),
  fc.constantFrom(
    "1".repeat(40),
    "1".repeat(41),
    `${"1".repeat(39)}.5`,
    "03.50",
  ),
);

const textValueArb = fc.oneof(
  fc.string({ maxLength: 20 }),
  fc.constantFrom(
    " hi ",
    "   ",
    "x".repeat(TEXT_ANSWER_MAX_CODE_POINTS),
    "x".repeat(TEXT_ANSWER_MAX_CODE_POINTS + 1),
    "🙂".repeat(TEXT_ANSWER_MAX_CODE_POINTS),
    "🙂".repeat(TEXT_ANSWER_MAX_CODE_POINTS + 1),
  ),
);

/** An answer with a random key set, so mutations (extra key, bad sample) appear. */
const answerArb: fc.Arbitrary<Record<string, unknown>> = fc.oneof(
  fc
    .record({
      question_id: idArb,
      value: numberValueArb,
      sample: fc.constantFrom<unknown>(undefined, true, false),
      extra: fc.option(fc.constant(1), { nil: undefined }),
    })
    .map((r) =>
      clean({
        question_id: r.question_id,
        kind: "number",
        value: r.value,
        sample: r.sample,
        extra: r.extra,
      }),
    ),
  fc
    .record({
      question_id: idArb,
      value: textValueArb,
      sample: fc.constantFrom<unknown>(undefined, true),
    })
    .map((r) =>
      clean({
        question_id: r.question_id,
        kind: "text",
        value: r.value,
        sample: r.sample,
      }),
    ),
  fc
    .record({
      question_id: idArb,
      sample: fc.constantFrom<unknown>(undefined, true),
    })
    .map((r) =>
      clean({
        question_id: r.question_id,
        kind: "no_answer",
        sample: r.sample,
      }),
    ),
);

const recordArb: fc.Arbitrary<unknown> = fc
  .record({
    version: fc.constantFrom<unknown>(1, 2, 2, 2, "2"),
    answers: fc.array(answerArb, { maxLength: 24 }),
    extraTop: fc.option(fc.constant(true), { nil: undefined }),
  })
  .map((r) =>
    clean({ version: r.version, answers: r.answers, extraTop: r.extraTop }),
  );

/** A record built to the rules, so the accepting side is well covered. */
const validRecordArb: fc.Arbitrary<unknown> = fc
  .record({
    texts: fc.uniqueArray(fc.constantFrom("a1", "a2", "a3", "a4"), {
      maxLength: 3,
    }),
    numbers: fc.uniqueArray(fc.constantFrom("q1", "q2", "q3", "q4", "q5"), {
      maxLength: 5,
    }),
    text: textValueArb.filter(
      (t) =>
        t === t.trim() &&
        t.length > 0 &&
        [...t].length <= TEXT_ANSWER_MAX_CODE_POINTS,
    ),
    number: fc.constantFrom("0", "3", "3.59", "03.50"),
    sample: fc.boolean(),
  })
  .map((r) => ({
    version: 2,
    answers: [
      ...r.texts.map((id) => ({
        question_id: id,
        kind: "text",
        value: r.text,
      })),
      ...r.numbers.map((id, i) =>
        clean({
          question_id: id,
          kind: "number",
          value: r.number,
          sample: r.sample && i % 2 === 0 ? true : undefined,
        }),
      ),
    ],
  }));

describe("recallRecordV2Schema — Property 10", () => {
  it("accepts exactly the values the written rules accept (random and mutated)", () => {
    fc.assert(
      fc.property(recordArb, (value) => {
        expect(recallRecordV2Schema.safeParse(value).success).toBe(
          oracleAccepts(value),
        );
      }),
      { numRuns: 300 },
    );
  });

  it("accepts every record built to the rules", () => {
    fc.assert(
      fc.property(validRecordArb, (value) => {
        expect(oracleAccepts(value)).toBe(true);
        expect(recallRecordV2Schema.safeParse(value).success).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});

describe("recallRecordV2Schema — rules by example", () => {
  const base = { version: 2 as const };

  it("accepts a number answer with the sample flag", () => {
    const r = recallRecordV2Schema.safeParse({
      ...base,
      answers: [
        { question_id: "q1", kind: "number", value: "3.59", sample: true },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("rejects sample on a text answer and on a no-answer entry (C3.4)", () => {
    expect(
      recallRecordV2Schema.safeParse({
        ...base,
        answers: [
          { question_id: "a1", kind: "text", value: "x", sample: true },
        ],
      }).success,
    ).toBe(false);
    expect(
      recallRecordV2Schema.safeParse({
        ...base,
        answers: [{ question_id: "q1", kind: "no_answer", sample: true }],
      }).success,
    ).toBe(false);
  });

  it("rejects sample set to anything other than true", () => {
    expect(
      recallRecordV2Schema.safeParse({
        ...base,
        answers: [
          { question_id: "q1", kind: "number", value: "3", sample: false },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects a fourth text answer (C3.3)", () => {
    const text = (id: string) => ({
      question_id: id,
      kind: "text",
      value: "x",
    });
    expect(
      recallRecordV2Schema.safeParse({
        ...base,
        answers: [text("a1"), text("a2"), text("a3"), text("a4")],
      }).success,
    ).toBe(false);
    expect(
      recallRecordV2Schema.safeParse({
        ...base,
        answers: [text("a1"), text("a2"), text("a3")],
      }).success,
    ).toBe(true);
  });

  it("rejects an untrimmed or empty text answer (C3.2)", () => {
    for (const value of [" x", "x ", "", "   "]) {
      expect(
        recallRecordV2Schema.safeParse({
          ...base,
          answers: [{ question_id: "a1", kind: "text", value }],
        }).success,
      ).toBe(false);
    }
  });

  it("accepts a text answer of exactly 1,000 code points and rejects 1,001", () => {
    const ok = "🙂".repeat(TEXT_ANSWER_MAX_CODE_POINTS);
    const tooLong = "🙂".repeat(TEXT_ANSWER_MAX_CODE_POINTS + 1);
    expect(
      recallRecordV2Schema.safeParse({
        ...base,
        answers: [{ question_id: "a1", kind: "text", value: ok }],
      }).success,
    ).toBe(true);
    expect(
      recallRecordV2Schema.safeParse({
        ...base,
        answers: [{ question_id: "a1", kind: "text", value: tooLong }],
      }).success,
    ).toBe(false);
  });

  it("rejects version 1 and a record with an unknown top-level key", () => {
    expect(
      recallRecordV2Schema.safeParse({ version: 1, answers: [] }).success,
    ).toBe(false);
    expect(
      recallRecordV2Schema.safeParse({ ...base, answers: [], extra: 1 })
        .success,
    ).toBe(false);
  });
});

describe("recallRecordV2SchemaFor — the bound schema (C3.5)", () => {
  const questions: BoundQuestion[] = [
    { id: "a1", answer_type: "text" },
    { id: "q1", answer_type: "number" },
    { id: "q2", answer_type: "number" },
  ];
  const schema = recallRecordV2SchemaFor(questions);
  const text = (id: string, value = "x") => ({
    question_id: id,
    kind: "text",
    value,
  });
  const num = (id: string, value = "3") => ({
    question_id: id,
    kind: "number",
    value,
  });
  const none = (id: string) => ({ question_id: id, kind: "no_answer" });
  const accepts = (answers: unknown[]) =>
    schema.safeParse({ version: 2, answers }).success;

  it("accepts one answer per question with allowed kinds, in any order", () => {
    expect(accepts([num("q2"), text("a1"), none("q1")])).toBe(true);
    expect(accepts([none("a1"), num("q1", "3.59"), none("q2")])).toBe(true);
  });

  it("requires every question to be answered", () => {
    expect(accepts([text("a1"), num("q1")])).toBe(false);
  });

  it("rejects a duplicate answer for one question", () => {
    expect(accepts([text("a1"), num("q1"), num("q1"), none("q2")])).toBe(false);
  });

  it("rejects an answer for an ID that is not a sealed question", () => {
    expect(accepts([text("a1"), num("q1"), none("q2"), none("zz")])).toBe(
      false,
    );
  });

  it("rejects a number answer for a text question", () => {
    expect(accepts([num("a1"), num("q1"), none("q2")])).toBe(false);
  });

  it("rejects a text answer for a number question", () => {
    expect(accepts([text("a1"), text("q1"), none("q2")])).toBe(false);
  });

  it("accepts an empty question list only with an empty answer list", () => {
    const empty = recallRecordV2SchemaFor([]);
    expect(empty.safeParse({ version: 2, answers: [] }).success).toBe(true);
    expect(empty.safeParse({ version: 2, answers: [none("q1")] }).success).toBe(
      false,
    );
  });

  it("property: the bound schema accepts exactly one allowed-kind answer per question", () => {
    // Each question gets one of: a kind its answer_type allows, "no answer",
    // the other kind (wrong), or nothing (skip). An unknown-ID answer may be
    // added. The schema must accept only when every question has an allowed
    // answer or "no answer", and there is no extra answer and at most 3 texts.
    const modeArb = fc.constantFrom<"answer" | "none" | "wrong" | "skip">(
      "answer",
      "none",
      "wrong",
      "skip",
    );

    fc.assert(
      fc.property(
        fc.uniqueArray(fc.constantFrom("a1", "a2", "q1", "q2", "q3", "q4"), {
          maxLength: 4,
        }),
        fc.array(fc.constantFrom<"text" | "number">("text", "number"), {
          minLength: 4,
          maxLength: 4,
        }),
        fc.array(modeArb, { minLength: 4, maxLength: 4 }),
        fc.option(fc.constantFrom("a1", "q1", "zz"), { nil: undefined }),
        (ids, types, modes, extraId) => {
          const qs: BoundQuestion[] = ids.map((id, i) => ({
            id,
            answer_type: types[i],
          }));
          const answers: Record<string, unknown>[] = [];

          qs.forEach((q, i) => {
            const mode = modes[i];
            if (mode === "skip") return;
            if (mode === "wrong") {
              answers.push(q.answer_type === "text" ? num(q.id) : text(q.id));
              return;
            }
            if (mode === "none") {
              answers.push(none(q.id));
              return;
            }
            // mode === "answer": the kind this question's type allows.
            answers.push(q.answer_type === "text" ? text(q.id) : num(q.id));
          });
          if (extraId !== undefined) answers.push(none(extraId));

          // The rules, stated on the final answer list: every answer names a
          // sealed question, each question has exactly one answer, the kind
          // fits the question's type (or is "no answer"), and at most 3 texts.
          const typeById = new Map(qs.map((q) => [q.id, q.answer_type]));
          const answerIds = answers.map((a) => a.question_id as string);
          const oneEach =
            answerIds.length === qs.length &&
            new Set(answerIds).size === answerIds.length &&
            answerIds.every((id) => typeById.has(id)) &&
            qs.every((q) => answerIds.includes(q.id));
          const kindsFit = answers.every((a) => {
            if (a.kind === "no_answer") return true;
            return a.kind === typeById.get(a.question_id as string);
          });
          const textCount = answers.filter((a) => a.kind === "text").length;
          const expected = oneEach && kindsFit && textCount <= 3;

          const actual = recallRecordV2SchemaFor(qs).safeParse({
            version: 2,
            answers,
          }).success;
          expect(actual).toBe(expected);
        },
      ),
      { numRuns: 200 },
    );
  });
});
