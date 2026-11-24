/**
 * Reducer oracle for the Live_Stepper (spec 19, task 1.2).
 *
 * The functions below are copied verbatim from the baseline
 * (`src/components/live/stepper/live-steps.ts` at commit 3bee3055, which has the
 * same bytes as the HEAD file this task started from). They are not exported.
 * The copy is the oracle: a property test runs random action sequences through
 * both the copy and today's exported reducer and checks that step, draft,
 * sealed, stage and the same-object return agree at every step.
 *
 * The LIVE_STEPS constant and the three types are copied with them, because
 * the copied functions need them. The write-draft reducer is shared, so it is
 * imported, not copied.
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import type { Stage } from "@/components/ceremony/stages";

import type { WriteMode } from "../form";
import {
  CLEARED_WRITE_DRAFT,
  initialWriteDraft,
  reduceWriteDraft,
  type WriteDraft,
  type WriteDraftEvent,
} from "../write-draft";
import {
  canGoBack as todayCanGoBack,
  initialStepperState as todayInitialStepperState,
  reduceStepper as todayReduceStepper,
  stepForStage as todayStepForStage,
  stepIndex as todayStepIndex,
  type StepperAction,
  type StepperState,
} from "./live-steps";

// ---- Copied from the baseline (3bee3055), verbatim apart from this comment. ----

const LIVE_STEPS = [
  "write",
  "seal",
  "wait",
  "testify",
  "break",
  "receipts",
] as const;

type LiveStep = (typeof LIVE_STEPS)[number];

function stepIndex(step: LiveStep): number {
  return LIVE_STEPS.indexOf(step);
}

function canGoBack(step: LiveStep, sealed: boolean): boolean {
  if (sealed) return false;
  const index = stepIndex(step);
  return index > 0 && index < stepIndex("wait");
}

function stepForStage(stage: Stage): LiveStep | null {
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

interface OracleStepperState {
  step: LiveStep;
  draft: WriteDraft;
  sealed: boolean;
  stage: Stage;
}

type OracleStepperAction =
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "DRAFT"; event: WriteDraftEvent }
  | { type: "SEALED" }
  | { type: "GOTO"; step: LiveStep }
  | { type: "STAGE"; stage: Stage };

function initialStepperState(
  step: LiveStep = "write",
  mode: WriteMode = "demo",
): OracleStepperState {
  return {
    step,
    draft: initialWriteDraft(mode),
    sealed: false,
    stage: "emerging",
  };
}

function reduceStepper(
  state: OracleStepperState,
  action: OracleStepperAction,
): OracleStepperState {
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
    case "STAGE": {
      // One update stores the Stage and, when the Stage maps to a step, moves
      // forward to it (issue #385). A Stage that maps to an earlier step, or to
      // no step, leaves the step where it is. The step never moves back.
      const target = stepForStage(action.stage);
      const next =
        target !== null && stepIndex(target) > stepIndex(state.step)
          ? target
          : state.step;
      if (next === state.step && state.stage === action.stage) return state;
      return { ...state, stage: action.stage, step: next };
    }
  }
}

// ---- End of the copy. ----

/** Every Stage, from a Record that fails to compile when a Stage is missing. */
const STAGE_SET: Record<Stage, true> = {
  emerging: true,
  sealed: true,
  envelope: true,
  recall: true,
  marks: true,
  seal: true,
  letter: true,
  figures: true,
  close: true,
  error: true,
};
const STAGES = Object.keys(STAGE_SET) as Stage[];

const modeArb = fc.constantFrom<WriteMode>("demo");
const stepArb = fc.constantFrom(...LIVE_STEPS);
const stageArb = fc.constantFrom(...STAGES);

const draftEventArb: fc.Arbitrary<WriteDraftEvent> = fc.oneof(
  fc.record({
    type: fc.constant("TEXT_CHANGED"),
    text: fc.string({ maxLength: 40 }),
  }),
  fc.record({ type: fc.constant("WARNING_CHANGED"), ticked: fc.boolean() }),
  fc.record({ type: fc.constant("BACKUP_CARD_CHANGED"), ticked: fc.boolean() }),
  fc.record({
    type: fc.constant("QUESTION_ADDED"),
    text: fc.string({ maxLength: 40 }),
  }),
  fc.record({
    type: fc.constant("ANSWER_CHANGED"),
    index: fc.nat({ max: 2 }),
    text: fc.string({ maxLength: 40 }),
  }),
  fc.record({
    type: fc.constant("QUESTION_REMOVED"),
    index: fc.nat({ max: 2 }),
  }),
  fc.record({
    type: fc.constant("FIGURE_TOGGLED"),
    metricId: fc.constantFrom("us-gasoline-regular", "eu-diesel"),
  }),
) as fc.Arbitrary<WriteDraftEvent>;

const actionArb: fc.Arbitrary<StepperAction> = fc.oneof(
  fc.constant<StepperAction>({ type: "NEXT" }),
  fc.constant<StepperAction>({ type: "BACK" }),
  fc.constant<StepperAction>({ type: "SEALED" }),
  stepArb.map((step): StepperAction => ({ type: "GOTO", step })),
  stageArb.map((stage): StepperAction => ({ type: "STAGE", stage })),
  draftEventArb.map((event): StepperAction => ({ type: "DRAFT", event })),
);

/** The copy's action, built from the same value the exported reducer receives. */
function asOracleAction(action: StepperAction): OracleStepperAction {
  return action as OracleStepperAction;
}

describe("live-steps oracle (spec 19, task 1.2)", () => {
  it("the copied initial state equals today's for demo mode and every step", () => {
    // The oracle is the Demo_Mode reducer of 3bee3055. Today's state adds the
    // `mode` field, which the copy has no reason to carry, so it is set here.
    for (const step of LIVE_STEPS) {
      expect(todayInitialStepperState(step, "demo")).toEqual({
        ...initialStepperState(step, "demo"),
        mode: "demo",
      });
    }
  });

  it("step index, Back rule and Stage-to-step mapping equal today's", () => {
    for (const step of LIVE_STEPS) {
      expect(stepIndex(step)).toBe(todayStepIndex(step));
      for (const sealed of [false, true]) {
        expect(canGoBack(step, sealed)).toBe(todayCanGoBack(step, sealed));
      }
    }
    for (const stage of STAGES) {
      expect(stepForStage(stage)).toBe(todayStepForStage(stage));
    }
  });

  it("the copied reducer agrees with today's on step, draft, sealed, stage and same-object returns", () => {
    fc.assert(
      fc.property(
        modeArb,
        fc.array(actionArb, { maxLength: 60 }),
        (mode, actions) => {
          let oracle: OracleStepperState = initialStepperState("write", mode);
          let today: StepperState = todayInitialStepperState("write", mode);
          for (const action of actions) {
            const nextOracle = reduceStepper(oracle, asOracleAction(action));
            const nextToday = todayReduceStepper(today, action);

            expect(nextToday.step).toBe(nextOracle.step);
            expect(nextToday.draft).toEqual(nextOracle.draft);
            expect(nextToday.sealed).toBe(nextOracle.sealed);
            expect(nextToday.stage).toBe(nextOracle.stage);
            // A same-object return is the reducer's "nothing changed" answer. Both
            // reducers must agree on which actions give it.
            expect(Object.is(nextToday, today)).toBe(
              Object.is(nextOracle, oracle),
            );

            oracle = nextOracle;
            today = nextToday;
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});
