import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { payloadV1Schema, type MetricDefinitionV1 } from "@/lib/seal-format";
import {
  generateRecallQuestions,
  RecallInputError,
  type RecallInput,
} from "./generate";
import { BANNED_DIRECTION_WORDS } from "./banned-words";

// Feature: 03-persona-demo — recall question generator.
//
// Example tests pin the exact question text for Maya's two subjects and prove
// the banned-word list is the R2.4 list verbatim.
//
// Property 8: generated recall questions are valid, ordered and deterministic.
// Property 9: the generator rejects bad input and returns nothing.

/** A metric definition with sensible defaults, overridable per field. */
function metric(overrides: Partial<MetricDefinitionV1> = {}): MetricDefinitionV1 {
  return {
    id: "m1",
    display_name: "Regular gasoline",
    unit: "USD per gallon",
    region: "U.S. city average",
    source: "U.S. EIA",
    series_id: "EMM_EPMR_PTE_NUS_DPG",
    ...overrides,
  };
}

// --- Example tests ----------------------------------------------------------

describe("generateRecallQuestions — examples", () => {
  it("writes Maya's two subjects into the exact question text", () => {
    const items: RecallInput[] = [
      {
        metric: metric({ id: "gasoline" }),
        recall_subject: "a gallon of regular gasoline",
      },
      {
        metric: metric({ id: "diesel", series_id: "EMD_EPD2D_PTE_NUS_DPG" }),
        recall_subject: "a gallon of diesel",
      },
    ];

    const questions = generateRecallQuestions(items);

    expect(questions).toEqual([
      {
        id: "q1",
        answer_type: "number",
        metric_id: "gasoline",
        text: "What do you think a gallon of regular gasoline cost then?",
      },
      {
        id: "q2",
        answer_type: "number",
        metric_id: "diesel",
        text: "What do you think a gallon of diesel cost then?",
      },
    ]);
  });
});

describe("BANNED_DIRECTION_WORDS — example", () => {
  it("is exactly the R2.4 list, in order", () => {
    expect([...BANNED_DIRECTION_WORDS]).toEqual([
      "more",
      "less",
      "higher",
      "lower",
      "rise",
      "rose",
      "risen",
      "fall",
      "fell",
      "fallen",
      "increase",
      "increased",
      "decrease",
      "decreased",
      "up",
      "down",
      "cheaper",
      "dearer",
      "soar",
      "soared",
      "drop",
      "dropped",
    ]);
  });
});

// --- Generators for Property 8 ----------------------------------------------

// A clean subject: ASCII letters and spaces only, so it carries no digit, no
// '!', and no banned word (the clauses below exclude banned words as whole
// words). 1-60 chars after trimming, so it is within the 100-char bound and is
// non-empty.
const cleanSubjectArb: fc.Arbitrary<string> = fc
  .array(
    fc.constantFrom(
      ..."abcdefghijklmnopqrstuvwxyz ".split(""),
      ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
    ),
    { minLength: 1, maxLength: 60 },
  )
  .map((chars) => chars.join(""))
  .map((s) => `item ${s} thing`) // guarantee non-whitespace content
  .filter((s) => {
    const re = new RegExp(
      `\\b(?:${BANNED_DIRECTION_WORDS.join("|")})\\b`,
      "i",
    );
    return !re.test(s) && s.length <= 100 && s.trim().length > 0;
  });

// A short string for metric fields other than id, drawn from a character set
// DISJOINT from clean subjects (which are ASCII letters and spaces only). Using
// digits and punctuation guarantees the field can never appear as a substring
// of a clean subject, so the substring source/series_id check never fires for a
// subject that was built to be clean. 1-40 chars, always non-empty.
const metricFieldArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(..."0123456789-_/.:#".split("")), {
    minLength: 1,
    maxLength: 40,
  })
  .map((chars) => chars.join(""));

// A unique metric id per item: "mid" + index keeps ids distinct and short.
const metricIdArb = (i: number): string => `mid${i}`;

// A list of 0-20 items with unique metric ids and clean subjects, plus the
// metric fields we may mutate to prove they do not change the text.
type GenItem = {
  subject: string;
  display_name: string;
  region: string;
  source: string;
  series_id: string;
};

const itemsArb: fc.Arbitrary<GenItem[]> = fc.array(
  fc.record({
    subject: cleanSubjectArb,
    display_name: metricFieldArb,
    region: metricFieldArb,
    source: metricFieldArb,
    series_id: metricFieldArb,
  }),
  { minLength: 0, maxLength: 20 },
);

