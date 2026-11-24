/**
 * Properties 2 and 3 of spec 19 for the Real_Mode stepper.
 *
 * Property 2 keeps the step inside write, seal and sealed (requirements 1.3,
 * 1.11, 8.2). Property 3 checks the real reducer against a reference model of
 * the real action table (requirements 1.5 to 1.8, 3.10).
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import type { Stage } from "@/components/ceremony/stages";

import {
  CLEARED_WRITE_DRAFT,
  reduceWriteDraft,
  type WriteDraft,
  type WriteDraftEvent,
} from "../write-draft";

import {
  REAL_STEPS,
  initialStepperState,
  reduceStepper,
  type StepperAction,
  type StepperState,
  type StepperStep,
} from "./live-steps";

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

/** All seven StepperStep values, so GOTO covers every target. */
const GOTO_TARGETS: StepperStep[] = [
  "write",
  "seal",
  "wait",
  "testify",
  "break",
  "receipts",
  "sealed",
];

const startArb = fc.constantFrom(...REAL_STEPS);
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
  fc
    .constantFrom(...GOTO_TARGETS)
    .map((step): StepperAction => ({ type: "GOTO", step })),
  stageArb.map((stage): StepperAction => ({ type: "STAGE", stage })),
  draftEventArb.map((event): StepperAction => ({ type: "DRAFT", event })),
);

const sequenceArb = fc.array(actionArb, { maxLength: 40 });

/** The position of a step in the Real_Step_List, or -1 outside it. */
function realPosition(step: StepperStep): number {
  return (REAL_STEPS as readonly StepperStep[]).indexOf(step);
}

describe("Property 2: the real stepper stays inside its three steps", () => {
  it("keeps the step in the Real_Step_List, sealed only once sealed, and never moving back once sealed", () => {
    fc.assert(
      fc.property(startArb, sequenceArb, (start, actions) => {
        let state: StepperState = initialStepperState(start, "real");
        for (const action of actions) {
          const before = state;
          state = reduceStepper(state, action);

          expect(state.mode).toBe("real");
          expect(realPosition(state.step)).toBeGreaterThanOrEqual(0);
          if (state.step === "sealed") {
            expect(state.sealed).toBe(true);
          }
          if (before.sealed) {
            expect(realPosition(state.step)).toBeGreaterThanOrEqual(
              realPosition(before.step),
            );
          }
        }
      }),
      { numRuns: 300 },
    );
  });
});

/** The expected result of one action under the Real_Mode action table. */
interface Expected {
  /** True where the table says "the same object": the reducer must return the input. */
  same: boolean;
  step: StepperStep;
  sealed: boolean;
  draft: WriteDraft;
  stage: Stage;
}

/** A reference model of the Real_Mode action table (spec 19, Components section 1). */
function modelReal(state: StepperState, action: StepperAction): Expected {
  const keep: Expected = {
    same: true,
    step: state.step,
    sealed: state.sealed,
    draft: state.draft,
    stage: state.stage,
  };
  const moved = (patch: Partial<Expected>): Expected => ({
    ...keep,
    same: false,
    ...patch,
  });

  switch (action.type) {
    case "NEXT":
      if (state.step === "write") return moved({ step: "seal" });
      if (state.step === "seal" && state.sealed) {
        return moved({ step: "sealed" });
      }
      return keep;
    case "BACK":
      if (state.step === "seal" && !state.sealed) {
        return moved({ step: "write" });
      }
      return keep;
    case "DRAFT":
      if (state.sealed) return keep;
      return moved({ draft: reduceWriteDraft(state.draft, action.event) });
    case "SEALED":
      return moved({ sealed: true, draft: CLEARED_WRITE_DRAFT });
    case "GOTO": {
      const target = action.step;
      if (realPosition(target) < 0) return keep;
      if (realPosition(target) <= realPosition(state.step)) return keep;
      if (target === "sealed" && !state.sealed) return keep;
      return moved({ step: target });
    }
    case "STAGE":
      if (state.stage === action.stage) return keep;
      return moved({ stage: action.stage });
  }
}

describe("Property 3: the real reducer follows the real action table", () => {
  it("returns what the reference model of the table returns for any next action", () => {
    fc.assert(
      fc.property(startArb, sequenceArb, actionArb, (start, prefix, action) => {
        let state: StepperState = initialStepperState(start, "real");
        for (const previous of prefix) {
          state = reduceStepper(state, previous);
        }

        const expected = modelReal(state, action);
        const next = reduceStepper(state, action);

        expect(next.mode).toBe("real");
        expect(next.step).toBe(expected.step);
        expect(next.sealed).toBe(expected.sealed);
        expect(next.draft).toEqual(expected.draft);
        expect(next.stage).toBe(expected.stage);
        if (expected.same) {
          expect(next).toBe(state);
        } else {
          expect(next).not.toBe(state);
        }
      }),
      { numRuns: 300 },
    );
  });
});
