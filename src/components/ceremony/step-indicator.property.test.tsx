// Feature: 09-demo-polish, Property 10 (the Step_Indicator follows the Stage)
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { CEREMONY_COPY } from "./copy";
import { personaStepFor } from "./steps";
import type { Stage } from "./stages";
import { StepIndicator } from "../ui/StepIndicator";

// The Stages the persona page passes through, in order (C2.1: intact to close).
const PATH: readonly Stage[] = [
  "intact",
  "recall",
  "marks",
  "seal",
  "letter",
  "figures",
  "close",
];

const PRE_RECALL: readonly Stage[] = ["emerging", "sealed", "envelope", "intact"];

/** The index of the aria-current item in the rendered indicator, or -1. */
function currentIndex(step: number | null): number {
  const html = renderToStaticMarkup(
    createElement(StepIndicator, {
      steps: CEREMONY_COPY.steps,
      current: step,
      label: CEREMONY_COPY.stepsLabel,
    }),
  );
  const items = [...html.matchAll(/<li([^>]*)>/g)];
  return items.findIndex((m) => m[1].includes('aria-current="step"'));
}

describe("Property 10: the Step_Indicator follows the Stage", () => {
  it("shows the C2.2 step for every Stage on the path, and never goes back", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: PATH.length - 1 }), {
          minLength: 1,
          maxLength: 12,
        }),
        (indices) => {
          // A persona-page run only moves forward along the path.
          const sorted = [...indices].sort((a, b) => a - b);
          let last = -1;
          for (const index of sorted) {
            const stage = PATH[index];
            const step = personaStepFor(stage);
            // The indicator shows the step that personaStepFor gives.
            expect(currentIndex(step)).toBe(step ?? -1);
            // The step never decreases along the run.
            if (step !== null) {
              expect(step).toBeGreaterThanOrEqual(last);
              last = step;
            }
          }
        },
      ),
    );
  });

  it("has no current step before recall, and a current step from recall on", () => {
    for (const stage of PRE_RECALL) {
      expect(personaStepFor(stage), stage).toBeNull();
      expect(currentIndex(personaStepFor(stage))).toBe(-1);
    }
    for (const stage of PATH.slice(1)) {
      expect(personaStepFor(stage), stage).not.toBeNull();
    }
  });
});
