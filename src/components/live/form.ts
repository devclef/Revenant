import { questionRowProblem, questionsForSeal } from "./author-questions";
import {
  MAX_FIGURES,
  MAX_LETTER_CODE_POINTS,
  SELF_REPORTED_DECIMALS_MAX,
  SELF_REPORTED_TEXT_MAX,
  SELF_REPORTED_VALUE_MAX,
} from "./constants";
import type { SelfReportedField, SelfReportedRow } from "./write-draft";
import { showsFieldMessage, type TouchedState } from "./touched";

/**
 * Pure form rules for the live Seal_Page (spec 06, design.md "form.ts"). Each
 * problem maps to one key in LIVE_COPY. These rules run before any request is
 * sent. The server applies its own limits.
 *
 * Pure module: no imports beyond the constants, safe in the browser and tests.
 */

/** A rule the write form breaks. Each value names one message in LIVE_COPY. */
export type WriteProblem =
  | "letter_empty"
  | "letter_too_long"
  | "question_too_long"
  | "nothing_to_testify"
  | "figures_too_many"
  | "warning_unticked"
  | "self_reported_invalid";

/**
 * Which seal the write belongs to. `demo` is `/demo/live`, `real` is `/seal`.
 * The seal mode does not change the write rules: both need something to
 * testify about (see hasSomethingToTestify).
 */
export type WriteMode = "demo" | "real";

/**
 * True when a letter has something to testify about: at least one
 * Author_Question with text after trimming, or at least one official figure.
 * Self-reported rows never count. The same rule holds in demo and real mode.
 */
export function hasSomethingToTestify(input: {
  questions: readonly string[];
  officialFigureCount: number;
}): boolean {
  return (
    questionsForSeal(input.questions).length > 0 ||
    input.officialFigureCount > 0
  );
}

/**
 * Count the letter length in Unicode code points, so an emoji or an accented
 * letter written as two code units still counts once (R12.4).
 */
export function countCodePoints(s: string): number {
  return [...s].length;
}

/**
 * Check a write against the live Seal_Page rules. An empty array means the
 * write is valid. The problems come in this fixed order: letter, figures, then
 * the passkey warning (R12.3, R13.2, R15.11). The warning is required only when
 * no backup key card is chosen: a backup key card is the second way in (R21.2).
 *
 * A letter is empty when it has no character other than whitespace.
 */
/**
 * The most figures a visitor may choose from the series offered: the smaller of
 * MAX_FIGURES and the offered count (spec 08, R10.7). Today that is 4.
 */
export function figureLimit(offeredCount: number): number {
  return Math.min(MAX_FIGURES, Math.max(0, Math.floor(offeredCount)));
}

/** The fields of a self-reported row, in the order the form shows them. */
export const SELF_REPORTED_FIELDS: readonly SelfReportedField[] = [
  "name",
  "value",
  "unit",
  "region",
  "period",
];

/**
 * The problem a self-reported field breaks. Each value names one message in
 * LIVE_COPY, which says what is allowed.
 */
export type SelfReportedProblem =
  "selfReportedTextLength" | "selfReportedValue" | "selfReportedPeriod";

/** The problems in one row, by field. A field that passes has no entry. */
export type SelfReportedRowProblems = Partial<
  Record<SelfReportedField, SelfReportedProblem>
>;

/** True when a name, unit or region is 1 to 60 characters after trimming. */
export function selfReportedTextOk(text: string): boolean {
  const length = countCodePoints(text.trim());
  return length >= 1 && length <= SELF_REPORTED_TEXT_MAX;
}

/**
 * True when a value is digits with an optional dot and at most 4 decimal
 * places, and is 0 to 999,999,999. Surrounding spaces are ignored. Nothing is
 * rounded or rescaled.
 */
export function selfReportedValueOk(text: string): boolean {
  const trimmed = text.trim();
  const match = /^\d+(?:\.(\d+))?$/.exec(trimmed);
  if (match === null) return false;
  const decimals = match[1]?.length ?? 0;
  if (decimals > SELF_REPORTED_DECIMALS_MAX) return false;
  return Number(trimmed) <= SELF_REPORTED_VALUE_MAX;
}

/**
 * True when a period is a month (YYYY-MM) or a date (YYYY-MM-DD) that is a real
 * calendar value and is not after the sealing day. A month is allowed when it
 * is the sealing month or earlier. `sealingDay` is YYYY-MM-DD.
 */
export function selfReportedPeriodOk(
  text: string,
  sealingDay: string,
): boolean {
  const trimmed = text.trim();
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(trimmed);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return false;
  if (match[3] === undefined) {
    return trimmed <= sealingDay.slice(0, 7);
  }
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return isRealDate && trimmed <= sealingDay;
}

