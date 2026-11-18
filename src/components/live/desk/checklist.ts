import { AUTHOR_QUESTIONS_MAX } from "../author-questions";
import type { SelfReportedRow } from "../write-draft";

/**
 * The In_The_Envelope checklist (spec 14, W9.5 to W9.8). Pure: no React and no
 * browser APIs, so the envelope card, the phone line and the tests share it.
 * Both views count whatever the toggle shows (W9.5).
 */

export type ChecklistInput = {
  text: string;
  questions: readonly string[];
  metricIds: readonly string[];
  /** The one Own_Number_View row, or null when there is none. */
  ownNumber: SelfReportedRow | null;
};

export type Checklist = {
  /** "{n} words" | "1 word" | "not written yet" */
  letter: string;
  /** "{k} of 3" */
  questions: string;
  /** "none yet" | "1 price" | "{n} prices" | "1 own number", joined with " · " */
  receipt: string;
  /** True when the matching value is not its empty form (W9.6). */
  present: { letter: boolean; questions: boolean; receipt: boolean };
  /** "Letter · 3 questions · no receipt" (W9.8). */
  phoneLine: string;
};

const NOT_WRITTEN = "not written yet";
const NO_QUESTIONS = "0 of 3";
const NONE_YET = "none yet";
const PART_SEPARATOR = " · ";

/**
 * The number of words in a letter: runs of non-space characters. The result is
 * 0 for an empty or all-whitespace letter.
 */
export function wordCount(text: string): number {
  return text.split(/\s+/u).filter(Boolean).length;
}

/** True when name, value, unit and region are all non-empty after trimming. */
function ownNumberComplete(row: SelfReportedRow | null): boolean {
  if (row === null) return false;
  return (
    row.name.trim() !== "" &&
    row.value.trim() !== "" &&
    row.unit.trim() !== "" &&
    row.region.trim() !== ""
  );
}

/** Builds the checklist for a draft. Counts only what the visitor filled in. */
export function envelopeChecklist(input: ChecklistInput): Checklist {
  const words = wordCount(input.text);
  const letter =
    words === 0 ? NOT_WRITTEN : words === 1 ? "1 word" : `${words} words`;

  const questionCount = input.questions.filter(
    (row) => row.trim() !== "",
  ).length;
  const questions = `${questionCount} of ${AUTHOR_QUESTIONS_MAX}`;

  const prices = new Set(input.metricIds).size;
  const receiptParts: string[] = [];
  if (prices === 1) receiptParts.push("1 price");
  else if (prices > 1) receiptParts.push(`${prices} prices`);
  if (ownNumberComplete(input.ownNumber)) receiptParts.push("1 own number");
  const receipt =
    receiptParts.length === 0 ? NONE_YET : receiptParts.join(PART_SEPARATOR);

  const letterPart = words === 0 ? "No letter yet" : "Letter";
  const questionsPart =
    questionCount === 0
      ? "no questions"
      : questionCount === 1
        ? "1 question"
        : `${questionCount} questions`;
  const receiptPart = receiptParts.length === 0 ? "no receipt" : receipt;

  return {
    letter,
    questions,
    receipt,
    present: {
      letter: letter !== NOT_WRITTEN,
      questions: questions !== NO_QUESTIONS,
      receipt: receipt !== NONE_YET,
    },
    phoneLine: [letterPart, questionsPart, receiptPart].join(PART_SEPARATOR),
  };
}
