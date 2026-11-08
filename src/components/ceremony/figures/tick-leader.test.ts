// Feature: 10 (spec 10 X1.1, X1.2, X1.3, X1.4). Property 20: every tick
// touches the axis, reaches its own label where it can, and never runs through
// a label in a row above its own.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  LINE_LABEL_GAP_PX,
  LINE_LABEL_TOP_REM,
  TICK_LABEL_GAP_PX,
} from "../constants";
import {
  TICK_HALF_PX,
  placeLineLabels,
  tickCrosses,
  type LabelBox,
} from "./line-labels";
import {
  LABEL_FONT_REM,
  STATIC_REM_PX,
  labelRowTopPx,
  tickBottomsPx,
  tickLeaderPx,
} from "./tick-leader";

const rowArb = fc.constantFrom(0, 1, 2);
const remArb = fc.integer({ min: 8, max: 32 });

// Three points close together on one line, as the Then, Now and answer values
// often are. A gap of 0 puts two points on one spot, which the placer must still
// handle. Points are kept inside the line by the base range.
const nearLine = fc.record({
  base: fc.double({ min: 0.05, max: 0.85, noNaN: true }),
  gaps: fc.tuple(
    fc.double({ min: 0, max: 0.05, noNaN: true }),
    fc.double({ min: 0, max: 0.05, noNaN: true }),
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
const emPx = STATIC_REM_PX * LABEL_FONT_REM;

function placeNear(input: {
  base: number;
  gaps: readonly [number, number];
  order: readonly [number, number, number];
  widths: readonly [number, number, number];
  lineWidth: number;
}): {
  boxes: readonly [LabelBox, LabelBox, LabelBox];
  ticks: number[];
  bottoms: number[];
} {
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
  const bottoms = tickBottomsPx(boxes, ticks, STATIC_REM_PX, emPx);
  return { boxes, ticks, bottoms };
}

describe("Property 20: every tick touches the axis and reaches its label", () => {
  it("puts each tick inside its own label, keeps row neighbours apart, and never lets a tick run through a label above it", () => {
    fc.assert(
      fc.property(nearLine, (input) => {
        const { boxes, ticks, bottoms } = placeNear(input);

        // 1. Each tick's x lies inside its own label's box. A 2 px tick centred
        // up to TICK_HALF_PX outside the box edge still touches it (tickCrosses).
        for (let i = 0; i < 3; i += 1) {
          const box = boxes[i];
          expect(ticks[i]).toBeGreaterThanOrEqual(box.x - TICK_HALF_PX - TOL);
          expect(ticks[i]).toBeLessThanOrEqual(box.x + box.width + TICK_HALF_PX + TOL);
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

        // 3. No label box contains another tick's x within that tick's vertical
        // span. The tick spans 0 to bottoms[i]; the box starts at its row's top.
        for (let i = 0; i < 3; i += 1) {
          for (let k = 0; k < 3; k += 1) {
            if (i === k) continue;
            const box = boxes[k];
            const rowTop = labelRowTopPx(box.row, STATIC_REM_PX, emPx);
            const inSpan = bottoms[i] > rowTop + TOL;
            expect(inSpan && tickCrosses(ticks[i], box.x, box.width)).toBe(false);
          }
        }
      }),
      { numRuns: 300 },
    );
  });

  it("ends each tick no lower than TICK_LABEL_GAP_PX above its own label row", () => {
    fc.assert(
      fc.property(nearLine, (input) => {
        const { boxes, bottoms } = placeNear(input);
        boxes.forEach((box, i) => {
          const ownEnd = labelRowTopPx(box.row, STATIC_REM_PX, emPx) - TICK_LABEL_GAP_PX;
          expect(bottoms[i]).toBeLessThanOrEqual(ownEnd + TOL);
        });
      }),
      { numRuns: 300 },
    );
  });

  it("starts every tick on the axis top edge (y = 0) and ends it above its label", () => {
    fc.assert(
      fc.property(rowArb, remArb, (row, remPx) => {
        const e = remPx * LABEL_FONT_REM;
        const top = 0;
        const bottom = top + tickLeaderPx(row, remPx, e);
        expect(labelRowTopPx(row, remPx, e) - bottom).toBeCloseTo(
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
        const e = remPx * LABEL_FONT_REM;
        const heights = [0, 1, 2].map((row) => tickLeaderPx(row, remPx, e));
        expect(heights[1]).toBeGreaterThan(heights[0]);
        expect(heights[2]).toBeGreaterThan(heights[1]);
      }),
    );
  });
});

describe("Property 20, unit cases", () => {
  it("clips a tick that would run through a label above it, at the top of that label", () => {
    // Then and Now at one spot: the Now label drops to row 1, and its tick would
    // run through the Then label in row 0. It stops above row 0 instead.
    const input = {
      positions: [0.5, 0.5, 0.9] as const,
      widths: [60, 60, 60] as const,
      lineWidth: 400,
    };
    const boxes = placeLineLabels(input);
    expect(boxes[1].row).toBe(1);
    const ticks = input.positions.map((p) => p * input.lineWidth);
    const bottoms = tickBottomsPx(boxes, ticks, STATIC_REM_PX, emPx);
    // Row 0 top is 1.25 rem = 20 px, so the clipped tick ends 16 px down.
    expect(bottoms[1]).toBeCloseTo(16, 9);
    // The unclipped Then and answer ticks keep their own row's height.
    expect(bottoms[0]).toBeCloseTo(16, 9);
    expect(bottoms[2]).toBeCloseTo(16, 9);
  });

  it("keeps a tick's own height when no label above it is crossed", () => {
    const input = {
      positions: [0.1, 0.9, 0.5] as const,
      widths: [40, 40, 40] as const,
      lineWidth: 400,
    };
    const boxes = placeLineLabels(input);
    const ticks = input.positions.map((p) => p * input.lineWidth);
    const bottoms = tickBottomsPx(boxes, ticks, STATIC_REM_PX, emPx);
    boxes.forEach((box, i) => {
      expect(bottoms[i]).toBeCloseTo(tickLeaderPx(box.row, STATIC_REM_PX, emPx), 9);
    });
  });
});

describe("tick heights at the static render (X1.2, 16 px root)", () => {
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
