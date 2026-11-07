/**
 * The step order and the stepper state for the Live_Stepper (spec 09, D2).
 *
 * Pure module: no React, so the order, Back rule and draft handling are tested
 * in Node. The stepper keeps the write draft in this state while the visitor
 * moves between steps, so Back before the seal keeps the text, the figures and
 * the backup decision (D2.2). Once the seal is stored, the draft is dropped and
 * Back is no longer offered (D2.3).
 */

import { BRAND_COPY } from "@/components/brand/copy";

import { LIVE_COPY } from "../copy";
import {
  INITIAL_WRITE_DRAFT,
  reduceWriteDraft,
  type WriteDraft,
  type WriteDraftEvent,
} from "../write-draft";

/** The six steps of /demo/live, in the order the visitor meets them. */
export const LIVE_STEPS = [
  "write",
  "figures",
  "seal",
  "wait",
  "testify",
  "receipts",
] as const;

export type LiveStep = (typeof LIVE_STEPS)[number];

/**
 * The visible step names. The names come from Brand_Copy (spec 09 F2), except
 * "Wait", which Brand_Copy does not list, so it comes from LIVE_COPY.
 */
const RITUAL = BRAND_COPY.ritualSteps;
export const LIVE_STEP_NAMES: readonly string[] = [
  RITUAL[0].name,
  RITUAL[1].name,
  RITUAL[2].name,
  LIVE_COPY.waitStep,
  RITUAL[3].name,
  RITUAL[4].name,
];

/** The position of a step in LIVE_STEPS, counted from 0. */
export function stepIndex(step: LiveStep): number {
  return LIVE_STEPS.indexOf(step);
}

/** The visible name of a step. */
export function stepName(step: LiveStep): string {
  return LIVE_STEP_NAMES[stepIndex(step)] ?? "";
}

/**
 * Back is offered from the second step up to the seal, and only before the
 * seal is stored. From `wait` on there is no way back to the write steps.
 */
export function canGoBack(step: LiveStep, sealed: boolean): boolean {
  if (sealed) return false;
  const index = stepIndex(step);
  return index > 0 && index < stepIndex("wait");
}

/** A step change moves focus to the new step's heading (spec 09 D2.6). */
export function movesFocus(from: LiveStep, to: LiveStep): boolean {
  return from !== to;
}

export interface StepperState {
  step: LiveStep;
  draft: WriteDraft;
  /** True once the seal is stored. The draft is dropped at that point. */
  sealed: boolean;
}

export type StepperAction =
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "DRAFT"; event: WriteDraftEvent }
  | { type: "SEALED" };

export function initialStepperState(step: LiveStep = "write"): StepperState {
  return { step, draft: INITIAL_WRITE_DRAFT, sealed: false };
}

export function reduceStepper(
  state: StepperState,
  action: StepperAction,
): StepperState {
  switch (action.type) {
    case "NEXT": {
      const index = stepIndex(state.step);
      const last = LIVE_STEPS.length - 1;
      if (index >= last) return state;
      return { ...state, step: LIVE_STEPS[index + 1] };
    }
    case "BACK": {
      if (!canGoBack(state.step, state.sealed)) return state;
      return { ...state, step: LIVE_STEPS[stepIndex(state.step) - 1] };
    }
    case "DRAFT": {
      if (state.sealed) return state;
      return { ...state, draft: reduceWriteDraft(state.draft, action.event) };
    }
    case "SEALED":
      return { ...state, sealed: true, draft: INITIAL_WRITE_DRAFT };
  }
}
