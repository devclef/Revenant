// Feature: 14-write-desk, Property 1: The Step_Track marks one current step
//
// For any step of /demo/live, the Step_Track has six items in order, exactly
// one of them is current, the items before it are done and the items after it
// are todo. The track also gives exactly one aria-current="step" in markup.
// Validates spec 14 S1.1, S1.3, S1.5 and Q2.5.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { LIVE_COPY } from "../copy";

import { StepTrack } from "./StepTrack";
import {
  LIVE_STEPS,
  LIVE_STEP_NAMES,
  stepIndex,
  stepTrackStates,
  type LiveStep,
} from "./live-steps";

const stepArb: fc.Arbitrary<LiveStep> = fc.constantFrom(...LIVE_STEPS);

describe("Property 1: the Step_Track marks one current step", () => {
  it("has exactly one current state, at the index of the step", () => {
    fc.assert(
      fc.property(stepArb, (step) => {
        const index = stepIndex(step);
        const states = stepTrackStates(index);

        expect(states).toHaveLength(LIVE_STEPS.length);
        expect(states.filter((state) => state === "current")).toHaveLength(1);
        expect(states[index]).toBe("current");
      }),
      { numRuns: 100 },
    );
  });

  it("marks the steps before the current one done and those after todo", () => {
    fc.assert(
      fc.property(stepArb, (step) => {
        const index = stepIndex(step);
        const states = stepTrackStates(index);

        states.forEach((state, position) => {
          if (position < index) expect(state).toBe("done");
          if (position > index) expect(state).toBe("todo");
        });
      }),
      { numRuns: 100 },
    );
  });

  it('renders six items in order, with one aria-current="step"', () => {
    fc.assert(
      fc.property(stepArb, (step) => {
        const html = renderToStaticMarkup(
          createElement(StepTrack, {
            steps: LIVE_STEP_NAMES,
            current: stepIndex(step),
            label: LIVE_COPY.stepsLabel,
            phoneTemplate: LIVE_COPY.stepTrackPhone,
          }),
        );
        const list = html.match(/<ol[\s\S]*?<\/ol>/)?.[0] ?? "";
        const items = list.match(/<li\b/g) ?? [];
        const currents = list.match(/aria-current="step"/g) ?? [];

        expect(items).toHaveLength(LIVE_STEPS.length);
        expect(currents).toHaveLength(1);

        // Each label appears in the list in the order of LIVE_STEP_NAMES.
        let cursor = 0;
        for (const name of LIVE_STEP_NAMES) {
          const found = list.indexOf(`>${name}<`, cursor);
          expect(found, name).toBeGreaterThanOrEqual(cursor);
          cursor = found + name.length;
        }
      }),
      { numRuns: 100 },
    );
  });
});
