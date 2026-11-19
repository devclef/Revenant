// Feature: 07-judge-journey
//
// The light x rule (design.md "Light x", R5.16, R6.17). At or above 900 px it
// is frameL + 0.72 × frameW with frameW = min(w, 1440). Below 900 px it is w / 2.

import { describe, expect, it } from "vitest";

import { GHOST_X_NARROW } from "../constants";
import { lightX } from "./layout";

describe("lightX (the Soil_Canvas light rule)", () => {
  it("is w / 2 at 320 px", () => {
    expect(lightX(320)).toBe(160);
  });

  it("is w / 2 at 899 px, just below the breakpoint", () => {
    expect(lightX(899)).toBe(899 / 2);
  });

  it("is also w / 2 at 900 px, because the light stays in the centred column (spec 15 R5.5)", () => {
    expect(lightX(900)).toBe(450);
    expect(lightX(900)).toBeCloseTo(GHOST_X_NARROW * 900, 9);
  });

  it("is the window centre at 2560 px, not the 1440 px frame's 72 % point", () => {
    expect(lightX(2560)).toBe(1280);
  });
});
