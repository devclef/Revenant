// Property 11: Back keeps the draft, and nothing goes back after the seal
// (spec 09, D2.2 and D2.3).
//
// Random sequences of stepper actions run through the reducer. An oracle
// folds the same draft events itself, so the expected draft does not come from
// the reducer under test. Before the seal, the draft equals the oracle after
// every action, Back included. After the seal, the draft is empty, Back never
// moves the visitor back, and no draft event changes anything.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { INITIAL_WRITE_DRAFT, reduceWriteDraft, type WriteDraft } from "../write-draft";

import {
  canGoBack,
  initialStepperState,
  reduceStepper,
  stepIndex,
  type StepperAction,
} from "./live-steps";

const actionArb: fc.Arbitrary<StepperAction> = fc.oneof(
  fc.constant({ type: "NEXT" } satisfies StepperAction),
  fc.constant({ type: "BACK" } satisfies StepperAction),
  fc.string({ maxLength: 12 }).map(
    (text): StepperAction => ({
      type: "DRAFT",
      event: { type: "TEXT_CHANGED", text },
    }),
  ),
  fc.constantFrom("us-gasoline-regular", "us-groceries").map(
    (metricId): StepperAction => ({
      type: "DRAFT",
      event: { type: "FIGURE_TOGGLED", metricId },
    }),
  ),
  fc.boolean().map(
    (ticked): StepperAction => ({
      type: "DRAFT",
      event: { type: "WARNING_CHANGED", ticked },
    }),
  ),
  fc.constant({ type: "SEALED" } satisfies StepperAction),
);

describe("Property 11: Back keeps the draft; nothing goes back after the seal", () => {
  it("the draft matches the oracle before the seal, and is empty with no way back after it", () => {
    fc.assert(
      fc.property(fc.array(actionArb, { maxLength: 40 }), (actions) => {
        let state = initialStepperState();
        let oracle: WriteDraft = INITIAL_WRITE_DRAFT;
        let sealed = false;

        for (const action of actions) {
          const before = state;
          if (action.type === "SEALED") sealed = true;
          if (action.type === "DRAFT" && !sealed) {
            oracle = reduceWriteDraft(oracle, action.event);
          }

          state = reduceStepper(state, action);

          if (sealed) {
            // The draft is dropped at the seal and never refilled.
            expect(state.draft).toEqual(INITIAL_WRITE_DRAFT);
            // Nothing moves the visitor back once the seal is stored.
            expect(canGoBack(state.step, state.sealed)).toBe(false);
            expect(stepIndex(state.step)).toBeGreaterThanOrEqual(
              stepIndex(before.step),
            );
          } else {
            // Before the seal, the draft is exactly what the events built, and
            // Back never changes it.
            expect(state.draft).toEqual(oracle);
            if (action.type === "BACK") {
              expect(state.draft).toEqual(before.draft);
            }
          }
        }
      }),
      { numRuns: 500 },
    );
  });
});
