// Feature: 10 L5, a reveal with no figures is a complete ending
import { describe, expect, it } from "vitest";

import { stageListFor } from "./stages";

describe("stageListFor (L5.1)", () => {
  it("keeps the figures Stage for a letter with figures", () => {
    expect(stageListFor(true)).toContain("figures");
    expect(stageListFor(true)).toEqual([
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
    ]);
  });

  it("leaves the figures Stage out for a letter with no figures", () => {
    const stages = stageListFor(false);
    expect(stages).not.toContain("figures");
    expect(stages).toEqual([
      "emerging",
      "sealed",
      "envelope",
      "recall",
      "marks",
      "seal",
      "letter",
      "close",
      "error",
    ]);
  });
});
