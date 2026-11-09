/**
 * The write step's form state for the live Seal_Page: the letter text, the
 * Author_Question rows, the chosen figures, the warning tick and the backup key
 * card tick. SealPage holds it, so it survives the cancelled, failed and
 * cannot_lock screens and Try again restores it (spec 06-lock-and-unlock,
 * R15.7). It holds no passkey, PRF or backup key material.
 *
 * Pure module: no React, safe in the browser and in tests.
 */

import { applyStarter, AUTHOR_QUESTIONS_MAX } from "./author-questions";
import { LIVE_COPY } from "./copy";
import { MAX_FIGURES } from "./constants";
import type { WriteMode } from "./form";

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
}

/**
 * The draft a seal starts from. `demo` (`/demo/live`) starts with the one
 * Live_Prefill row, which the judge may edit, clear or remove. `real` (`/seal`)
 * starts with no row and prefills nothing.
 */
export function initialWriteDraft(mode: WriteMode): WriteDraft {
  return {
    text: "",
    metricIds: [],
    warningTicked: false,
    backupCardTicked: false,
    questions: mode === "demo" ? [LIVE_COPY.livePrefill] : [],
  };
}

/** The demo draft. Kept as the value the stepper and the tests start from. */
export const INITIAL_WRITE_DRAFT: WriteDraft = initialWriteDraft("demo");

/**
 * The draft after a 201. Nothing is kept: no letter text, no figures, no
 * Author_Question rows (spec 10, C2.11). Unlike the demo draft, it has no
 * Live_Prefill row, so no question shows again until the letter opens.
 */
export const CLEARED_WRITE_DRAFT: WriteDraft = {
  text: "",
  metricIds: [],
  warningTicked: false,
  backupCardTicked: false,
  questions: [],
};

export type WriteDraftEvent =
  | { type: "TEXT_CHANGED"; text: string }
  | { type: "FIGURE_TOGGLED"; metricId: string; limit?: number }
  | { type: "WARNING_CHANGED"; ticked: boolean }
  | { type: "BACKUP_CARD_CHANGED"; ticked: boolean }
  | { type: "QUESTION_CHANGED"; index: number; text: string }
  | { type: "QUESTION_ADDED" }
  | { type: "QUESTION_REMOVED"; index: number }
  | { type: "QUESTION_STARTER"; text: string };

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
    case "QUESTION_STARTER":
      return { ...state, questions: applyStarter(state.questions, event.text) };
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
