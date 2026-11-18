// Feature: 14-write-desk, Property 5 (design.md "Correctness Properties").
//
// The Write step's letter field height stays between its floor (296 px) and
// the phone cap for the visual viewport. Inside those bounds it is the content
// height, so the field grows with the text and never jumps.
//
// Validates: Requirements W5.3.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  DESK_LETTER_MIN_PX,
  deskLetterHeightPx,
  letterFieldMaxPx,
} from "../phone";

const contentArb = fc.double({
  min: 0,
  max: 20000,
  noNaN: true,
  noDefaultInfinity: true,
});
const viewportArb = fc.double({
  min: 1,
  max: 10000,
  noNaN: true,
  noDefaultInfinity: true,
});

describe("deskLetterHeightPx (Property 5, spec 14 W5.3)", () => {
  it("is at least the floor and at most max(floor, phone cap), and equals the content between them", () => {
    fc.assert(
      fc.property(contentArb, viewportArb, (content, viewport) => {
        const cap = Math.max(DESK_LETTER_MIN_PX, letterFieldMaxPx(viewport));
        const height = deskLetterHeightPx(content, viewport);

        expect(height).toBeGreaterThanOrEqual(DESK_LETTER_MIN_PX);
        expect(height).toBeLessThanOrEqual(cap);
        if (content >= DESK_LETTER_MIN_PX && content <= cap) {
          expect(height).toBe(content);
        }
      }),
      { numRuns: 1000 },
    );
  });

  it("holds the 296 px floor for empty or short content", () => {
    expect(deskLetterHeightPx(0, 800)).toBe(296);
    expect(deskLetterHeightPx(120, 800)).toBe(296);
    expect(deskLetterHeightPx(-40, 800)).toBe(296);
  });

  it("caps tall content at half the visual viewport on a phone", () => {
    // 800 px viewport: letterFieldMaxPx(800) is 400 at the 50 vh default.
    expect(letterFieldMaxPx(800)).toBe(400);
    expect(deskLetterHeightPx(900, 800)).toBe(400);
    expect(deskLetterHeightPx(350, 800)).toBe(350);
  });

  it("never drops below the floor when the viewport is too small for the cap", () => {
    // A 300 px viewport gives a 150 px cap, which is lower than the floor.
    expect(letterFieldMaxPx(300)).toBe(150);
    expect(deskLetterHeightPx(900, 300)).toBe(296);
  });
});
