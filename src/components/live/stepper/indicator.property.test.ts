// Property 1: The indicator has exactly one current item, and Break the seal
// holds until the seal is broken (spec 12, X4.1, X4.2, X4.3 and X4.8).
//
// For any sequence of stepper actions followed by a reported Stage:
// - the Step_Indicator has six items, in the order Write, Press the seal, Wait,
//   Testify, Break the seal, See the receipts;
// - exactly one item carries aria-current="step", and it is the item at the
//   state's step;
// - the items before it are done and the items after it are todo;
// - when the Stage is marks or seal and the step has not passed the seal break,
//   the current item is Break the seal and See the receipts is todo.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import type { Stage } from "@/components/ceremony/stages";

import { StepIndicator } from "./StepIndicator";
import {
  LIVE_STEPS,
  LIVE_STEP_NAMES,
  initialStepperState,
  reduceStepper,
  stepIndex,
  type LiveStep,
  type StepperAction,
  type StepperState,
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
const sealStageArb: fc.Arbitrary<Stage> = fc.constantFrom("marks", "seal");

const actionArb: fc.Arbitrary<StepperAction> = fc.oneof(
  fc.constant({ type: "NEXT" } satisfies StepperAction),
  fc.constant({ type: "BACK" } satisfies StepperAction),
  fc.constant({ type: "SEALED" } satisfies StepperAction),
  fc
    .constantFrom(...LIVE_STEPS)
    .map((step): StepperAction => ({ type: "GOTO", step })),
  stageArb.map((stage): StepperAction => ({ type: "STAGE", stage })),
);

interface IndicatorItem {
  name: string;
  state: string;
  current: boolean;
}

/** The `<li>` items of the Step_Indicator, in document order. */
function indicatorItems(step: LiveStep): IndicatorItem[] {
  const html = renderToStaticMarkup(
    createElement(StepIndicator, { current: step }),
  );
  return html
    .split("<li ")
    .slice(1)
    .map((chunk) => ({
      name: chunk.match(/class="[^"]*name[^"]*">([^<]*)</)?.[1] ?? "",
      state: chunk.match(/data-state="([^"]*)"/)?.[1] ?? "",
      current: chunk.includes('aria-current="step"'),
    }));
}

function expectOneCurrentAt(state: StepperState): IndicatorItem[] {
  const items = indicatorItems(state.step);
  expect(items).toHaveLength(6);
  expect(items.map((item) => item.name)).toEqual([...LIVE_STEP_NAMES]);
  expect(items.filter((item) => item.current)).toHaveLength(1);

  const index = stepIndex(state.step);
  items.forEach((item, i) => {
    expect(item.current).toBe(i === index);
    if (i < index) expect(item.state).toBe("done");
    else if (i === index) expect(item.state).toBe("current");
    else expect(item.state).toBe("todo");
  });
  return items;
}

describe("Property 1: the indicator has one current item, and Break the seal holds until the seal is broken", () => {
  it("shows six items with exactly one current item, at the state's step, after any Stage", () => {
    fc.assert(
      fc.property(
        fc.array(actionArb, { maxLength: 30 }),
        stageArb,
        (actions, stage) => {
          let state = initialStepperState();
          for (const action of actions) state = reduceStepper(state, action);
          const before = state;
          const after = reduceStepper(before, { type: "STAGE", stage });

          const items = expectOneCurrentAt(after);

          // While the seal is not yet broken, Break the seal is current and
          // See the receipts is todo (X4.2). The stepper never moves back, so
          // this holds only when the step had not passed the seal break.
          if (
            (stage === "marks" || stage === "seal") &&
            stepIndex(before.step) <= stepIndex("break")
          ) {
            expect(after.step).toBe("break");
            expect(items[stepIndex("break")]?.name).toBe("Break the seal");
            expect(items[stepIndex("break")]?.current).toBe(true);
            expect(items[stepIndex("receipts")]?.state).toBe("todo");
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("keeps Break the seal current across repeated seal reports, and moves to See the receipts when the seal breaks (X4.2, X4.3)", () => {
    fc.assert(
      fc.property(
        fc.array(sealStageArb, { minLength: 1, maxLength: 20 }),
        (seals) => {
          let state = initialStepperState();
          for (const stage of seals) {
            state = reduceStepper(state, { type: "STAGE", stage });
            const items = expectOneCurrentAt(state);
            expect(items[stepIndex("break")]?.current).toBe(true);
            expect(items[stepIndex("receipts")]?.state).toBe("todo");
          }

          state = reduceStepper(state, { type: "STAGE", stage: "letter" });
          const items = expectOneCurrentAt(state);
          expect(items[stepIndex("receipts")]?.current).toBe(true);
          expect(items[stepIndex("break")]?.state).toBe("done");
        },
      ),
      { numRuns: 300 },
    );
  });
});
