// Property 10: The Live_Stepper has five steps and one current step (spec 11,
// L1.6 and design "Correctness Properties").
//
// For any sequence of stepper actions, before and after the seal:
// - the Step_Indicator shows exactly five items, in the order Write, Press the
//   seal, Wait, Testify, See the receipts, with exactly one current item at the
//   index of the state's step;
// - Back is offered only from the seal step, and only before the seal is stored;
// - before the seal, the typed text survives every Next and Back.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { LIVE_COPY } from "../copy";

import { StepIndicator } from "./StepIndicator";
import {
  LIVE_STEPS,
  LIVE_STEP_NAMES,
  canGoBack,
  initialStepperState,
  reduceStepper,
  stepIndex,
  type LiveStep,
  type StepperAction,
} from "./live-steps";

const stepArb: fc.Arbitrary<LiveStep> = fc.constantFrom(...LIVE_STEPS);

const actionArb: fc.Arbitrary<StepperAction> = fc.oneof(
  fc.constant({ type: "NEXT" } satisfies StepperAction),
  fc.constant({ type: "BACK" } satisfies StepperAction),
  fc.constant({ type: "SEALED" } satisfies StepperAction),
  stepArb.map((step): StepperAction => ({ type: "GOTO", step })),
  fc.string({ maxLength: 12 }).map((text): StepperAction => ({
    type: "DRAFT",
    event: { type: "TEXT_CHANGED", text },
  })),
);

/** The `<li>` items of the Step_Indicator, in document order. */
function indicatorItems(html: string): string[] {
  return html.split("<li ").slice(1);
}

describe("Property 10: the Live_Stepper has five steps and one current step", () => {
  it("lists the five steps in the spec order, with Wait from LIVE_COPY", () => {
    expect([...LIVE_STEPS]).toEqual([
      "write",
      "seal",
      "wait",
      "testify",
      "receipts",
    ]);
    expect(LIVE_STEP_NAMES[2]).toBe(LIVE_COPY.waitStep);
    expect(LIVE_STEP_NAMES).toHaveLength(5);
  });

  it("shows five items with exactly one current item, at the state's step", () => {
    fc.assert(
      fc.property(fc.array(actionArb, { maxLength: 30 }), (actions) => {
        let state = initialStepperState();
        for (const action of actions) state = reduceStepper(state, action);

        const html = renderToStaticMarkup(
          createElement(StepIndicator, { current: state.step }),
        );
        const items = indicatorItems(html);
        expect(items).toHaveLength(5);

        const currentItems = items.filter((item) =>
          item.includes('data-state="current"'),
        );
        expect(currentItems).toHaveLength(1);
        expect(items[stepIndex(state.step)]).toContain('data-state="current"');
        expect(items[stepIndex(state.step)]).toContain('aria-current="step"');
      }),
      { numRuns: 300 },
    );
  });

  it("offers Back only from the seal step, and only before the seal is stored", () => {
    fc.assert(
      fc.property(fc.array(actionArb, { maxLength: 30 }), (actions) => {
        let state = initialStepperState();
        for (const action of actions) {
          state = reduceStepper(state, action);
          expect(canGoBack(state.step, state.sealed)).toBe(
            state.step === "seal" && !state.sealed,
          );
        }
      }),
      { numRuns: 300 },
    );
  });

  it("keeps the typed text across every Next and Back before the seal", () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 12 }),
        fc.array(fc.constantFrom("NEXT", "BACK"), { maxLength: 20 }),
        (text, moves) => {
          let state = initialStepperState();
          state = reduceStepper(state, {
            type: "DRAFT",
            event: { type: "TEXT_CHANGED", text },
          });
          for (const move of moves) {
            state = reduceStepper(state, { type: move } as StepperAction);
            expect(state.draft.text).toBe(text);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});
