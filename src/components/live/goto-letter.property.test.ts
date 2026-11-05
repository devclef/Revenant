import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { goToLetterReady, remainingSeconds } from "./clock";

/**
 * Property 19 (spec 06 task 10, R16.3 to R16.5): "Go to your letter" opens
 * exactly when the countdown ends. The control is enabled for a corrected
 * clock reading at or after opensAt, and never before.
 */

const BASE_MS = 1_000_000_000_000;

describe("Property 19: Go to your letter opens exactly when the countdown ends", () => {
  it("is ready iff the corrected clock has reached opensAt", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -(10 ** 10), max: 10 ** 10 }),
        fc.integer({ min: -(10 ** 10), max: 10 ** 10 }),
        fc.integer({ min: -(10 ** 9), max: 10 ** 9 }),
        (opensDelta, nowDelta, offset) => {
          const opensAt = BASE_MS + opensDelta;
          const now = BASE_MS + nowDelta;
          const ready = goToLetterReady(opensAt, now, offset);
          expect(ready).toBe(now + offset >= opensAt);
          expect(ready).toBe(remainingSeconds(opensAt, now, offset) === 0);
        },
      ),
    );
  });

  it("is never ready while the corrected clock is still before opensAt", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 ** 9 }),
        fc.integer({ min: -(10 ** 6), max: 10 ** 6 }),
        (left, offset) => {
          const opensAt = BASE_MS + left;
          if (BASE_MS + offset < opensAt) {
            expect(goToLetterReady(opensAt, BASE_MS, offset)).toBe(false);
          }
        },
      ),
    );
  });

  it("opens at the exact boundary and stays closed one millisecond before it", () => {
    expect(goToLetterReady(BASE_MS, BASE_MS, 0)).toBe(true);
    expect(goToLetterReady(BASE_MS, BASE_MS - 1, 0)).toBe(false);
    expect(goToLetterReady(BASE_MS, BASE_MS - 1, 1)).toBe(true);
  });

  it("returns false for any non-finite input", () => {
    const bad = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
    for (const value of bad) {
      expect(goToLetterReady(value, BASE_MS, 0)).toBe(false);
      expect(goToLetterReady(BASE_MS, value, 0)).toBe(false);
      expect(goToLetterReady(BASE_MS, BASE_MS, value)).toBe(false);
    }
  });
});
