import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  buildRecallRecord,
  recallRecordSchemaFor,
  type Draft,
} from "./record";
import type { RecallQuestionV1 } from "./generate";

// Feature: 03-persona-demo — recall record schema and draft assembly.
//
// Example tests pin the trim/store-as-typed behaviour (R3.3, R3.7) and the
// empty-draft-without-toggle rejection.
//
// Property 10: the Recall_Record schema accepts exactly the valid records.
// Property 12: drafts become records only as typed.

/** A number recall question with the given id. */
function question(id: string): RecallQuestionV1 {
  return {
    id,
    answer_type: "number",
    metric_id: `metric-${id}`,
    text: `What do you think thing ${id} cost then?`,
  };
}

// --- Example tests ----------------------------------------------------------

describe("buildRecallRecord — examples", () => {
  it("stores '  3.50 ' as '3.50' (trim, then store as typed)", () => {
    const questions = [question("q1")];
    const drafts: Record<string, Draft> = {
      q1: { text: "  3.50 ", noAnswer: false },
    };

    const result = buildRecallRecord(questions, drafts);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record).toEqual({
        version: 1,
        answers: [{ question_id: "q1", kind: "number", value: "3.50" }],
      });
    }
  });

  it("keeps '03.50' as '03.50' (no reformatting)", () => {
    const questions = [question("q1")];
    const drafts: Record<string, Draft> = {
      q1: { text: "03.50", noAnswer: false },
    };

    const result = buildRecallRecord(questions, drafts);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.answers[0]).toEqual({
        question_id: "q1",
        kind: "number",
        value: "03.50",
      });
    }
  });

  it("rejects an empty draft without the no-answer toggle", () => {
    const questions = [question("q1")];
    const drafts: Record<string, Draft> = {
      q1: { text: "", noAnswer: false },
    };

    const result = buildRecallRecord(questions, drafts);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.invalid).toContain("q1");
    }
  });
});

// --- Generators for Property 10 ---------------------------------------------

// A valid R3.3 number string: 1-40 chars after trim, one or more digits with an
// optional ".<digits>" fraction, non-negative, no exponent, no separators.
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

// A unique, short question id per index.
const idArb = (i: number): string => `q${i + 1}`;

// 1-20 distinct question ids.
const idsArb: fc.Arbitrary<string[]> = fc
  .integer({ min: 1, max: 20 })
  .map((n) => Array.from({ length: n }, (_, i) => idArb(i)));

/** Build one valid answer entry for a question id. */
type Answer =
  | { question_id: string; kind: "number"; value: string }
  | { question_id: string; kind: "no_answer" };

const answerForArb = (id: string): fc.Arbitrary<Answer> =>
  fc.oneof(
    validNumberArb.map(
      (value) =>
        ({ question_id: id, kind: "number", value }) as const,
    ),
    fc.constant({ question_id: id, kind: "no_answer" } as const),
  );

/** A valid record: exactly one answer per id, in id order. */
const validRecordArb = (
  ids: readonly string[],
): fc.Arbitrary<{ version: 1; answers: Answer[] }> =>
  fc
    .tuple(...ids.map((id) => answerForArb(id)))
    .map((answers) => ({ version: 1 as const, answers: [...answers] }));

