// Feature: 07-judge-journey
//
// Geometry of the Scene_Frame and the Soil (design.md "The Scene_Frame" table,
// "SceneBackdrop and the Soil" geometry table, R5.16, R6.1, R6.3, R6.14,
// R6.18, R8.14). The expected numbers are the measured values from design.md,
// so a change to the layout math shows up here first.

import { describe, expect, it } from "vitest";

import { EDGE_BAND_PX, GHOST_X_IN_FRAME, SCENE_BREAKPOINT_PX } from "../constants";
import {
  frameLeft,
  frameWidth,
  ghostCentreX,
  isWideLayout,
  soilBandPx,
  soilBottomPx,
  soilJagMaxPx,
  soilTopPx,
  SOIL_EDGE_BAND_PX,
  SOIL_JAG_CAP_PX,
  SOIL_JAG_MAX_SHARE,
  SOIL_JAG_MIN_SHARE,
} from "./layout";

describe("the one breakpoint (R14.1)", () => {
  it("is wide at 900 px and narrow just below it", () => {
    expect(SCENE_BREAKPOINT_PX).toBe(900);
    expect(isWideLayout(900)).toBe(true);
    expect(isWideLayout(899)).toBe(false);
    expect(isWideLayout(360)).toBe(false);
  });
});

describe("the Scene_Frame (R8.14)", () => {
  it("is the window up to 1440 px and 1440 px beyond", () => {
    expect(frameWidth(1280)).toBe(1280);
    expect(frameWidth(1440)).toBe(1440);
    expect(frameWidth(2560)).toBe(1440);
  });

  it("centres the frame, so the margins match on both sides", () => {
    expect(frameLeft(1280)).toBe(0);
    expect(frameLeft(1920)).toBe(240);
    expect(frameLeft(2560)).toBe(560);
  });
});

describe("the light and the Ghost's centre x (R5.16, R5.17, R6.17)", () => {
  it("sits at 72 % of the frame at or above 900 px", () => {
    expect(GHOST_X_IN_FRAME).toBe(0.72);
    // design.md measured values, within a pixel of the rounded numbers.
    expect(ghostCentreX(1280)).toBeCloseTo(922, 0);
    expect(ghostCentreX(1440)).toBeCloseTo(1037, 0);
    expect(ghostCentreX(1920)).toBeCloseTo(1277, 0);
    expect(ghostCentreX(2560)).toBeCloseTo(1597, 0);
  });

  it("sits at the middle of the window below 900 px", () => {
    expect(ghostCentreX(360)).toBe(180);
    expect(ghostCentreX(899)).toBe(449.5);
  });

  it("is the same number on any Stage, because it depends only on the window", () => {
    expect(ghostCentreX(1280)).toBe(ghostCentreX(1280));
  });
});

describe("the Soil geometry (R6.1, R6.14)", () => {
  it("sits 74vh from the top, 14vh tall, at or above 900 px (measured 592 and 112 px at 1280x800)", () => {
    expect(soilTopPx(1280, 800)).toBeCloseTo(592, 6);
    expect(soilBandPx(1280, 800)).toBeCloseTo(112, 6);
    expect(soilBottomPx(1280, 800)).toBeCloseTo(704, 6);
  });

  it("sits 69vh from the top, 8vh tall, below 900 px (measured 441.6 and 51.2 px at 360x640)", () => {
    expect(soilTopPx(360, 640)).toBeCloseTo(441.6, 6);
    expect(soilBandPx(360, 640)).toBeCloseTo(51.2, 6);
    expect(soilBottomPx(360, 640)).toBeCloseTo(492.8, 6);
  });

  it("keeps the top-edge jag inside the 14 px band at every height (R6.3)", () => {
    expect(SOIL_EDGE_BAND_PX).toBe(EDGE_BAND_PX);
    expect(EDGE_BAND_PX).toBe(14);
    expect(SOIL_JAG_MIN_SHARE).toBe(0.02);
    expect(SOIL_JAG_MAX_SHARE).toBe(0.11);
    // The design's 1280x800 case: 11 % of a 112 px strip is 12.3 px, over the 12 px cap.
    expect(soilJagMaxPx(112)).toBe(SOIL_JAG_CAP_PX);
    // A 1080 px tall window: 11 % of 151.2 px is 16.6 px, so the cap applies.
    expect(soilJagMaxPx(151.2)).toBe(SOIL_JAG_CAP_PX);
    expect(SOIL_JAG_CAP_PX).toBeLessThanOrEqual(EDGE_BAND_PX);
  });
});
