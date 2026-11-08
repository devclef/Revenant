// Feature: 10 (spec 10 X1.1, X1.2, X1.3, X1.4). Property 20: every tick
// touches the axis, reaches its own label, and never crosses a label above it.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  LINE_LABEL_GAP_PX,
  LINE_LABEL_TOP_REM,
  TICK_LABEL_GAP_PX,
} from "../constants";
import { placeLineLabels, TICK_HALF_PX, type LabelBox } from "./line-labels";
import {
  LABEL_FONT_REM,
  STATIC_REM_PX,
  labelRowTopPx,
  tickLeaderPx,
} from "./tick-leader";

const rowArb = fc.constantFrom(0, 1, 2);
const remArb = fc.integer({ min: 8, max: 32 });

// Three points close together on one line, as the Then, Now and answer values
// often are. Each gap between neighbouring points is 0.02 to 0.05 of the line,
// which is at least 8 px on a 400 px line. Points at one spot are not generated:
// ticks at one point can't all stay clear of each other's labels (see the
// unit cases in line-labels.test.ts).
const nearLine = fc.record({
  base: fc.double({ min: 0.05, max: 0.85, noNaN: true }),
  gaps: fc.tuple(
    fc.double({ min: 0.02, max: 0.05, noNaN: true }),
    fc.double({ min: 0.02, max: 0.05, noNaN: true }),
  ),
  order: fc.constantFrom<readonly [number, number, number]>(
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ),
  widths: fc.tuple(
    fc.integer({ min: 30, max: 60 }),
    fc.integer({ min: 30, max: 60 }),
    fc.integer({ min: 40, max: 120 }),
  ),
  lineWidth: fc.integer({ min: 400, max: 900 }),
});

const TOL = 1e-6;

function placeNear(input: {
  base: number;
  gaps: readonly [number, number];
  order: readonly [number, number, number];
  widths: readonly [number, number, number];
  lineWidth: number;
}): { boxes: readonly [LabelBox, LabelBox, LabelBox]; ticks: number[] } {
  const along = [
    input.base,
    input.base + input.gaps[0],
    input.base + input.gaps[0] + input.gaps[1],
  ];
  // The order decides which label (Then, Now, answer) gets which point.
  const positions = [
    along[input.order[0]],
    along[input.order[1]],
    along[input.order[2]],
  ] as const;
  const ticks = positions.map((p) => p * input.lineWidth);
  const boxes = placeLineLabels({
    positions,
    widths: input.widths,
    lineWidth: input.lineWidth,
  });
  return { boxes, ticks };
}

describe("Property 20: every tick touches the axis and reaches its label", () => {
  it("puts each tick inside its own label, keeps row neighbours apart, and never lets a tick cross a label above it", () => {
    fc.assert(
      fc.property(nearLine, (input) => {
        const { boxes, ticks } = placeNear(input);

        // 1. Each tick's x lies inside its own label's box.
        for (let i = 0; i < 3; i += 1) {
          const box = boxes[i];
          expect(ticks[i]).toBeGreaterThanOrEqual(box.x - TOL);
          expect(ticks[i]).toBeLessThanOrEqual(box.x + box.width + TOL);
        }

        // 2. No two labels in one row overlap; LINE_LABEL_GAP_PX stays between them.
        for (let i = 0; i < 3; i += 1) {
          for (let j = i + 1; j < 3; j += 1) {
            const a = boxes[i];
            const b = boxes[j];
            if (a.row !== b.row) continue;
            const gap = a.x < b.x ? b.x - (a.x + a.width) : a.x - (b.x + b.width);
            expect(gap).toBeGreaterThanOrEqual(LINE_LABEL_GAP_PX - TOL);
          }
        }

        // 3. No label box contains the x of a tick from a row below it. A tick is
        // 2 px wide, so it spans [x - 1, x + 1] and must not reach into the box.
        for (let i = 0; i < 3; i += 1) {
          for (let j = 0; j < 3; j += 1) {
            if (boxes[j].row <= boxes[i].row) continue;
            const box = boxes[i];
            const crosses =
              box.x < ticks[j] + TICK_HALF_PX - TOL &&
              box.x + box.width > ticks[j] - TICK_HALF_PX + TOL;
            expect(crosses).toBe(false);
          }
        }
      }),
      { numRuns: 300 },
    );
  });

  it("ends each tick TICK_LABEL_GAP_PX above the row its own label was placed in", () => {
    fc.assert(
      fc.property(nearLine, (input) => {
        const { boxes } = placeNear(input);
        const emPx = STATIC_REM_PX * LABEL_FONT_REM;
        for (const box of boxes) {
          const bottom = tickLeaderPx(box.row, STATIC_REM_PX, emPx);
          expect(
            labelRowTopPx(box.row, STATIC_REM_PX, emPx) - bottom,
          ).toBeCloseTo(TICK_LABEL_GAP_PX, 9);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("starts every tick on the axis top edge (y = 0) and ends it above its label", () => {
    fc.assert(
      fc.property(rowArb, remArb, (row, remPx) => {
        const emPx = remPx * LABEL_FONT_REM;
        const top = 0;
        const bottom = top + tickLeaderPx(row, remPx, emPx);
        expect(labelRowTopPx(row, remPx, emPx) - bottom).toBeCloseTo(
          TICK_LABEL_GAP_PX,
          9,
        );
      }),
    );
  });

  it("gives every tick a positive height at every row and font size", () => {
    fc.assert(
      fc.property(rowArb, remArb, (row, remPx) => {
        expect(tickLeaderPx(row, remPx, remPx * LABEL_FONT_REM)).toBeGreaterThan(0);
      }),
    );
  });

  it("makes each lower row's tick longer than the row above it", () => {
    fc.assert(
      fc.property(remArb, (remPx) => {
        const emPx = remPx * LABEL_FONT_REM;
        const heights = [0, 1, 2].map((row) => tickLeaderPx(row, remPx, emPx));
        expect(heights[1]).toBeGreaterThan(heights[0]);
        expect(heights[2]).toBeGreaterThan(heights[1]);
      }),
    );
  });
});

describe("tick heights at the static render (X1.2, 16 px root)", () => {
  const emPx = STATIC_REM_PX * LABEL_FONT_REM;

  it("reads the first row top from LINE_LABEL_TOP_REM at 16 px", () => {
    expect(labelRowTopPx(0, STATIC_REM_PX, emPx)).toBeCloseTo(
      LINE_LABEL_TOP_REM * STATIC_REM_PX,
      9,
    );
  });

  it("ends each static tick 4 px above its label row", () => {
    expect(tickLeaderPx(0, STATIC_REM_PX, emPx)).toBeCloseTo(16, 9);
    expect(tickLeaderPx(1, STATIC_REM_PX, emPx)).toBeCloseTo(49.28, 9);
    expect(tickLeaderPx(2, STATIC_REM_PX, emPx)).toBeCloseTo(82.56, 9);
  });
});
