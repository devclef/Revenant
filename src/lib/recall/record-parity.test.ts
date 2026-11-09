import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { recallRecordV1Schema, numberAnswerSchema } from "./record";
import { TEXT_ANSWERS_MAX, TEXT_ANSWER_MAX_CODE_POINTS } from "./limits";

// Feature: 10-own-questions — numberAnswerSchema parity with the v1 number answer (G1.6).
//
// numberAnswerSchema must accept and reject exactly what the v1 number answer
// does. The v1 check runs through a full Recall_Record_V1, so the parity is
// measured on the real stored shape, not on a copy of the rule.

/** Whether the v1 record accepts `value` as the number answer of one question. */
function v1Accepts(value: string): boolean {
  return recallRecordV1Schema.safeParse({
    version: 1,
    answers: [{ question_id: "q", kind: "number", value }],
  }).success;
}

describe("numberAnswerSchema — parity with the v1 number answer", () => {
  const examples: string[] = [
    "0",
    "3",
    "3.4",
    "3.412",
    "03.50",
    "  3.50 ",
    "\t12\n",
    "",
    " ",
    ".5",
    "5.",
    "-3",
    "+3",
    "1e3",
    "1,5",
    "3.4.5",
    "abc",
    "1".repeat(40),
    "1".repeat(41),
    `${"1".repeat(39)}.5`,
    `${"1".repeat(40)}.`,
  ];

  it.each(examples)("agrees with v1 on %j", (value) => {
    const parsed = numberAnswerSchema.safeParse(value).success;
    expect(parsed).toBe(v1Accepts(value));
  });

  it("stores a trimmed accepted value exactly as the v1 answer does", () => {
    const parsed = numberAnswerSchema.safeParse("  3.50 ");
    expect(parsed.success && parsed.data).toBe("3.50");
  });

  it("agrees with v1 on arbitrary strings", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 60 }), (value) => {
        expect(numberAnswerSchema.safeParse(value).success).toBe(
          v1Accepts(value),
        );
      }),
    );
  });

  it("agrees with v1 on digit-and-dot strings near the edges", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[0-9. ]{0,50}$/), (value) => {
        expect(numberAnswerSchema.safeParse(value).success).toBe(
          v1Accepts(value),
        );
      }),
    );
  });
});

describe("recall limits", () => {
  it("caps text answers at 3 and text length at 1000 code points", () => {
    expect(TEXT_ANSWERS_MAX).toBe(3);
    expect(TEXT_ANSWER_MAX_CODE_POINTS).toBe(1000);
  });
});
