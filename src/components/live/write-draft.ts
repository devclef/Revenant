/**
 * The write step's form state for the live Seal_Page: the letter text, the
 * chosen figures and the warning tick. SealPage holds it, so it survives the
 * cancelled, failed and cannot_lock screens and Try again restores it
 * (spec 06-lock-and-unlock, R15.7). It holds no passkey, PRF or backup key
 * material.
 *
 * Pure module: no React, safe in the browser and in tests.
 */

import { MAX_FIGURES } from "./constants";

export interface WriteDraft {
  text: string;
  metricIds: string[];
  warningTicked: boolean;
}

export const INITIAL_WRITE_DRAFT: WriteDraft = {
  text: "",
  metricIds: [],
  warningTicked: false,
};

export type WriteDraftEvent =
  | { type: "TEXT_CHANGED"; text: string }
  | { type: "FIGURE_TOGGLED"; metricId: string }
  | { type: "WARNING_CHANGED"; ticked: boolean };

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
    case "FIGURE_TOGGLED": {
      const { metricId } = event;
      if (state.metricIds.includes(metricId)) {
        return {
          ...state,
          metricIds: state.metricIds.filter((id) => id !== metricId),
        };
      }
      if (state.metricIds.length >= MAX_FIGURES) return state;
      return { ...state, metricIds: [...state.metricIds, metricId] };
    }
  }
}