// Build RecallInputs from GenItems, assigning unique ids by position.
function toInputs(items: GenItem[]): RecallInput[] {
  return items.map((it, i) => ({
    metric: {
      id: metricIdArb(i),
      display_name: it.display_name,
      unit: "unit",
      region: it.region,
      source: it.source,
      series_id: it.series_id,
    },
    recall_subject: it.subject,
  }));
}

describe("Property 8: Generated recall questions are valid, ordered and deterministic", () => {
  it("produces one ordered, correctly shaped question per item", () => {
    fc.assert(
      fc.property(itemsArb, (items) => {
        const inputs = toInputs(items);
        const questions = generateRecallQuestions(inputs);

        expect(questions).toHaveLength(inputs.length);

        const seenIds = new Set<string>();
        questions.forEach((q, i) => {
          expect(q.answer_type).toBe("number");
          expect(q.metric_id).toBe(inputs[i].metric.id);
          expect(q.id).toBe(`q${i + 1}`);
          expect(seenIds.has(q.id)).toBe(false);
          seenIds.add(q.id);
          expect(q.text).toBe(
            `What do you think ${inputs[i].recall_subject.trim()} cost then?`,
          );
        });
      }),
      { numRuns: 100 },
    );
  });

  it("is deterministic: calling twice is deep-equal", () => {
    fc.assert(
      fc.property(itemsArb, (items) => {
        const inputs = toInputs(items);
        expect(generateRecallQuestions(inputs)).toEqual(
          generateRecallQuestions(inputs),
        );
      }),
      { numRuns: 100 },
    );
  });

  it("ignores every metric field but id: changing them leaves text unchanged", () => {
    fc.assert(
      fc.property(
        itemsArb,
        fc.array(
          fc.record({
            display_name: metricFieldArb,
            region: metricFieldArb,
            source: metricFieldArb,
            series_id: metricFieldArb,
          }),
          { minLength: 20, maxLength: 20 },
        ),
        (items, replacements) => {
          const inputs = toInputs(items);
          const base = generateRecallQuestions(inputs);

          // Rewrite display_name/region/source/series_id. Keep each subject
          // clear of the NEW source/series_id by only using the generator's
          // metricFieldArb values, which do not appear inside a clean subject
          // (clean subjects are "item <letters/spaces> thing"); skip any
          // replacement that would collide, leaving that field as-is.
          const mutated: RecallInput[] = inputs.map((input, i) => {
            const r = replacements[i];
            const subjectLower = input.recall_subject.toLowerCase();
            const safeSource = subjectLower.includes(r.source.toLowerCase())
              ? input.metric.source
              : r.source;
            const safeSeries = subjectLower.includes(
              r.series_id.toLowerCase(),
            )
              ? input.metric.series_id
              : r.series_id;
            return {
              metric: {
                ...input.metric,
                display_name: r.display_name,
                region: r.region,
                source: safeSource,
                series_id: safeSeries,
              },
              recall_subject: input.recall_subject,
            };
          });

          const after = generateRecallQuestions(mutated);
          // The text and id and metric_id are unchanged by the mutation.
          expect(after).toEqual(base);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("produces metrics+questions that pass payloadV1Schema", () => {
    fc.assert(
      fc.property(itemsArb, (items) => {
        const inputs = toInputs(items);
        const questions = generateRecallQuestions(inputs);

        const payload = {
          format_version: 1 as const,
          letter_text: "A letter to my future self.",
          metrics: inputs.map((input) => input.metric),
          figures: [],
          recall_questions: questions,
        };

        const result = payloadV1Schema.safeParse(payload);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

// --- Generators and helpers for Property 9 ----------------------------------

// A single valid baseline item used as the seed for each mutation. The mutation
// arbitraries below replace exactly one aspect of it so the rejection is
// attributable to that one problem.
const baseItemArb: fc.Arbitrary<{ metric: MetricDefinitionV1; subject: string }> =
  fc.record({
    metric: fc.record({
      id: fc.constant("m1"),
      display_name: fc.constant("Display"),
      unit: fc.constant("unit"),
      region: fc.constant("region"),
      source: fc.constant("SOURCEX"),
      series_id: fc.constant("SERIESY"),
    }),
    subject: cleanSubjectArb,
  });

describe("Property 9: The generator rejects bad input and returns nothing", () => {
  it("rejects more than 20 items", () => {
    fc.assert(
      fc.property(fc.integer({ min: 21, max: 60 }), (n) => {
        const inputs: RecallInput[] = Array.from({ length: n }, (_, i) => ({
          metric: metric({ id: `m${i}` }),
          recall_subject: "a clean subject",
        }));
        expect(() => generateRecallQuestions(inputs)).toThrow(RecallInputError);
        try {
          generateRecallQuestions(inputs);
        } catch (e) {
          expect((e as Error).message).toMatch(/too many items/);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("rejects a duplicate metric id", () => {
    fc.assert(
      fc.property(baseItemArb, ({ subject }) => {
        const inputs: RecallInput[] = [
          { metric: metric({ id: "dup" }), recall_subject: subject },
          { metric: metric({ id: "dup" }), recall_subject: subject },
        ];
        expect(() => generateRecallQuestions(inputs)).toThrow(RecallInputError);
        try {
          generateRecallQuestions(inputs);
        } catch (e) {
          expect((e as Error).message).toMatch(/duplicate metric id at item 1/);
        }
      }),
      { numRuns: 100 },
    );
  });

  // One throwing-subject check: mutate the baseline subject into each bad shape
  // and confirm RecallInputError is thrown with a message naming the problem.
  function expectRejectsSubject(
    subject: string,
    metricOverrides: Partial<MetricDefinitionV1>,
    messagePattern: RegExp,
  ): void {
    const inputs: RecallInput[] = [
      { metric: metric({ id: "m1", ...metricOverrides }), recall_subject: subject },
    ];
    expect(() => generateRecallQuestions(inputs)).toThrow(RecallInputError);
    try {
      generateRecallQuestions(inputs);
    } catch (e) {
      expect((e as Error).message).toMatch(messagePattern);
      expect((e as Error).message).toMatch(/at item 0/);
    }
  }

  it("rejects a whitespace-only subject", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(" ", "\t", "\n"), { minLength: 1, maxLength: 20 }),
        (chars) => {
          expectRejectsSubject(chars.join(""), {}, /no non-whitespace/);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("rejects a subject longer than 100 characters", () => {
    fc.assert(
      fc.property(fc.integer({ min: 101, max: 300 }), (n) => {
        expectRejectsSubject("a".repeat(n), {}, /longer than 100/);
      }),
      { numRuns: 100 },
    );
  });

  it("rejects a subject containing '!'", () => {
    fc.assert(
      fc.property(cleanSubjectArb, (subject) => {
        expectRejectsSubject(`${subject}!`, {}, /exclamation/);
      }),
      { numRuns: 100 },
    );
  });

  it("rejects a subject containing a digit", () => {
    fc.assert(
      fc.property(cleanSubjectArb, fc.integer({ min: 0, max: 9 }), (subject, d) => {
        expectRejectsSubject(`${subject} ${d}`, {}, /digit/);
      }),
      { numRuns: 100 },
    );
  });

  it("rejects a subject containing the metric source", () => {
    fc.assert(
      fc.property(cleanSubjectArb, (subject) => {
        expectRejectsSubject(
          `${subject} SOURCEX`,
          { source: "SOURCEX" },
          /metric source/,
        );
      }),
      { numRuns: 100 },
    );
  });

  it("rejects a subject containing the metric series id", () => {
    fc.assert(
      fc.property(cleanSubjectArb, (subject) => {
        expectRejectsSubject(
          `${subject} SERIESY`,
          { source: "SOURCEX", series_id: "SERIESY" },
          /series id/,
        );
      }),
      { numRuns: 100 },
    );
  });

  it("rejects a banned word as a whole word in any case", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...BANNED_DIRECTION_WORDS),
        // Randomise case of the banned word.
        fc.array(fc.boolean(), { minLength: 1, maxLength: 12 }),
        (word, caseFlags) => {
          const cased = [...word]
            .map((c, i) => (caseFlags[i % caseFlags.length] ? c.toUpperCase() : c))
            .join("");
          expectRejectsSubject(`the ${cased} price`, {}, /banned direction word/);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("does NOT reject a banned word inside another word", () => {
    // 'upland' contains 'up', 'dropout' contains 'drop' — both must pass.
    const inputs: RecallInput[] = [
      { metric: metric({ id: "m1" }), recall_subject: "a walk in the upland" },
      { metric: metric({ id: "m2" }), recall_subject: "the dropout rate class" },
    ];
    const questions = generateRecallQuestions(inputs);
    expect(questions).toHaveLength(2);
    expect(questions[0].text).toBe(
      "What do you think a walk in the upland cost then?",
    );
    expect(questions[1].text).toBe(
      "What do you think the dropout rate class cost then?",
    );
  });
});
