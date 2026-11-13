// Property 2: reported Stages never move the step back (issue #385).
//
// The reveal's Ceremony reports its Stage to the stepper through a STAGE
// action. For any sequence of stepper actions, mixed with reports of any Stage:
// - a STAGE action never lowers the step index;
// - after a STAGE action the step is the later of the step before it and the
//   step the Stage maps to (stepForStage), in one update;
// - the stored Stage is the last one reported;
// - Back is never offered once the seal is stored.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import type { Stage } from "@/components/ceremony/stages";

import {
  canGoBack,
  initialStepperState,
  reduceStepper,
  stepForStage,
  stepIndex,
  LIVE_STEPS,
  type StepperAction,
} from "./live-steps";

const ALL_STAGES: readonly Stage[] = [
  "emerging",
  "sealed",
  "envelope",
  "recall",
  "marks",
  "seal",
  "letter",
  "figures",
  "close",
  "error",
];

const stageArb: fc.Arbitrary<Stage> = fc.constantFrom(...ALL_STAGES);

const actionArb: fc.Arbitrary<StepperAction> = fc.oneof(
  fc.constant({ type: "NEXT" } satisfies StepperAction),
  fc.constant({ type: "BACK" } satisfies StepperAction),
  fc.constant({ type: "SEALED" } satisfies StepperAction),
  fc.constantFrom(...LIVE_STEPS).map(
    (step): StepperAction => ({ type: "GOTO", step }),
  ),
  stageArb.map((stage): StepperAction => ({ type: "STAGE", stage })),
);

describe("Property 2: reported Stages never move the step back", () => {
  it("never lowers the step index on a STAGE action", () => {
    fc.assert(
      fc.property(fc.array(actionArb, { maxLength: 40 }), (actions) => {
        let state = initialStepperState();
        for (const action of actions) {
          const before = stepIndex(state.step);
          state = reduceStepper(state, action);
          if (action.type === "STAGE") {
            expect(stepIndex(state.step)).toBeGreaterThanOrEqual(before);
          }
        }
      }),
      { numRuns: 300 },
    );
  });

  it("lands on the later of the current step and the Stage's step", () => {
    fc.assert(
      fc.property(fc.array(actionArb, { maxLength: 40 }), stageArb, (actions, stage) => {
        let state = initialStepperState();
        for (const action of actions) state = reduceStepper(state, action);

        const before = state.step;
        const target = stepForStage(stage);
        const after = reduceStepper(state, { type: "STAGE", stage });

        const expected =
          target !== null && stepIndex(target) > stepIndex(before)
            ? target
            : before;
        expect(after.step).toBe(expected);
        expect(after.stage).toBe(stage);
      }),
      { numRuns: 300 },
    );
  });

  it("stores the last reported Stage", () => {
    fc.assert(
      fc.property(fc.array(stageArb, { minLength: 1, maxLength: 20 }), (stages) => {
        let state = initialStepperState();
        for (const stage of stages) {
          state = reduceStepper(state, { type: "STAGE", stage });
        }
        expect(state.stage).toBe(stages[stages.length - 1]);
      }),
      { numRuns: 300 },
    );
  });

  it("never offers Back once the seal is stored, after any Stage report", () => {
    fc.assert(
      fc.property(fc.array(actionArb, { maxLength: 40 }), (actions) => {
        let state = reduceStepper(initialStepperState("seal"), { type: "SEALED" });
        for (const action of actions) {
          state = reduceStepper(state, action);
          expect(canGoBack(state.step, state.sealed)).toBe(false);
        }
      }),
      { numRuns: 300 },
    );
  });
});
