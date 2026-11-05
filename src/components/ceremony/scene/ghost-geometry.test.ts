// Feature: 07-judge-journey
// The Ghost's drawing constants. The values must match the drawing the
// Ghost has always shown (design.md "The Ghost").

import { describe, expect, it } from "vitest";

import {
  BODY_PATH,
  EYE_CENTRES,
  EYE_CENTRE_SVG,
  EYE_RADII,
  FOLDS_PATH,
  VIEWBOX,
  VIEWBOX_HEIGHT,
  VIEWBOX_WIDTH,
} from "./ghost-geometry";

describe("ghost geometry", () => {
  it("exports the 200 x 240 viewBox", () => {
    expect(VIEWBOX_WIDTH).toBe(200);
    expect(VIEWBOX_HEIGHT).toBe(240);
    expect(VIEWBOX).toBe("0 0 200 240");
  });

  it("exports the body path with its zigzag hem", () => {
    expect(BODY_PATH).toBe(
      "M34 104 A66 66 0 0 1 166 104 " +
        "C170 150 176 190 176 228 " +
        "L163 212 L150 230 L137 212 L124 230 L111 212 L100 230 " +
        "L89 212 L76 230 L63 212 L50 230 L37 212 L24 228 " +
        "C24 190 30 150 34 104 Z",
    );
  });

  it("exports the two folds", () => {
    expect(FOLDS_PATH).toBe("M58 150 L56 222 M142 150 L144 222");
  });

  it("exports the eye centres, radii and their midpoint", () => {
    expect(EYE_CENTRES).toEqual([
      { cx: 78, cy: 92 },
      { cx: 122, cy: 92 },
    ]);
    expect(EYE_RADII).toEqual({ rx: 11, ry: 16 });
    expect(EYE_CENTRE_SVG).toEqual({ x: 100, y: 92 });
  });
});
