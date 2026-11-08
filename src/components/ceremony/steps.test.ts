// Feature: 09-demo-polish, C2.2 (Step_Indicator)
import { describe, expect, it } from "vitest";

import { CEREMONY_COPY } from "./copy";
import { COMPACT_GHOST_MAX_PX, PERSONA_STEPS } from "./constants";
import { personaStepFor } from "./steps";
import type { Stage } from "./stages";

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

describe("personaStepFor (C2.2)", () => {
  it("maps each Stage to its Step_Indicator step", () => {
    expect(personaStepFor("recall")).toBe(0);
    expect(personaStepFor("marks")).toBe(1);
    expect(personaStepFor("seal")).toBe(1);
    expect(personaStepFor("letter")).toBe(2);
    expect(personaStepFor("figures")).toBe(3);
    expect(personaStepFor("close")).toBe(3);
  });

  it("has no current step in emerging, sealed, envelope or any Stage before them", () => {
    for (const stage of ["emerging", "sealed", "envelope"] as const) {
      expect(personaStepFor(stage), stage).toBeNull();
    }
  });

  it("gives the same step count as the labels in CEREMONY_COPY", () => {
    expect(CEREMONY_COPY.steps).toHaveLength(PERSONA_STEPS);
    expect(PERSONA_STEPS).toBe(4);
  });

  it("never returns a step outside 0 to 3 for any Stage", () => {
    for (const stage of ALL_STAGES) {
      const step = personaStepFor(stage);
      if (step !== null) {
        expect([0, 1, 2, 3]).toContain(step);
      }
    }
  });

  it("never steps backwards along the persona path", () => {
    const path: Stage[] = ["recall", "marks", "seal", "letter", "figures", "close"];
    let last = -1;
    for (const stage of path) {
      const step = personaStepFor(stage);
      if (step === null) continue;
      expect(step).toBeGreaterThanOrEqual(last);
      last = step;
    }
  });

  it("keeps the Compact_Ghost cap at 120 px (P4.2)", () => {
    expect(COMPACT_GHOST_MAX_PX).toBe(120);
  });
});
