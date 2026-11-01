// Feature: 05-reveal-ceremony
//
// The DOM-free unit test for the pure pointer mapping behind the desk's light
// hook (useLight.ts). `lightFromPointer` is the only part of the hook that
// does arithmetic; everything else is effect wiring. Testing the pure function
// keeps this test node-only (no DOM, no rAF, no listeners) and pins the two
// guarantees the hook relies on:
//
//   - the candle position `x` / `y` stays within [0, 1] for any pointer,
//     inside or outside the element, and a zero-area element maps to the
//     centre (0.5);
//   - the parallax offset and tilt never exceed PARALLAX_MAX_PX /
//     PARALLAX_MAX_DEG, and the element centre maps to neutral (all zero).
//
// Validates R13.6 / R8.6 (the clamped pointer-light and parallax plane).

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { PARALLAX_MAX_DEG, PARALLAX_MAX_PX } from "../constants";
import { lightFromPointer, type LightRect } from "./useLight";

// A plain 200x100 box offset from the viewport origin, so a non-trivial
// left/top is exercised rather than a box pinned at (0, 0).
const RECT: LightRect = { left: 40, top: 20, width: 200, height: 100 };

const centreX = RECT.left + RECT.width / 2; // 140
const centreY = RECT.top + RECT.height / 2; // 70

describe("lightFromPointer", () => {
  it("maps the element centre to neutral", () => {
    const v = lightFromPointer(RECT, centreX, centreY);
    expect(v.x).toBe(0.5);
    expect(v.y).toBe(0.5);
    // Use Math.abs so signed zero (−0) reads as neutral too.
    expect(Math.abs(v.px)).toBe(0);
    expect(Math.abs(v.py)).toBe(0);
    expect(Math.abs(v.degX)).toBe(0);
    expect(Math.abs(v.degY)).toBe(0);
  });

  it("maps the top-left corner to (0, 0) at the near-edge extremes", () => {
    const v = lightFromPointer(RECT, RECT.left, RECT.top);
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
    // Top-left is the −1/−1 corner: offset pulls to −MAX on both axes.
    expect(v.px).toBe(-PARALLAX_MAX_PX);
    expect(v.py).toBe(-PARALLAX_MAX_PX);
    // Tilt is opposite the offset on each axis (degX from Y, degY from X).
    expect(v.degX).toBe(PARALLAX_MAX_DEG);
    expect(v.degY).toBe(-PARALLAX_MAX_DEG);
  });

  it("maps the bottom-right corner to (1, 1) at the far-edge extremes", () => {
    const v = lightFromPointer(
      RECT,
      RECT.left + RECT.width,
      RECT.top + RECT.height,
    );
    expect(v.x).toBe(1);
    expect(v.y).toBe(1);
    expect(v.px).toBe(PARALLAX_MAX_PX);
    expect(v.py).toBe(PARALLAX_MAX_PX);
    expect(v.degX).toBe(-PARALLAX_MAX_DEG);
    expect(v.degY).toBe(PARALLAX_MAX_DEG);
  });

  it("covers all four corners within the clamp bounds", () => {
    const corners: ReadonlyArray<readonly [number, number]> = [
      [RECT.left, RECT.top],
      [RECT.left + RECT.width, RECT.top],
      [RECT.left, RECT.top + RECT.height],
      [RECT.left + RECT.width, RECT.top + RECT.height],
    ];
    for (const [cx, cy] of corners) {
      const v = lightFromPointer(RECT, cx, cy);
      expect(v.x).toBeGreaterThanOrEqual(0);
      expect(v.x).toBeLessThanOrEqual(1);
      expect(v.y).toBeGreaterThanOrEqual(0);
      expect(v.y).toBeLessThanOrEqual(1);
      expect(Math.abs(v.px)).toBe(PARALLAX_MAX_PX);
      expect(Math.abs(v.py)).toBe(PARALLAX_MAX_PX);
      expect(Math.abs(v.degX)).toBe(PARALLAX_MAX_DEG);
      expect(Math.abs(v.degY)).toBe(PARALLAX_MAX_DEG);
    }
  });

  it("maps a zero-area element to the centre with no parallax", () => {
    const flat: LightRect = { left: 10, top: 10, width: 0, height: 0 };
    const v = lightFromPointer(flat, 999, -999);
    expect(v.x).toBe(0.5);
    expect(v.y).toBe(0.5);
    expect(Math.abs(v.px)).toBe(0);
    expect(Math.abs(v.py)).toBe(0);
    expect(Math.abs(v.degX)).toBe(0);
    expect(Math.abs(v.degY)).toBe(0);
  });

  it("clamps a pointer far outside the element to the bounds", () => {
    // Well beyond every edge in both directions.
    const below = lightFromPointer(RECT, -10_000, -10_000);
    expect(below.x).toBe(0);
    expect(below.y).toBe(0);
    expect(below.px).toBe(-PARALLAX_MAX_PX);
    expect(below.py).toBe(-PARALLAX_MAX_PX);

    const above = lightFromPointer(RECT, 10_000, 10_000);
    expect(above.x).toBe(1);
    expect(above.y).toBe(1);
    expect(above.px).toBe(PARALLAX_MAX_PX);
    expect(above.py).toBe(PARALLAX_MAX_PX);
  });

  it("never exceeds the clamp constants for any pointer (property)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.double({ min: 0, max: 1e6, noNaN: true }),
        fc.double({ min: 0, max: 1e6, noNaN: true }),
        (clientX, clientY, left, top, width, height) => {
          const rect: LightRect = { left, top, width, height };
          const v = lightFromPointer(rect, clientX, clientY);

          expect(v.x).toBeGreaterThanOrEqual(0);
          expect(v.x).toBeLessThanOrEqual(1);
          expect(v.y).toBeGreaterThanOrEqual(0);
          expect(v.y).toBeLessThanOrEqual(1);

          expect(Math.abs(v.px)).toBeLessThanOrEqual(PARALLAX_MAX_PX);
          expect(Math.abs(v.py)).toBeLessThanOrEqual(PARALLAX_MAX_PX);
          expect(Math.abs(v.degX)).toBeLessThanOrEqual(PARALLAX_MAX_DEG);
          expect(Math.abs(v.degY)).toBeLessThanOrEqual(PARALLAX_MAX_DEG);
        },
      ),
    );
  });
});
