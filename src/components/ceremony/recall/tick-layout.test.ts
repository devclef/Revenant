import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { FALLBACK_RANGE, UNIT_RANGE_TABLE, type ScaleRange } from "./unit-ranges";
import {
  TICK_CHAR_PX,
  TICK_GAP_PX,
  TRACK_MIN_PX,
  visibleTicks,
  type VisibleTick,
} from "./tick-layout";

// Feature: 08-judge-polish, Task 1 (tick labels, R6.5).
// Property 14: Tick labels never overlap.
// Validates: Requirements 6.5
// Feature: 09-demo-polish, A10 (even ticks).
// Property 6: Ticks are evenly spaced and never collide.
// Validates: A10.1, A10.2

const NUM_RUNS = 100;

/** The character estimate: 7.5 px a character at 0.75rem. */
const estimate = (tick: number): number => String(tick).length * TICK_CHAR_PX;

/** The box a drawn tick occupies, from its anchor. */
function boxOf(tick: VisibleTick, trackPx: number, width: number) {
  const x = tick.position * trackPx;
  if (tick.anchor === "start") return { left: x, right: x + width };
  if (tick.anchor === "end") return { left: x - width, right: x };
  return { left: x - width / 2, right: x + width / 2 };
}

describe("visibleTicks — examples", () => {
  it("keeps every USD tick on a track of the server render width", () => {
    const ticks = visibleTicks(UNIT_RANGE_TABLE["USD per gallon"], TRACK_MIN_PX, estimate);
    expect(ticks.map((t) => t.value)).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it("anchors the first tick at its start, the last at its end, the rest centred", () => {
    const ticks = visibleTicks(UNIT_RANGE_TABLE["USD per gallon"], TRACK_MIN_PX, estimate);
    expect(ticks[0].anchor).toBe("start");
    expect(ticks[ticks.length - 1].anchor).toBe("end");
    for (const tick of ticks.slice(1, -1)) expect(tick.anchor).toBe("centre");
  });

  it("drops inner ticks on a narrow track and keeps the first and last", () => {
    const ticks = visibleTicks(UNIT_RANGE_TABLE["EUR per 1,000 litres"], 90, () => 30);
    const values = ticks.map((t) => t.value);
    expect(values[0]).toBe(0);
    expect(values[values.length - 1]).toBe(3000);
    expect(values.length).toBeLessThan(7);
  });

  it("returns only the first and last tick of a fallback track when narrow", () => {
    const ticks = visibleTicks(FALLBACK_RANGE, 120, () => 40);
    expect(ticks.map((t) => t.value)).toEqual([0.01, 100000]);
  });

  it("returns a single tick anchored at its start for a one-tick range", () => {
    const one: ScaleRange = { min: 0, max: 5, scale: "linear", ticks: [0] };
    const ticks = visibleTicks(one, 200, estimate);
    expect(ticks).toHaveLength(1);
    expect(ticks[0].anchor).toBe("start");
  });

  it("draws every second EUR tick at the 260 px track: 0, 1,000, 2,000, 3,000 (A10.3)", () => {
    const ticks = visibleTicks(UNIT_RANGE_TABLE["EUR per 1,000 litres"], TRACK_MIN_PX, estimate);
    expect(ticks.map((t) => t.value)).toEqual([0, 1000, 2000, 3000]);
    expect(ticks[0].anchor).toBe("start");
    expect(ticks[ticks.length - 1].anchor).toBe("end");
  });

  it("keeps all seven EUR ticks when they fit at the wide track", () => {
    const ticks = visibleTicks(UNIT_RANGE_TABLE["EUR per 1,000 litres"], 960, estimate);
    expect(ticks.map((t) => t.value)).toEqual([0, 500, 1000, 1500, 2000, 2500, 3000]);
  });
});

describe("Property 14: tick labels never overlap", () => {
  const RANGES: readonly ScaleRange[] = [
    UNIT_RANGE_TABLE["USD per gallon"],
    UNIT_RANGE_TABLE["EUR per 1,000 litres"],
    FALLBACK_RANGE,
  ];

  it("kept boxes keep the gap, stay inside the track and include the ends", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...RANGES),
        fc.integer({ min: TRACK_MIN_PX, max: 1200 }),
        fc.double({ min: 0.5, max: 1, noNaN: true }),
        (range, trackPx, factor) => {
          const labelPx = (tick: number) => estimate(tick) * factor;
          const ticks = visibleTicks(range, trackPx, labelPx);

          expect(ticks[0].value).toBe(range.ticks[0]);
          expect(ticks[ticks.length - 1].value).toBe(range.ticks[range.ticks.length - 1]);

          const boxes = ticks.map((t) => boxOf(t, trackPx, labelPx(t.value)));
          for (const box of boxes) {
            expect(box.left).toBeGreaterThanOrEqual(0);
            expect(box.right).toBeLessThanOrEqual(trackPx);
          }
          for (let i = 1; i < boxes.length; i += 1) {
            expect(boxes[i].left - boxes[i - 1].right).toBeGreaterThanOrEqual(
              TICK_GAP_PX,
            );
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("Property 6: drawn ticks are every k-th tick with k dividing n - 1, and never collide", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...RANGES),
        fc.integer({ min: TRACK_MIN_PX, max: 1200 }),
        fc.double({ min: 0.5, max: 1, noNaN: true }),
        (range, trackPx, factor) => {
          const labelPx = (tick: number) => estimate(tick) * factor;
          const ticks = visibleTicks(range, trackPx, labelPx);
          const n = range.ticks.length;

          expect(ticks[0].value).toBe(range.ticks[0]);
          expect(ticks[ticks.length - 1].value).toBe(range.ticks[n - 1]);

          if (ticks.length > 2) {
            const indices = ticks.map((t) => range.ticks.indexOf(t.value));
            const k = indices[1] - indices[0];
            expect((n - 1) % k).toBe(0);
            for (let i = 1; i < indices.length; i += 1) {
              expect(indices[i] - indices[i - 1]).toBe(k);
            }
          }

          const boxes = ticks.map((t) => boxOf(t, trackPx, labelPx(t.value)));
          for (let i = 1; i < boxes.length; i += 1) {
            expect(boxes[i].left - boxes[i - 1].right).toBeGreaterThanOrEqual(TICK_GAP_PX);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
