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
import type { WriteMode } from "./form";
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

export interface WriteDraft {
  text: string;
  metricIds: string[];
  warningTicked: boolean;
  /** Whether the visitor also asks for a backup key card (R21.1). */
  backupCardTicked: boolean;
  /**
   * The Author_Question rows, in order (spec 10, C2). A demo draft starts with
   * the Live_Prefill row (C9.5); a real draft starts with none.
   */
  questions: string[];
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
    warningTicked: false,
    backupCardTicked: false,
    questions: [DEFAULT_QUESTION],
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
  warningTicked: false,
  backupCardTicked: false,
  questions: [],
  selfReported: [],
};

export type WriteDraftEvent =
  | { type: "TEXT_CHANGED"; text: string }
  | { type: "FIGURE_TOGGLED"; metricId: string; limit?: number }
  | { type: "WARNING_CHANGED"; ticked: boolean }
  | { type: "BACKUP_CARD_CHANGED"; ticked: boolean }
  | { type: "QUESTION_CHANGED"; index: number; text: string }
  | { type: "QUESTION_ADDED" }
  | { type: "QUESTION_REMOVED"; index: number }
  | { type: "OCCASION_APPLIED"; text: string; questions: string[] }
  | { type: "SELF_REPORTED_ADDED" }
  | {
      type: "SELF_REPORTED_CHANGED";
      index: number;
      field: SelfReportedField;
      text: string;
    }
  | { type: "SELF_REPORTED_REMOVED"; index: number };

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
    case "QUESTION_CHANGED":
      return {
        ...state,
        questions: state.questions.map((row, i) =>
          i === event.index ? event.text : row,
        ),
      };
    case "QUESTION_ADDED":
      if (state.questions.length >= AUTHOR_QUESTIONS_MAX) return state;
      return { ...state, questions: [...state.questions, ""] };
    case "QUESTION_REMOVED":
      return {
        ...state,
        questions: state.questions.filter((_, i) => i !== event.index),
      };
    case "OCCASION_APPLIED":
      // The text and rows come from applyOccasion, which already keeps what the
      // visitor typed (L2.2). No Occasion identifier is stored here (L2.5).
      return { ...state, text: event.text, questions: [...event.questions] };
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
