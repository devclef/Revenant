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
import { CEREMONY_COPY } from "@/components/ceremony/copy";
import type { Stage } from "@/components/ceremony/stages";
import type { FlowState } from "@/components/reveal/opening-machine";

import { LIVE_COPY, REAL_COPY } from "../copy";
import {
  CLEARED_WRITE_DRAFT,
  initialWriteDraft,
  reduceWriteDraft,
  type WriteDraft,
  type WriteDraftEvent,
} from "../write-draft";

/**
 * The six steps of /demo/live, in the order the visitor meets them. `break` is
 * the reveal's seal break, so the stepper shows it between Testify and Receipts.
 * Issue #385: there were five steps before, with no break step, so the stepper
 * jumped from Testify to See the receipts. Spec 11 (L1.6) had the five.
 */
export const LIVE_STEPS = [
  "write",
  "seal",
  "wait",
  "testify",
  "break",
  "receipts",
] as const;

export type LiveStep = (typeof LIVE_STEPS)[number];

/** The two modes the stepper runs in: the /demo/live rehearsal and the real /seal. */
export type StepperMode = "demo" | "real";

/**
 * The three steps of the real stepper on /seal: write, press the seal, and the
 * sealed step (shown as Keep). A real letter has no Wait, Testify, Break or
 * Receipts step (spec 08, R15).
 */
export const REAL_STEPS = ["write", "seal", "sealed"] as const;

export type RealStep = (typeof REAL_STEPS)[number];

/**
 * Every value the stepper state can hold. `sealed` is the state after the seal
 * is stored in real mode; no step list contains it.
 */
export type StepperStep = LiveStep | RealStep | "sealed";

/** The ordered steps for a mode. */
export function stepsFor(mode: StepperMode): readonly StepperStep[] {
  return mode === "real" ? REAL_STEPS : LIVE_STEPS;
}

/** The ordered visible names for a mode. */
export function stepNamesFor(mode: StepperMode): readonly string[] {
  return mode === "real" ? REAL_STEP_NAMES : LIVE_STEP_NAMES;
}

/** Whether a step belongs to the demo step list (LIVE_STEPS). */
export function isDemoStep(step: StepperStep): step is LiveStep {
  return (LIVE_STEPS as readonly string[]).includes(step);
}

/** The position of a step in the mode's list, counted from 0. */
export function stepIndex(
  step: StepperStep,
  mode: StepperMode = "demo",
): number {
  return stepsFor(mode).indexOf(step);
}

/** The visible name of a step in the mode's list. */
export function stepName(
  step: StepperStep,
  mode: StepperMode = "demo",
): string {
  return stepNamesFor(mode)[stepIndex(step, mode)] ?? "";
}

/**
 * Back is offered from the second step up to the seal, and only before the
 * seal is stored. From `wait` (demo) or `keep` (real) on there is no way back.
 */
export function canGoBack(
  step: StepperStep,
  sealed: boolean,
  mode: StepperMode = "demo",
): boolean {
  if (sealed) return false;
  const index = stepIndex(step, mode);
  const noBackFrom: StepperStep = mode === "real" ? "sealed" : "wait";
  return index > 0 && index < stepIndex(noBackFrom, mode);
}

/**
 * The visible step names. The names come from Brand_Copy (spec 09 F2), except
 * "Wait", which Brand_Copy does not list, so it comes from LIVE_COPY. "Break
 * the seal" comes from CEREMONY_COPY.steps[1], the same name the reveal shows.
 */
const RITUAL = BRAND_COPY.ritualSteps;
export const LIVE_STEP_NAMES: readonly string[] = [
  RITUAL[0].name,
  RITUAL[1].name,
  LIVE_COPY.waitStep,
  RITUAL[2].name,
  CEREMONY_COPY.steps[1],
  LIVE_COPY.receiptsStep,
];

/** The visible names of the real steps. Only the names come from elsewhere. */
export const REAL_STEP_NAMES: readonly string[] = [
  RITUAL[0].name,
  RITUAL[1].name,
  REAL_COPY.keepStep,
];

/** The Step_Track states live in step-track.ts. Re-exported for the stepper. */
export { stepTrackStates, type StepTrackState } from "./step-track";

/**
 * The step the embedded Opening_Flow moves the stepper to (spec 09, D5.4). The
 * flow reaches Testify once the reader has unlocked and presses Begin (`recall`,
 * `submitting`, `submit_failed`). `reveal` returns null: Break and Receipts
 * follow the reveal Stage through `stepForStage`, not the flow phase. Every
 * other phase keeps the step where it is, so the stepper never moves on its own.
 */
export function stepForFlowPhase(tag: FlowState["tag"]): LiveStep | null {
  switch (tag) {
    case "recall":
    case "submitting":
    case "submit_failed":
      return "testify";
    default:
      return null;
  }
}

/**
 * The step for a reveal Stage (issue #385). `marks` and `seal` are the seal
 * break. `letter`, `figures` and `close` are Receipts. Stages before the break
 * and `error` return null, so the stepper does not move for them.
 */
