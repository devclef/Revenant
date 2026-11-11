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
import type { FlowState } from "@/components/reveal/opening-machine";

import { LIVE_COPY } from "../copy";
import type { WriteMode } from "../form";
import {
  CLEARED_WRITE_DRAFT,
  initialWriteDraft,
  reduceWriteDraft,
  type WriteDraft,
  type WriteDraftEvent,
} from "../write-draft";

/** The five steps of /demo/live, in the order the visitor meets them (L1.6). */
export const LIVE_STEPS = [
  "write",
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
  LIVE_COPY.waitStep,
  RITUAL[2].name,
  RITUAL[3].name,
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

/**
 * The step the embedded Opening_Flow moves the stepper to (spec 09, D5.4). The
 * flow reaches Testify once the reader has unlocked and presses Begin (`recall`),
 * and Receipts once the reveal starts. Every other phase keeps the step where
 * it is, so the stepper never moves on its own.
 */
export function stepForFlowPhase(tag: FlowState["tag"]): LiveStep | null {
  switch (tag) {
    case "recall":
    case "submitting":
    case "submit_failed":
      return "testify";
    case "reveal":
      return "receipts";
    default:
      return null;
  }
}

/**
 * Whether the embedded Opening_Flow is mounted on the Wait card. It mounts only
 * once the countdown has reached zero, so the letter request is made once, at
 * zero (D5.2). Testify and Receipts keep it mounted.
 */
export function flowMounted(step: LiveStep, countdownDone: boolean): boolean {
  if (step === "testify" || step === "receipts") return true;
  return step === "wait" && countdownDone;
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
  | { type: "SEALED" }
  | { type: "GOTO"; step: LiveStep };

/**
 * The stepper state before anything is typed. `mode` picks the draft: demo
 * starts with the Live_Prefill row, real (`/seal`) with no row (spec 10, C2).
 */
export function initialStepperState(
  step: LiveStep = "write",
  mode: WriteMode = "demo",
): StepperState {
  return { step, draft: initialWriteDraft(mode), sealed: false };
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
      return { ...state, sealed: true, draft: CLEARED_WRITE_DRAFT };
    case "GOTO": {
      // Forward only. A step at or before the current one changes nothing, and
      // returning the same state keeps React from re-rendering.
      if (stepIndex(action.step) <= stepIndex(state.step)) return state;
      return { ...state, step: action.step };
    }
  }
}
