/**
 * Property 4 of spec 19: step lookups read only the mode's step list
 * (requirements 1.1, 1.4, 2.3, 2.5).
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  canGoBack,
  stepIndex,
  stepName,
  stepNamesFor,
  stepsFor,
  type StepperMode,
  type StepperStep,
} from "./live-steps";

/** Every StepperStep value: the six demo steps, the three real steps, deduplicated. */
const ALL_STEPS: StepperStep[] = [
  "write",
  "seal",
  "wait",
  "testify",
  "break",
  "receipts",
  "sealed",
];
const MODES: StepperMode[] = ["demo", "real"];

const modeArb = fc.constantFrom(...MODES);
const stepArb = fc.constantFrom(...ALL_STEPS);

describe("Property 4: step lookups read only the mode's list", () => {
  it("gives each position in the mode's list its own index and name, with 3 steps in real and 6 in demo", () => {
    fc.assert(
      fc.property(modeArb, (mode) => {
        const steps = stepsFor(mode);
        const names = stepNamesFor(mode);

        expect(steps.length).toBe(mode === "real" ? 3 : 6);
        expect(names.length).toBe(steps.length);
        steps.forEach((step, position) => {
          expect(stepIndex(step, mode)).toBe(position);
          expect(stepName(step, mode)).toBe(names[position]);
        });
      }),
      { numRuns: 100 },
    );
  });

  it("offers Back in real mode only on seal while not sealed", () => {
    fc.assert(
      fc.property(stepArb, (step) => {
        expect(canGoBack(step, false, "real")).toBe(step === "seal");
      }),
      { numRuns: 100 },
    );
  });

  it("returns -1 and an empty name for a step outside the mode's list", () => {
    fc.assert(
      fc.property(modeArb, stepArb, (mode, step) => {
        fc.pre(!stepsFor(mode).includes(step));
        expect(stepIndex(step, mode)).toBe(-1);
        expect(stepName(step, mode)).toBe("");
      }),
      { numRuns: 100 },
    );
  });
});