/** Checks one self-reported row. An empty result means the row is valid. */
export function selfReportedRowProblems(
  row: SelfReportedRow,
  sealingDay: string,
): SelfReportedRowProblems {
  const problems: SelfReportedRowProblems = {};
  if (!selfReportedTextOk(row.name)) problems.name = "selfReportedTextLength";
  if (!selfReportedValueOk(row.value)) problems.value = "selfReportedValue";
  if (!selfReportedTextOk(row.unit)) problems.unit = "selfReportedTextLength";
  if (!selfReportedTextOk(row.region))
    problems.region = "selfReportedTextLength";
  if (!selfReportedPeriodOk(row.period, sealingDay)) {
    problems.period = "selfReportedPeriod";
  }
  return problems;
}

/**
 * True when every field of a self-reported row is empty after trimming. A blank
 * row is a row the visitor added and did not fill in. It changes nothing: it
 * passes validation and is left out of the payload.
 */
export function isEmptySelfReportedRow(row: SelfReportedRow): boolean {
  return SELF_REPORTED_FIELDS.every((field) => row[field].trim() === "");
}

/** The fields of a row that are empty after trimming, in form order. */
export function missingSelfReportedFields(
  row: SelfReportedRow,
): SelfReportedField[] {
  return SELF_REPORTED_FIELDS.filter((field) => row[field].trim() === "");
}

/**
 * True when every self-reported row passes its rules. An empty list passes. A
 * blank row passes, because it changes nothing. A partly filled row fails, so it
 * blocks sealing until every field is filled in or the row is removed.
 */
export function selfReportedRowsOk(
  rows: readonly SelfReportedRow[],
  sealingDay: string,
): boolean {
  return rows.every(
    (row) =>
      isEmptySelfReportedRow(row) ||
      Object.keys(selfReportedRowProblems(row, sealingDay)).length === 0,
  );
}

/** The touched-state key for one field of one self-reported row. */
export function selfReportedFieldKey(
  index: number,
  field: SelfReportedField,
): string {
  return `self-reported:${index}:${field}`;
}

/**
 * The problems a visitor should see now: only those whose field was touched or
 * whose seal was attempted (touched.ts). Values are never dropped, so a
 * message that stays hidden does not change what was typed.
 */
export function visibleSelfReportedProblems(
  problems: SelfReportedRowProblems,
  touched: TouchedState,
  index: number,
): SelfReportedRowProblems {
  const shown: SelfReportedRowProblems = {};
  for (const field of SELF_REPORTED_FIELDS) {
    const problem = problems[field];
    if (
      problem !== undefined &&
      showsFieldMessage(touched, selfReportedFieldKey(index, field))
    ) {
      shown[field] = problem;
    }
  }
  return shown;
}

export function validateWrite(input: {
  text: string;
  metricIds: readonly string[];
  warningTicked: boolean;
  /** The optional backup key card box (R21.1). Defaults to unticked. */
  backupCardTicked?: boolean;
  /** The figure maximum for this picker. Defaults to MAX_FIGURES. */
  maxFigures?: number;
  /** The Author_Question rows, in order. Defaults to none. */
  questions?: readonly string[];
  /**
   * The seal mode. Accepted so callers can pass it, but it does not change the
   * rule: demo and real mode need the same something to testify about.
   */
  mode?: WriteMode;
  /** The visitor's own numbers (spec 08 later-tasks, R1). Defaults to none. */
  selfReported?: readonly SelfReportedRow[];
  /**
   * The sealing day as YYYY-MM-DD, which a self-reported period may not pass.
   * Omitted means no period is accepted, so any row blocks sealing (fail closed).
   */
  sealingDay?: string;
}): WriteProblem[] {
  const maxFigures = input.maxFigures ?? MAX_FIGURES;
  const questions = input.questions ?? [];
  const problems: WriteProblem[] = [];

  if (input.text.trim().length === 0) {
    problems.push("letter_empty");
  } else if (countCodePoints(input.text) > MAX_LETTER_CODE_POINTS) {
    problems.push("letter_too_long");
  }

  if (questions.some((row) => questionRowProblem(row) !== null)) {
    problems.push("question_too_long");
  }

  if (
    !hasSomethingToTestify({
      questions,
      officialFigureCount: input.metricIds.length,
    })
  ) {
    problems.push("nothing_to_testify");
  }

  if (input.metricIds.length > maxFigures) {
    problems.push("figures_too_many");
  }

  if (!input.warningTicked && input.backupCardTicked !== true) {
    problems.push("warning_unticked");
  }

  if (
    !selfReportedRowsOk(
      (input.selfReported ?? []).filter((row) => !isEmptySelfReportedRow(row)),
      input.sealingDay ?? "",
    )
  ) {
    problems.push("self_reported_invalid");
  }

  return problems;
}
