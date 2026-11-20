/**
 * The write step's form state for the live Seal_Page: the letter text, the
 * Author_Question rows, the chosen figures, the warning tick and the backup key
 * card tick. SealPage holds it, so it survives the cancelled, failed and
 * cannot_lock screens and Try again restores it (spec 06-lock-and-unlock,
 * R15.7). It holds no passkey, PRF or backup key material.
 *
 * Pure module: no React, safe in the browser and in tests.
 */

import { AUTHOR_QUESTIONS_MAX } from "./author-questions";
import { MAX_FIGURES, SELF_REPORTED_MAX } from "./constants";
import {
  missingSelfReportedFields,
  validateWrite,
  type WriteMode,
} from "./form";
import { DEFAULT_QUESTION as OCCASION_DEFAULT_QUESTION } from "./occasions";

/**
 * A number the visitor types in as their own (spec 08 later-tasks, R1). Every
 * field is the text as typed; validation lives in form.ts and nothing here
 * trims, rescales or parses it.
 */
export interface SelfReportedRow {
  name: string;
  value: string;
  unit: string;
  region: string;
  period: string;
}

/** The text fields of a SelfReportedRow, by name. */
export type SelfReportedField = keyof SelfReportedRow;

/**
 * The Backup_Choice on the Seal step (spec 13, P7): "card" asks for a backup key
 * card, "skip" is the visitor's explicit confirmation that a lost passkey means
 * a lost letter. Nothing is selected until the visitor picks one.
 */
export type BackupChoiceValue = "card" | "skip";

export interface WriteDraft {
  text: string;
  metricIds: string[];
  /**
   * The Backup_Choice, or null when none is selected (P7.2). The two flags below
   * are derived from it by the reducer, so validation and the seal flow read the
   * same values as before.
   */
  backupChoice: BackupChoiceValue | null;
  warningTicked: boolean;
  /** Whether the visitor also asks for a backup key card (R21.1). */
  backupCardTicked: boolean;
  /**
   * The Author_Question rows, in order (spec 10, C2). A demo draft starts with
   * the Live_Prefill row (C9.5); a real draft starts with none.
   */
  questions: string[];
  /**
   * The author's answer to each Author_Question, index-aligned with `questions`
   * (spec 15, R7.1). An empty string is an answer not yet written.
   */
  answers: string[];
  /** The visitor's own numbers, in order, at most SELF_REPORTED_MAX rows. */
  selfReported: SelfReportedRow[];
}

/** The one Author_Question a new letter starts with (C9.5, the Live_Prefill row). */
export const DEFAULT_QUESTION: string = OCCASION_DEFAULT_QUESTION;

/** A row with every field empty, as a new row starts. */
export function emptySelfReportedRow(): SelfReportedRow {
  return { name: "", value: "", unit: "", region: "", period: "" };
}

/**
 * The draft a seal starts from, in both modes. It starts with the one
 * DEFAULT_QUESTION row, which the visitor may edit, clear or remove, so a new
 * letter is never blocked by the something-to-testify rule.
 */
// The seal mode is accepted so existing callers still pass it. The draft is the
// same in both modes, so the parameter is not read.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function initialWriteDraft(_mode: WriteMode): WriteDraft {
  return {
    text: "",
    metricIds: [],
    backupChoice: null,
    warningTicked: false,
    backupCardTicked: false,
    questions: [DEFAULT_QUESTION],
    answers: [""],
    selfReported: [],
  };
}

/** The demo draft. Kept as the value the stepper and the tests start from. */
export const INITIAL_WRITE_DRAFT: WriteDraft = initialWriteDraft("demo");

/**
 * The draft after a 201. Nothing is kept: no letter text, no figures, no
 * Author_Question rows, no self-reported numbers (spec 10, C2.11). Unlike the
 * demo draft, it has no Live_Prefill row, so no question shows again until the
 * letter opens.
 */
export const CLEARED_WRITE_DRAFT: WriteDraft = {
  text: "",
  metricIds: [],
  backupChoice: null,
  warningTicked: false,
  backupCardTicked: false,
  questions: [],
  answers: [],
  selfReported: [],
};

export type WriteDraftEvent =
  | { type: "TEXT_CHANGED"; text: string }
  | { type: "FIGURE_TOGGLED"; metricId: string; limit?: number }
  | { type: "WARNING_CHANGED"; ticked: boolean }
  | { type: "BACKUP_CARD_CHANGED"; ticked: boolean }
  | { type: "BACKUP_CHOICE_CHANGED"; choice: BackupChoiceValue | null }
  | { type: "QUESTION_CHANGED"; index: number; text: string }
  | { type: "QUESTION_ADDED"; text: string }
  | { type: "QUESTION_REMOVED"; index: number }
  | { type: "ANSWER_CHANGED"; index: number; text: string }
  | { type: "OCCASION_APPLIED"; text: string; questions: string[] }
  | { type: "SELF_REPORTED_ADDED" }
  | {
      type: "SELF_REPORTED_CHANGED";
      index: number;
      field: SelfReportedField;
      text: string;
    }
  | { type: "SELF_REPORTED_REMOVED"; index: number }
  | {
      type: "OWN_NUMBER_CHANGED";
      field: OwnNumberField;
      text: string;
      /** The local sealing day, YYYY-MM-DD. Used only when the row is in use. */
      sealingDay: string;
    };

/**
 * The answers of a draft, padded or cut to one per question, so a missing
 * answer reads as "" and the two arrays always line up (R7.5).
 */
function alignedAnswers(state: WriteDraft): string[] {
  return state.questions.map((_, i) => state.answers[i] ?? "");
}

