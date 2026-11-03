// Feature: 07-judge-journey (spec 07 task 4)
//
// The narrow pick-up lift (design.md "Narrow layout during `recall` and
// `marks`") and its timings (R10.7, R10.8, R10.15).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { GHOST_HANDED, GHOST_LIFT_MS, NARROW_GHOST_SCALE, PICKUP_MOVE_MS } from "../constants";
import { narrowPickUpLift, NO_PICKUP_LIFT } from "./layout";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "scene.module.css"), "utf8");

describe("narrowPickUpLift (design.md \"Narrow layout during recall and marks\")", () => {
  it("returns no lift when a box cannot be read", () => {
    expect(narrowPickUpLift(null)).toEqual(NO_PICKUP_LIFT);
    expect(
      narrowPickUpLift({ ghostTop: Number.NaN, pitBottom: 500, topBarBottom: 80, soilBottom: 440 }),
    ).toEqual({ y: 0, columnStart: 0 });
    expect(
      narrowPickUpLift({ ghostTop: 100, pitBottom: Number.POSITIVE_INFINITY, topBarBottom: 80, soilBottom: 440 }),
    ).toEqual({ y: 0, columnStart: 0 });
  });

  it("follows the design formulas on a measured example", () => {
    // ghostTopScaled = 500 - (500 - 100) * 0.8 = 180
    // y = 80 + 4 - 180 = -96
    // columnStart = 440 + (-96) - 80 + 4 = 268
    expect(NARROW_GHOST_SCALE).toBe(0.8);
    const lift = narrowPickUpLift({ ghostTop: 100, pitBottom: 500, topBarBottom: 80, soilBottom: 440 });
    expect(lift.y).toBeCloseTo(-96, 6);
    expect(lift.columnStart).toBeCloseTo(268, 6);
  });

  it("lifts the scene up (negative y) when the Ghost sits under the Top_Bar", () => {
    const lift = narrowPickUpLift({ ghostTop: 60, pitBottom: 400, topBarBottom: 80, soilBottom: 300 });
    expect(lift.y).toBeLessThan(0);
  });
});

describe("pick-up timings (R10.7, R10.8, R10.15)", () => {
  it("uses GHOST_LIFT_MS 400 for the handed lift and PICKUP_MOVE_MS 600 for the scene move", () => {
    expect(GHOST_LIFT_MS).toBe(400);
    expect(PICKUP_MOVE_MS).toBe(600);
    expect(css).toMatch(/\[data-ceremony-motion="full"\] \.ghost \{\s*transition: transform 400ms/);
    expect(css).toMatch(/\[data-ceremony-motion="full"\] \.backdrop \{\s*transition: transform 600ms/);
    expect(css).toMatch(/\[data-ceremony-motion="full"\] \.pit \{\s*transition: transform 600ms/);
  });

  it("lifts the Ghost to GHOST_HANDED, -12 %, in both layouts", () => {
    expect(GHOST_HANDED).toBe(-0.12);
    expect(css).toMatch(/\.ghost\[data-pose="handed"\] \{\s*transform: translateY\(-12%\);/);
  });

  it("scales the narrow pit to 0.8 about its bottom, transform only", () => {
    expect(css).toMatch(
      /@media \(max-width: 899\.98px\) \{[\s\S]*?\.pit\[data-pose="handed"\] \{\s*transform: translateX\(-50%\) scale\(0\.8\);\s*transform-origin: 50% 100%;/,
    );
  });
});