export function stepForStage(stage: Stage): LiveStep | null {
  switch (stage) {
    case "marks":
    case "seal":
      return "break";
    case "letter":
    case "figures":
    case "close":
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
export function flowMounted(
  step: StepperStep,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept so flowPortalTarget's callers keep their shape
  _countdownDone: boolean,
): boolean {
  // `break` is the seal break inside the reveal (issue #385). The flow must
  // stay mounted there, or the reveal unmounts as the seal breaks.
  // Wait never mounts the flow (spec 15, R9.5): "Open your letter" moves the
  // stepper to Testify, and the flow mounts there. The countdown no longer
  // decides anything, and the parameter stays so the callers keep their shape.
  return step === "testify" || step === "break" || step === "receipts";
}

/**
 * Whether a step is drawn on the Primary_Card (spec 12, X1). Write and Seal are
 * on the card. Wait, Testify and Receipts sit on the desk, below the card,
 * inside the Reveal_Host.
 */
export function hasPrimaryCard(step: StepperStep): boolean {
  return step === "write";
}

/**
 * Whether the stepper draws the step-name h2 above the step's content. Only
 * Wait gets one here. Write and Seal bring their own heading from the page
 * (SealPage, spec 14), and Testify and Receipts have none.
 */
export function stepperDrawsHeading(step: StepperStep): boolean {
  return step === "wait";
}

/**
 * The element the embedded Opening_Flow is portalled into (spec 12, X1). It is
 * the Reveal_Host once the flow is mounted, and null before that. The host
 * never changes once it is set, so the portal target stays the same across
 * Wait, Testify and Receipts.
 */
export function flowPortalTarget<T>(
  host: T | null,
  step: StepperStep,
  countdownDone: boolean,
): T | null {
  return flowMounted(step, countdownDone) ? host : null;
}

/** A step change moves focus to the new step's heading (spec 09 D2.6). */
export function movesFocus(from: StepperStep, to: StepperStep): boolean {
  return from !== to;
}

export interface StepperState {
  /** The mode the state was created for. No action changes it. */
  mode: StepperMode;
  step: StepperStep;
  draft: WriteDraft;
  /** True once the seal is stored. The draft is dropped at that point. */
  sealed: boolean;
  /** The reveal Stage last reported by the Ceremony (issue #385). */
  stage: Stage;
}

export type StepperAction =
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "DRAFT"; event: WriteDraftEvent }
  | { type: "SEALED" }
  | { type: "GOTO"; step: StepperStep }
  | { type: "STAGE"; stage: Stage };

/**
 * The stepper state before anything is typed. `mode` picks the step list and
 * the draft: demo starts with the Live_Prefill row, real (`/seal`) with no row
 * (spec 10, C2). A step outside the mode's list starts on `write`. Real mode
 * starting on `sealed` creates the sealed state with the draft cleared.
 */
export function initialStepperState(
  step: StepperStep = "write",
  mode: StepperMode = "demo",
): StepperState {
  if (mode === "real" && step === "sealed") {
    return {
      mode,
      step,
      draft: CLEARED_WRITE_DRAFT,
      sealed: true,
      stage: "emerging",
    };
  }
  const start = stepsFor(mode).includes(step) ? step : "write";
  return {
    mode,
    step: start,
    draft: initialWriteDraft(mode),
    sealed: false,
    stage: "emerging",
  };
}

/** Dispatches on the state's mode. Neither reducer writes `mode`. */
export function reduceStepper(
  state: StepperState,
  action: StepperAction,
): StepperState {
  return state.mode === "real"
    ? reduceReal(state, action)
    : reduceDemo(state, action);
}

/** The Demo_Mode reducer. Its body is the reducer from before spec 19. */
function reduceDemo(state: StepperState, action: StepperAction): StepperState {
  switch (action.type) {
    case "NEXT": {
      const index = stepIndex(state.step, "demo");
      const last = LIVE_STEPS.length - 1;
      if (index >= last) return state;
      return { ...state, step: LIVE_STEPS[index + 1] };
    }
    case "BACK": {
      if (!canGoBack(state.step, state.sealed, "demo")) return state;
      return {
        ...state,
        step: LIVE_STEPS[stepIndex(state.step, "demo") - 1],
      };
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
      if (stepIndex(action.step, "demo") <= stepIndex(state.step, "demo")) {
        return state;
      }
      return { ...state, step: action.step };
    }
    case "STAGE": {
      // One update stores the Stage and, when the Stage maps to a step, moves
      // forward to it (issue #385). A Stage that maps to an earlier step, or to
      // no step, leaves the step where it is. The step never moves back.
      const target = stepForStage(action.stage);
      const next =
        target !== null &&
        stepIndex(target, "demo") > stepIndex(state.step, "demo")
          ? target
          : state.step;
      if (next === state.step && state.stage === action.stage) return state;
      return { ...state, stage: action.stage, step: next };
    }
  }
}

/**
 * The Real_Mode reducer for /seal. Its steps are REAL_STEPS. Back is offered
 * only on `seal` before the seal is stored, and `sealed` is reached only after
 * the seal is stored.
 */
function reduceReal(state: StepperState, action: StepperAction): StepperState {
  switch (action.type) {
    case "NEXT": {
      if (state.step === "write") return { ...state, step: "seal" };
      if (state.step === "seal" && state.sealed) {
        return { ...state, step: "sealed" };
      }
      return state;
    }
    case "BACK": {
      if (!canGoBack(state.step, state.sealed, "real")) return state;
      return { ...state, step: "write" };
    }
    case "DRAFT": {
      if (state.sealed) return state;
      return { ...state, draft: reduceWriteDraft(state.draft, action.event) };
    }
    case "SEALED":
      return { ...state, sealed: true, draft: CLEARED_WRITE_DRAFT };
    case "GOTO": {
      const target = action.step;
      if (!stepsFor("real").includes(target)) return state;
      if (stepIndex(target, "real") <= stepIndex(state.step, "real")) {
        return state;
      }
      if (target === "sealed" && !state.sealed) return state;
      return { ...state, step: target };
    }
    case "STAGE": {
      // The step never moves in Real_Mode. Only the stored Stage changes.
      if (state.stage === action.stage) return state;
      return { ...state, stage: action.stage };
    }
  }
}
