// Property 11: Back keeps the draft, and nothing goes back after the seal
// (spec 09, D2.2 and D2.3).
//
// SealPage owns the stepper state and dispatches DRAFT and SEALED through
// reduceStepper, so this test drives that same reducer. An oracle folds the
// same draft events with reduceWriteDraft on its own, so the expected draft
// does not come from the reducer under test. Before the seal, the draft equals
// the oracle after every action, Back included. After the seal, the draft is
// empty, Back never moves the visitor back, and no draft event changes anything.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  CLEARED_WRITE_DRAFT,
  INITIAL_WRITE_DRAFT,
  reduceWriteDraft,
  type WriteDraft,
} from "../write-draft";

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
            expect(state.draft).toEqual(CLEARED_WRITE_DRAFT);
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

describe("the page's draft path (SealPage dispatches DRAFT through reduceStepper)", () => {
  it("Back keeps the typed text and figures, and SEALED drops them", () => {
    let state = initialStepperState();
    state = reduceStepper(state, {
      type: "DRAFT",
      event: { type: "TEXT_CHANGED", text: "Kept on Back." },
    });
    state = reduceStepper(state, {
      type: "DRAFT",
      event: { type: "FIGURE_TOGGLED", metricId: "us-groceries" },
    });
    state = reduceStepper(state, { type: "NEXT" }); // write -> seal
    state = reduceStepper(state, { type: "BACK" }); // seal -> write
    expect(state.step).toBe("write");
    expect(state.draft.text).toBe("Kept on Back.");
    expect(state.draft.metricIds).toEqual(["us-groceries"]);

    state = reduceStepper(state, { type: "NEXT" });
    state = reduceStepper(state, { type: "SEALED" });
    expect(state.sealed).toBe(true);
    expect(state.draft).toEqual(CLEARED_WRITE_DRAFT);

    // A late draft event after the seal changes nothing.
    const after = reduceStepper(state, {
      type: "DRAFT",
      event: { type: "TEXT_CHANGED", text: "Too late." },
    });
    expect(after.draft).toEqual(CLEARED_WRITE_DRAFT);
  });
});
