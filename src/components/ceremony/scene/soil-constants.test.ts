// Feature: 07-judge-journey
//
// The Soil_Canvas block in ceremony/constants.ts (design.md "Constants",
// "Soil_Canvas"). Pins the values the spec names so a change shows up here.

import { describe, expect, it } from "vitest";

import {
  CLOD_SEED,
  DUST_MAX_FPS,
  DUST_MAX_PARTICLES,
  DUST_SEED,
  EDGE_BAND_PX,
  LIGHT_MAX_LUMINANCE_CHANGE_PER_S,
  SOIL_DPR_MAX,
  SOIL_RESIZE_DEBOUNCE_MS,
  SOIL_SEED,
} from "../constants";

describe("Soil_Canvas constants", () => {
  it("pins the dust and frame limits", () => {
    expect(DUST_MAX_PARTICLES).toBe(36);
    expect(DUST_MAX_FPS).toBe(30);
  });

  it("pins the edge band and light change limit", () => {
    expect(EDGE_BAND_PX).toBe(14);
    expect(LIGHT_MAX_LUMINANCE_CHANGE_PER_S).toBe(0.1);
  });

  it("pins the seed and the two derived seeds (SOIL_SEED ^ 0xd057, ^ 0xc10d)", () => {
    expect(SOIL_SEED).toBe(0x07a11e);
    expect(DUST_SEED).toBe(SOIL_SEED ^ 0xd057);
    expect(CLOD_SEED).toBe(SOIL_SEED ^ 0xc10d);
  });

  it("pins the resize debounce and DPR cap", () => {
    expect(SOIL_RESIZE_DEBOUNCE_MS).toBe(150);
    expect(SOIL_DPR_MAX).toBe(2);
  });
});
