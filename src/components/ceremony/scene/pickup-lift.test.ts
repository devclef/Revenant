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
  narrowPickUpLift,
  NO_PICKUP_LIFT,
  soilBottomPx,
  soilTopPx,
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
  /** Top_Bar bottom at a narrow size with the default control row (96 px max). */
  const TOP_BAR_BOTTOM = 78;

  /**
   * The lifted Ghost_Box bottom and the headline top, from the same geometry
   * the CSS and SceneBackdrop use. The Ghost_Box is min(31vh, 200px) wide and
   * 1.2 times as tall. The handed pose moves it up 12 % of its height, and the
   * pit scales it by NARROW_GHOST_SCALE about the pit bottom (the Soil top).
   */
  function clearance(width: number, height: number) {
    const pitBottom = soilTopPx(width, height);
    const ghostW = Math.min(height * 0.31, 200);
    const ghostH = ghostW * 1.2;
    // .ghostPlace bottom: -3vh below the pit, then the handed -12 % lift.
    const ghostBottomPlace = pitBottom + height * 0.03;
    const ghostTop = ghostBottomPlace - ghostH - ghostH * 0.12;
    const boxes = {
      ghostTop,
      pitBottom,
      topBarBottom: TOP_BAR_BOTTOM,
      soilBottom: soilBottomPx(width, height),
    };
    const lift = narrowPickUpLift(boxes);
    const scaled = (value: number) => pitBottom - (pitBottom - value) * NARROW_GHOST_SCALE;
    const ghostBoxBottom = scaled(ghostTop + ghostH) + lift.y;
    const headlineTop = TOP_BAR_BOTTOM + lift.columnStart;
    return { ghostBoxBottom, headlineTop, lift };
  }

  it("starts the headline below the lifted Ghost_Box at 360x640", () => {
    const { ghostBoxBottom, headlineTop, lift } = clearance(360, 640);
    // y = 78 + 4 - 243.6 = -161.6; columnStart = 492.8 - 161.6 - 78 + 4 = 257.2
    expect(lift.y).toBeCloseTo(-161.6, 0);
    expect(headlineTop).toBeCloseTo(335.2, 0);
    expect(ghostBoxBottom).toBeLessThan(headlineTop);
  });

  it("clears the lifted Ghost_Box at the other narrow sizes", () => {
    for (const [width, height] of [
      [320, 568],
      [375, 667],
      [390, 844],
      [414, 896],
    ] as const) {
      const { ghostBoxBottom, headlineTop } = clearance(width, height);
      expect(ghostBoxBottom, `${width}x${height}`).toBeLessThan(headlineTop);
    }
  });
});
