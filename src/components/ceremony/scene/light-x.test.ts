// Feature: 07-judge-journey
//
// The light x rule (design.md "Light x", R5.16, R6.17). At or above 900 px it
// is frameL + 0.72 × frameW with frameW = min(w, 1440). Below 900 px it is w / 2.

import { describe, expect, it } from "vitest";

import { GHOST_X_IN_FRAME } from "../constants";
import { lightX } from "./layout";

describe("lightX (the Soil_Canvas light rule)", () => {
  it("is w / 2 at 320 px", () => {
    expect(lightX(320)).toBe(160);
  });

  it("is w / 2 at 899 px, just below the breakpoint", () => {
    expect(lightX(899)).toBe(899 / 2);
  });

  it("switches to the frame rule at 900 px", () => {
    // frameW = 900, frameL = 0
    expect(lightX(900)).toBeCloseTo(0.72 * 900, 9);
    expect(lightX(900)).toBeCloseTo(GHOST_X_IN_FRAME * 900, 9);
  });

  it("uses the 1440 px frame at 2560 px", () => {
    // frameW = 1440, frameL = (2560 - 1440) / 2 = 560
    expect(lightX(2560)).toBeCloseTo(560 + 0.72 * 1440, 9);
  });
});
