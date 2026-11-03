// Feature: 07-judge-journey, Property 13: The eyes never pass their maximum offset (fast-check)
// Feature: 07-judge-journey, R5.5 to R5.8

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { EYE_MAX_OFFSET } from "../constants";
import { eyeOffset, followsPointer } from "./eyes";

const coord = fc.double({ min: -5000, max: 5000, noNaN: true });
const point = fc.record({ x: coord, y: coord });

describe("Property 13: the eyes never pass their maximum offset", () => {
  it("keeps the offset length at most EYE_MAX_OFFSET for any pointer and centre", () => {
    fc.assert(
      fc.property(point, point, (pointer, centre) => {
        const { dx, dy } = eyeOffset(pointer, centre);
        expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(EYE_MAX_OFFSET + 1e-9);
      }),
      { numRuns: 100 },
    );
  });

  it("gives (0, 0) when the pointer is on the centre", () => {
    fc.assert(
      fc.property(point, (centre) => {
        expect(eyeOffset(centre, centre)).toEqual({ dx: 0, dy: 0 });
      }),
      { numRuns: 100 },
    );
  });
});

describe("eye follow rules", () => {
  it("moves the eyes towards the pointer, further for a pointer further away", () => {
    const near = eyeOffset({ x: 110, y: 100 }, { x: 100, y: 100 });
    const far = eyeOffset({ x: 300, y: 100 }, { x: 100, y: 100 });
    expect(near.dx).toBeGreaterThan(0);
    expect(near.dy).toBe(0);
    expect(far.dx).toBeGreaterThan(near.dx);
  });

  it("lets only mouse and pen move the eyes", () => {
    expect(followsPointer("mouse", false)).toBe(true);
    expect(followsPointer("pen", false)).toBe(true);
    expect(followsPointer("touch", false)).toBe(false);
    expect(followsPointer("", false)).toBe(false);
  });

  it("never follows in Calm, whatever the pointer type", () => {
    expect(followsPointer("mouse", true)).toBe(false);
    expect(followsPointer("pen", true)).toBe(false);
  });
});
