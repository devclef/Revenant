// Feature: 07-judge-journey, Property 4
//
// Property 4: the figures sequence takes the same time for 1 to 6 figures.
// For any figure count from 1 to 6, the FiguresFadeUp plan's total equals the
// total for one figure under the same motion setting: 780 ms in full motion
// and 0 in Calm. Each entry's delay depends only on its index, and the stagger
// is at most 100 ms (R14.7, R14.8, R18.5).
//
// Validates: Requirements 14.7, 14.8, 18.5, 26.3.4

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { FIG_CLOCK_MS, FIG_FADE_MS, FIG_STAGGER_MS, MAX_FIGURES } from "../constants";
import { planFiguresFadeUp } from "./FiguresFadeUp";
import type { MotionMode } from "../motion";

const motion = fc.constantFrom<MotionMode>("full", "light", "calm");
const count = fc.integer({ min: 1, max: MAX_FIGURES });

describe("Property 4: the figures sequence takes the same time for 1 to 6 figures", () => {
  it("the total is 780 ms in full motion and 0 in Calm, whatever the count", () => {
    fc.assert(
      fc.property(count, motion, (n, mode) => {
        const plan = planFiguresFadeUp(n, mode);
        const reference = planFiguresFadeUp(1, mode);
        expect(plan.totalMs).toBe(reference.totalMs);
        expect(plan.clockMs).toBe(reference.clockMs);
        expect(plan.totalMs).toBe(mode === "calm" ? 0 : FIG_CLOCK_MS);
      }),
      { numRuns: 100 },
    );
  });

  it("each entry's delay depends only on its index, and the stagger is at most 100 ms", () => {
    expect(FIG_STAGGER_MS).toBeLessThanOrEqual(100);
    fc.assert(
      fc.property(count, (n) => {
        const plan = planFiguresFadeUp(n, "full");
        const longer = planFiguresFadeUp(MAX_FIGURES, "full");
        expect(plan.entries).toHaveLength(n);
        for (const entry of plan.entries) {
          expect(entry.durationMs).toBe(FIG_FADE_MS);
          // The same index has the same delay in any count.
          expect(entry.delayMs).toBe(longer.entries[entry.index]?.delayMs);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("the last fade ends exactly at the clock with six figures (780 ms)", () => {
    const plan = planFiguresFadeUp(MAX_FIGURES, "full");
    const last = plan.entries[MAX_FIGURES - 1];
    expect(last === undefined ? NaN : last.delayMs + last.durationMs).toBe(FIG_CLOCK_MS);
  });

  it("plans no animation in Calm", () => {
    fc.assert(
      fc.property(count, (n) => {
        expect(planFiguresFadeUp(n, "calm").entries).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });
});