describe("Property 10: The Recall_Record schema accepts exactly the valid records", () => {
  it("accepts any record with exactly one valid entry per id", () => {
    fc.assert(
      fc.property(
        idsArb.chain((ids) =>
          fc.record({
            ids: fc.constant(ids),
            record: validRecordArb(ids),
          }),
        ),
        ({ ids, record }) => {
          const result = recallRecordSchemaFor(ids).safeParse(record);
          expect(result.success).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("rejects any single mutation and yields no record", () => {
    // Each mutation name maps to a function that corrupts exactly one thing.
    type MutationName =
      | "bad_version"
      | "missing_id"
      | "extra_id"
      | "duplicate_id"
      | "unknown_top_key"
      | "unknown_answer_key"
      | "negative_value"
      | "empty_value"
      | "too_long_value"
      | "exponent_value"
      | "separator_value"
      | "trailing_dot_value";

    const mutate = (
      name: MutationName,
      ids: string[],
      record: { version: 1; answers: Answer[] },
    ): unknown => {
      const clone = {
        version: record.version as number,
        answers: record.answers.map((a) => ({ ...a })),
      } as { version: number; answers: Record<string, unknown>[] } & Record<
        string,
        unknown
      >;
      switch (name) {
        case "bad_version":
          clone.version = 2;
          return clone;
        case "missing_id":
          clone.answers.pop();
          return clone;
        case "extra_id":
          clone.answers.push({
            question_id: "not-a-real-id",
            kind: "no_answer",
          });
          return clone;
        case "duplicate_id": {
          const first = clone.answers[0];
          clone.answers.push({ ...first });
          return clone;
        }
        case "unknown_top_key":
          clone.extra = true;
          return clone;
        case "unknown_answer_key":
          clone.answers[0].surprise = 1;
          return clone;
        case "negative_value":
          clone.answers[0] = {
            question_id: ids[0],
            kind: "number",
            value: "-1",
          };
          return clone;
        case "empty_value":
          clone.answers[0] = {
            question_id: ids[0],
            kind: "number",
            value: "",
          };
          return clone;
        case "too_long_value":
          clone.answers[0] = {
            question_id: ids[0],
            kind: "number",
            value: "1".repeat(41),
          };
          return clone;
        case "exponent_value":
          clone.answers[0] = {
            question_id: ids[0],
            kind: "number",
            value: "1e3",
          };
          return clone;
        case "separator_value":
          clone.answers[0] = {
            question_id: ids[0],
            kind: "number",
            value: "1,000",
          };
          return clone;
        case "trailing_dot_value":
          clone.answers[0] = {
            question_id: ids[0],
            kind: "number",
            value: "1.",
          };
          return clone;
      }
    };

    const mutationArb = fc.constantFrom<MutationName>(
      "bad_version",
      "missing_id",
      "extra_id",
      "duplicate_id",
      "unknown_top_key",
      "unknown_answer_key",
      "negative_value",
      "empty_value",
      "too_long_value",
      "exponent_value",
      "separator_value",
      "trailing_dot_value",
    );

    fc.assert(
      fc.property(
        idsArb.chain((ids) =>
          fc.record({
            ids: fc.constant(ids),
            record: validRecordArb(ids),
            mutation: mutationArb,
          }),
        ),
        ({ ids, record, mutation }) => {
          const corrupt = mutate(mutation, ids, record);
          const result = recallRecordSchemaFor(ids).safeParse(corrupt);
          expect(result.success).toBe(false);
          // No record is yielded on failure.
          expect("data" in result && result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Generators for Property 12 ---------------------------------------------

// Arbitrary draft text: any printable text, which may or may not match R3.3.
const anyTextArb: fc.Arbitrary<string> = fc.string({ maxLength: 50 });

// Text that is NOT a valid R3.3 number after trimming (empty included).
const invalidTextArb: fc.Arbitrary<string> = anyTextArb.filter(
  (s) => !/^[0-9]+(\.[0-9]+)?$/.test(s.trim()) || s.trim().length === 0 || s.trim().length > 40,
);

describe("Property 12: Drafts become records only as typed", () => {
  it("no_answer wins regardless of text; valid text becomes the trimmed number; everything else is invalid; drafts are unchanged", () => {
    const draftArb = fc.record({
      text: fc.oneof(anyTextArb, validNumberArb),
      noAnswer: fc.boolean(),
    });

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }).chain((n) =>
          fc.array(draftArb, { minLength: n, maxLength: n }),
        ),
        (draftList) => {
          const questions = draftList.map((_, i) => question(idArb(i)));
          const drafts: Record<string, Draft> = {};
          draftList.forEach((d, i) => {
            drafts[idArb(i)] = { text: d.text, noAnswer: d.noAnswer };
          });

          // Snapshot drafts to prove they are not mutated.
          const before = JSON.parse(JSON.stringify(drafts));

          const result = buildRecallRecord(questions, drafts);

          // Compute the expected classification per question.
          const expectedInvalid: string[] = [];
          const expectedAnswers: Answer[] = [];
          draftList.forEach((d, i) => {
            const id = idArb(i);
            if (d.noAnswer) {
              expectedAnswers.push({ question_id: id, kind: "no_answer" });
              return;
            }
            const trimmed = d.text.trim();
            if (/^[0-9]+(\.[0-9]+)?$/.test(trimmed) && trimmed.length <= 40) {
              expectedAnswers.push({
                question_id: id,
                kind: "number",
                value: trimmed,
              });
            } else {
              expectedInvalid.push(id);
            }
          });

          if (expectedInvalid.length > 0) {
            expect(result.ok).toBe(false);
            if (!result.ok) {
              // Invalid ids appear, in order, and no record is returned.
              for (const id of expectedInvalid) {
                expect(result.invalid).toContain(id);
              }
              expect("record" in result).toBe(false);
            }
          } else {
            expect(result.ok).toBe(true);
            if (result.ok) {
              expect(result.record).toEqual({
                version: 1,
                answers: expectedAnswers,
              });
            }
          }

          // Drafts are never mutated.
          expect(drafts).toEqual(before);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("a question without a toggle and non-number text is always invalid", () => {
    fc.assert(
      fc.property(invalidTextArb, (text) => {
        const questions = [question("q1")];
        const drafts: Record<string, Draft> = {
          q1: { text, noAnswer: false },
        };
        const result = buildRecallRecord(questions, drafts);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.invalid).toContain("q1");
        }
      }),
      { numRuns: 100 },
    );
  });

  it("a question with noAnswer:true becomes no_answer whatever its text", () => {
    fc.assert(
      fc.property(fc.oneof(anyTextArb, validNumberArb), (text) => {
        const questions = [question("q1")];
        const drafts: Record<string, Draft> = {
          q1: { text, noAnswer: true },
        };
        const result = buildRecallRecord(questions, drafts);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.record.answers[0]).toEqual({
            question_id: "q1",
            kind: "no_answer",
          });
        }
      }),
      { numRuns: 100 },
    );
  });
});