/**
 * The answer each new question row keeps after an Occasion pick (spec 15,
 * R7.5). A row the author edited keeps its text, so it matches its own answer
 * here. A row the Occasion replaced has no match and starts empty. Rows are
 * matched in order, so a repeated question keeps the answer of its own row.
 */
export function answersForOccasion(
  before: { questions: readonly string[]; answers: readonly string[] },
  nextQuestions: readonly string[],
): string[] {
  let from = 0;
  return nextQuestions.map((text) => {
    for (let m = from; m < before.questions.length; m += 1) {
      if (before.questions[m] === text) {
        from = m + 1;
        return before.answers[m] ?? "";
      }
    }
    return "";
  });
}

/** The four typed fields of the Own_Number_View. The period is not typed (W12.3). */
export type OwnNumberField = "name" | "value" | "unit" | "region";

const OWN_NUMBER_FIELDS: readonly OwnNumberField[] = [
  "name",
  "value",
  "unit",
  "region",
];

/**
 * The own-number fields that are empty after trimming, in form order. The
 * period is left out: the Own_Number_View never shows it, because it is always
 * the sealing day once the row is used (W12.3, W12.4).
 */
export function ownNumberMissing(row: SelfReportedRow): SelfReportedField[] {
  return missingSelfReportedFields(row).filter((field) => field !== "period");
}

/**
 * Applies one form event. Picking a figure adds it, unless it is already
 * chosen (then it is removed) or the letter already has MAX_FIGURES.
 */
export function reduceWriteDraft(
  state: WriteDraft,
  event: WriteDraftEvent,
): WriteDraft {
  switch (event.type) {
    case "TEXT_CHANGED":
      return { ...state, text: event.text };
    case "WARNING_CHANGED":
      return { ...state, warningTicked: event.ticked };
    case "BACKUP_CARD_CHANGED":
      return { ...state, backupCardTicked: event.ticked };
    case "BACKUP_CHOICE_CHANGED":
      // One choice drives the two flags the rest of the form reads. Picking
      // "skip" counts as the warning confirmation (P7.3); nothing else is kept.
      return {
        ...state,
        backupChoice: event.choice,
        warningTicked: event.choice !== null,
        backupCardTicked: event.choice === "card",
      };
    case "QUESTION_CHANGED":
      return {
        ...state,
        questions: state.questions.map((row, i) =>
          i === event.index ? event.text : row,
        ),
      };
    case "QUESTION_ADDED":
      if (state.questions.length >= AUTHOR_QUESTIONS_MAX) return state;
      return {
        ...state,
        questions: [...state.questions, event.text],
        answers: [...alignedAnswers(state), ""],
      };
    case "QUESTION_REMOVED":
      // The answer goes with its question (spec 15, R7.5).
      return {
        ...state,
        questions: state.questions.filter((_, i) => i !== event.index),
        answers: alignedAnswers(state).filter((_, i) => i !== event.index),
      };
    case "ANSWER_CHANGED":
      return {
        ...state,
        answers: alignedAnswers(state).map((row, i) =>
          i === event.index ? event.text : row,
        ),
      };
    case "OCCASION_APPLIED":
      // The text and rows come from applyOccasion, which already keeps what the
      // visitor typed (L2.2). No Occasion identifier is stored here (L2.5). The
      // answers follow their questions (spec 15, R7.5).
      return {
        ...state,
        text: event.text,
        questions: [...event.questions],
        answers: answersForOccasion(
          { questions: state.questions, answers: alignedAnswers(state) },
          event.questions,
        ),
      };
    case "SELF_REPORTED_ADDED":
      if (state.selfReported.length >= SELF_REPORTED_MAX) return state;
      return {
        ...state,
        selfReported: [...state.selfReported, emptySelfReportedRow()],
      };
    case "SELF_REPORTED_CHANGED":
      return {
        ...state,
        selfReported: state.selfReported.map((row, i) =>
          i === event.index ? { ...row, [event.field]: event.text } : row,
        ),
      };
    case "SELF_REPORTED_REMOVED":
      return {
        ...state,
        selfReported: state.selfReported.filter((_, i) => i !== event.index),
      };
    case "OWN_NUMBER_CHANGED": {
      // The own number is always exactly one row (W12). Its period is the
      // sealing day while any of the four typed fields has text, and "" when
      // all four are blank, so a blank view seals nothing (W12.3, W12.4).
      const current = state.selfReported[0] ?? emptySelfReportedRow();
      const row: SelfReportedRow = { ...current, [event.field]: event.text };
      const used = OWN_NUMBER_FIELDS.some((field) => row[field].trim() !== "");
      return {
        ...state,
        selfReported: [{ ...row, period: used ? event.sealingDay : "" }],
      };
    }
    case "FIGURE_TOGGLED": {
      const { metricId } = event;
      if (state.metricIds.includes(metricId)) {
        return {
          ...state,
          metricIds: state.metricIds.filter((id) => id !== metricId),
        };
      }
      if (state.metricIds.length >= (event.limit ?? MAX_FIGURES)) return state;
      return { ...state, metricIds: [...state.metricIds, metricId] };
    }
  }
}

/**
 * Whether the Seal press may start (spec 13, design section 2, P1.5). It needs
 * a Backup_Choice and a write draft with no write problem. Pure: it reads the
 * draft and the sealing day, and nothing else.
 */
export function canPress(draft: WriteDraft, sealingDay: string): boolean {
  if (draft.backupChoice === null) return false;
  return (
    validateWrite({
      text: draft.text,
      metricIds: draft.metricIds,
      warningTicked: draft.warningTicked,
      backupCardTicked: draft.backupCardTicked,
      questions: draft.questions,
      selfReported: draft.selfReported,
      sealingDay,
    }).length === 0
  );
}
