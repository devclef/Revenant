// Feature: 07-judge-journey (spec 07 task 4)
//
// The narrow pick-up lift (design.md "Narrow layout during `recall` and
// `marks`") and its timings (R10.7, R10.8, R10.15).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { GHOST_HANDED, GHOST_LIFT_MS, NARROW_GHOST_SCALE, PICKUP_MOVE_MS } from "../constants";
import {
  narrowColumnPadding,
  narrowPickUpLift,
  NO_PICKUP_LIFT,
} from "./layout";

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

describe("recall clearance under the handed Ghost (G1, R5.19, R10.15)", () => {
  // Values read from the running app at 360 x 640 in the recall stage (the
  // handed pose), before and after the lift. Pre-lift Ghost box top and the pit
  // bottom are the reads SceneBackdrop makes. The post-lift Ghost box bottom
  // (257.5) is what getBoundingClientRect returned on the lifted, scaled box.
  const measured = {
    ghostTop: 212.6,
    pitBottom: 441.6,
    topBarBottom: 78,
    soilBottom: 492.8,
  };
  const MEASURED_LIFT_Y = -176.406;
  const GHOST_BOX_BOTTOM_LIFTED = 257.5;
  // The persona column's top, measured as the top of the content column.
  const COLUMN_TOP = 45;

  it("reproduces the measured lift at 360 x 640", () => {
    const lift = narrowPickUpLift(measured);
    expect(lift.y).toBeCloseTo(MEASURED_LIFT_Y, 1);
    // columnStart = 492.8 - 176.4 - 78 + 4 = 242.4, so the headline starts at 320.4.
    expect(lift.columnStart).toBeCloseTo(242.4, 1);
  });

  it("starts the headline below the measured lifted Ghost_Box at 360 x 640", () => {
    const lift = narrowPickUpLift(measured);
    const headlineTop = measured.topBarBottom + lift.columnStart;
    expect(headlineTop).toBeGreaterThan(GHOST_BOX_BOTTOM_LIFTED);
  });

  it("pads the column so the headline top lands under the lifted Soil strip", () => {
    const lift = narrowPickUpLift(measured);
    const padding = narrowColumnPadding(measured, lift, COLUMN_TOP);
    expect(padding).not.toBeNull();
    // Column top + padding is the headline top.
    expect(COLUMN_TOP + (padding ?? 0)).toBeCloseTo(measured.topBarBottom + lift.columnStart, 6);
  });

  it("gives no padding on the 0-lift fallback, so the CSS padding stays", () => {
    expect(narrowColumnPadding(null, NO_PICKUP_LIFT, COLUMN_TOP)).toBeNull();
    expect(narrowColumnPadding(measured, NO_PICKUP_LIFT, COLUMN_TOP)).toBeNull();
    expect(narrowColumnPadding(measured, narrowPickUpLift(measured), Number.NaN)).toBeNull();
  });
});

