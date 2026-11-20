import { answerProblem, questionRowProblem } from "../author-questions";
import {
  isEmptySelfReportedRow,
  selfReportedRowProblems,
  selfReportedRowsOk,
  validateWrite,
  type WriteProblem,
} from "../form";
import type { SelfReportedField, SelfReportedRow } from "../write-draft";

/**
 * The Write_Check (spec 14, W13.2 and W13.3). Pure: no React and no browser
 * APIs. The Write step's move to Seal and the Fold_Button both read it, so they
 * always agree.
 *
 * It never reads the figures request status (X2.4, X2.9). The warning and the
 * backup card belong to the Seal step, so they are not part of this check.
 */

/** Where focus goes after a failed fold: the first failing field in page order. */
export type FoldTarget =
  | { kind: "letter" }
  | { kind: "question"; index: number }
  | { kind: "answer"; index: number }
  | { kind: "write_own" }
  | { kind: "own_number"; field: SelfReportedField };

export type WriteCheckInput = {
  text: string;
  questions: readonly string[];
  /**
   * The author's answer to each question, index-aligned with `questions`
   * (spec 15, R7.1). A missing entry reads as an unanswered question.
   */
  answers?: readonly string[];
  metricIds: readonly string[];
  selfReported: readonly SelfReportedRow[];
  maxFigures: number;
  sealingDay: string;
};

export type WriteCheckResult = {
  ok: boolean;
  /**
   * The write problems, without the Seal-step warning and without the answer
   * rules (those show as `first`). Empty when no problem is reported here.
   */
  problems: readonly WriteProblem[];
  /** The first failing field, or null when ok. */
  first: FoldTarget | null;
};

/** The own-number fields in the order the target checks them (W13.3). */
const OWN_NUMBER_ORDER: readonly SelfReportedField[] = [
  "name",
  "value",
  "unit",
  "region",
];

/** The write problems for one draft. The warning is always treated as ticked. */
function writeProblems(input: WriteCheckInput): WriteProblem[] {
  return validateWrite({
    text: input.text,
    metricIds: input.metricIds,
    warningTicked: true,
    backupCardTicked: false,
    maxFigures: input.maxFigures,
    questions: input.questions,
    selfReported: input.selfReported,
    sealingDay: input.sealingDay,
  }).filter((problem) => problem !== "warning_unticked");
}

/**
 * The first own-number field that is missing or invalid. Blank rows are skipped
 * because they pass. Falls back to the period when only the period breaks.
 */
function firstOwnNumberField(input: WriteCheckInput): FoldTarget | null {
  for (const row of input.selfReported) {
    if (isEmptySelfReportedRow(row)) continue;
    const problems = selfReportedRowProblems(row, input.sealingDay);
    for (const field of OWN_NUMBER_ORDER) {
      if (row[field].trim() === "" || problems[field] !== undefined) {
        return { kind: "own_number", field };
      }
    }
    if (problems.period !== undefined) {
      return { kind: "own_number", field: "period" };
    }
  }
  return null;
}

/**
 * The first question row, in page order, that fails. A row fails when its
 * question is over 200 code points, its answer is over 1,000, or its question
 * has no answer (spec 15, R7.1, R7.3, R7.4). Within a row the question comes
 * before the answer. A row with a blank question is dropped at sealing, so only
 * an over-long answer on it counts.
 */
function firstRowFailure(input: WriteCheckInput): FoldTarget | null {
  for (let index = 0; index < input.questions.length; index += 1) {
    const question = input.questions[index] ?? "";
    const answer = input.answers?.[index] ?? "";
    const hasQuestion = question.trim() !== "";
    if (hasQuestion && questionRowProblem(question) !== null) {
      return { kind: "question", index };
    }
    if (answerProblem(answer) !== null) return { kind: "answer", index };
    if (hasQuestion && answer.trim() === "") return { kind: "answer", index };
  }
  return null;
}

/**
 * The first failing field in page order: the letter, then the first failing
 * question row (its question, then its answer), then the nothing-to-testify
 * target (row 0 when a row exists, otherwise write_own), then the first
 * own-number field. Null when the write passes.
 *
 * The figure limit has no target of its own: the picker caps figures, so the
 * limit cannot be broken through the UI. If it is broken anyway, the target is
 * the first own-number field, or write_own when none is missing.
 */
export function firstFailingField(input: WriteCheckInput): FoldTarget | null {
  const problems = writeProblems(input);
  const ownOk = selfReportedRowsOk(input.selfReported, input.sealingDay);
  const row = firstRowFailure(input);
  if (problems.length === 0 && ownOk && row === null) return null;

  if (
    problems.includes("letter_empty") ||
    problems.includes("letter_too_long")
  ) {
    return { kind: "letter" };
  }

  if (row !== null) return row;

  if (problems.includes("nothing_to_testify")) {
    return input.questions.length > 0
      ? { kind: "question", index: 0 }
      : { kind: "write_own" };
  }

  if (!ownOk) {
    return firstOwnNumberField(input) ?? { kind: "write_own" };
  }

  return { kind: "write_own" };
}

/**
 * Today's Write-step Next as one check. `ok` is true exactly when the letter,
 * the question rows and their answers, the nothing-to-testify rule, the figure
 * limit and the self-reported rows all pass. The envelope seal is at full
 * strength exactly when `ok` is true (spec 15, R7.6).
 */
export function writeCheck(input: WriteCheckInput): WriteCheckResult {
  const problems = writeProblems(input);
  const ok =
    problems.length === 0 &&
    selfReportedRowsOk(input.selfReported, input.sealingDay) &&
    firstRowFailure(input) === null;
  return { ok, problems, first: firstFailingField(input) };
}
