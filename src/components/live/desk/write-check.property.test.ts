// Feature: 14-write-desk, Property 8: The seal is ready exactly when the fold would pass
// Feature: 14-write-desk, Property 9: A failed fold targets the first failing field in page order
//
// writeCheck says the seal is ready exactly when the Next condition from the
// Seal page at ba2cd6c passed. That condition is frozen below as the model.
// firstFailingField names the first failing field in page order: the letter,
// then the question rows, then the nothing-to-testify target, then the own
// number fields.
//
// Validates: Requirements W9.4, W13.2, W13.3, Q2.3.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { questionRowProblem } from "../author-questions";
import {
  isEmptySelfReportedRow,
  selfReportedRowProblems,
  selfReportedRowsOk,
  validateWrite,
} from "../form";
import type { SelfReportedRow } from "../write-draft";

import {
  firstFailingField,
  writeCheck,
  type FoldTarget,
  type WriteCheckInput,
} from "./write-check";

const SEALING_DAY = "2026-11-18";

/**
 * Frozen copy of the Next condition in WriteForm.tsx at ba2cd6c (the press that
 * moves from the Write step to the Seal step). It is kept here, not imported,
 * so a later change to writeCheck cannot change the model too.
 */
function frozenNextCondition(input: WriteCheckInput): boolean {
  const problems = validateWrite({
    text: input.text,
    metricIds: input.metricIds,
    warningTicked: true,
    backupCardTicked: false,
    maxFigures: input.maxFigures,
    questions: input.questions,
    selfReported: input.selfReported,
    sealingDay: input.sealingDay,
  });
  const letterValid = !problems.some(
    (problem) => problem === "letter_empty" || problem === "letter_too_long",
  );
  const questionsValid = !problems.includes("question_too_long");
  const figuresValid = !problems.some(
    (problem) =>
      problem === "nothing_to_testify" || problem === "figures_too_many",
  );
  const selfReportedValid = selfReportedRowsOk(
    input.selfReported,
    input.sealingDay,
  );
  return letterValid && questionsValid && selfReportedValid && figuresValid;
}

const partArb = fc.oneof(
  fc.constant(""),
  fc.constant("   "),
  fc.constant("Rent"),
  fc.constant("1250"),
  fc.constant("abc"),
  fc.constant("USD per month"),
  fc.constant("U.S."),
  fc.constant("2026-11"),
  fc.constant("2026-12"),
  fc.constant("2026-11-18"),
  fc.string({ maxLength: 70 }),
);

const rowArb: fc.Arbitrary<SelfReportedRow> = fc.record({
  name: partArb,
  value: partArb,
  unit: partArb,
  region: partArb,
  period: partArb,
});

const textArb = fc.oneof(
  fc.constant(""),
  fc.constant("   "),
  fc.string({ maxLength: 80 }),
  fc.constant("x".repeat(5001)),
);

const questionArb = fc.oneof(
  fc.constant(""),
  fc.constant("Who was there?"),
  fc.string({ maxLength: 60 }),
  fc.constant("q".repeat(201)),
);

const inputArb: fc.Arbitrary<WriteCheckInput> = fc.record({
  text: textArb,
  questions: fc.array(questionArb, { maxLength: 4 }),
  metricIds: fc.array(
    fc.constantFrom("us-gasoline-regular", "eu-diesel", "se-milk"),
    { maxLength: 7 },
  ),
  selfReported: fc.array(rowArb, { maxLength: 3 }),
  maxFigures: fc.integer({ min: 0, max: 6 }),
  sealingDay: fc.constant(SEALING_DAY),
});

/** Independent page-order model for Property 9. */
function expectedFirstFailing(input: WriteCheckInput): FoldTarget | null {
  const problems = validateWrite({
    text: input.text,
    metricIds: input.metricIds,
    warningTicked: true,
    backupCardTicked: false,
    maxFigures: input.maxFigures,
    questions: input.questions,
    selfReported: input.selfReported,
    sealingDay: input.sealingDay,
  });
  const ownOk = selfReportedRowsOk(input.selfReported, input.sealingDay);
  if (!problems.some((p) => p !== "warning_unticked") && ownOk) return null;

  // 1. The letter.
  if (input.text.trim() === "" || problems.includes("letter_too_long")) {
    return { kind: "letter" };
  }
  // 2. The question rows, in order.
  const badRow = input.questions.findIndex(
    (q) => questionRowProblem(q) !== null,
  );
  if (badRow !== -1) return { kind: "question", index: badRow };
  // 3. Nothing to testify: the first question row, or the write_own control.
  if (problems.includes("nothing_to_testify")) {
    return input.questions.length > 0
      ? { kind: "question", index: 0 }
      : { kind: "write_own" };
  }
  // 4. The own-number fields, row by row, in form order.
  for (const row of input.selfReported) {
    if (isEmptySelfReportedRow(row)) continue;
    const rowProblems = selfReportedRowProblems(row, input.sealingDay);
    for (const field of [
      "name",
      "value",
      "unit",
      "region",
      "period",
    ] as const) {
      const missing = row[field].trim() === "";
      if (missing || rowProblems[field] !== undefined) {
        return { kind: "own_number", field };
      }
    }
  }
  // Only the figure limit fails, and it has no field of its own.
  return { kind: "write_own" };
}

describe("Property 8: the seal is ready exactly when the fold would pass (W9.4, W13.2, Q2.3)", () => {
  it("matches the frozen ba2cd6c Next condition for every draft", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        expect(writeCheck(input).ok).toBe(frozenNextCondition(input));
      }),
    );
  });

  it("never reports the Seal-step warning as a problem", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        expect(writeCheck(input).problems).not.toContain("warning_unticked");
      }),
    );
  });
});

describe("Property 9: a failed fold targets the first failing field in page order (W13.3)", () => {
  it("returns the first failing field, or null when the write passes", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        expect(firstFailingField(input)).toEqual(expectedFirstFailing(input));
      }),
    );
  });

  it("returns null exactly when the write passes", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        expect(firstFailingField(input) === null).toBe(writeCheck(input).ok);
      }),
    );
  });
});
