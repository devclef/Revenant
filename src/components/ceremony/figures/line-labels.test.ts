// Feature: 08-judge-polish, task 2
//
// Property 1: Number_Line labels never overlap and stay on the line
// (design.md "Number_Line labels", R5.4 to R5.6). Also unit cases for the
// fixed row order and the clamp at each end.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { LINE_LABEL_GAP_PX, LINE_LABEL_MAX_PX, LINE_MIN_PX } from "../constants";
import { placeLineLabels, type LineLabelInput } from "./line-labels";

const position = fc.double({ min: 0, max: 1, noNaN: true });
const width = fc.double({ min: 0, max: LINE_LABEL_MAX_PX, noNaN: true });
const lineWidth = fc.double({ min: LINE_MIN_PX, max: 2000, noNaN: true });

const inputArb: fc.Arbitrary<LineLabelInput> = fc.record({
  positions: fc.tuple(position, position, position),
  widths: fc.tuple(width, width, width),
  lineWidth,
});

const EPS = 1e-9;

describe("placeLineLabels (Property 1, R5.4 to R5.6)", () => {
  it("never puts two labels in one row closer than the gap, and keeps each on the line", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const boxes = placeLineLabels(input);
        for (let i = 0; i < boxes.length; i += 1) {
          const a = boxes[i];
          // Every box lies inside [0, lineWidth].
          expect(a.x).toBeGreaterThanOrEqual(-EPS);
          expect(a.x + a.width).toBeLessThanOrEqual(input.lineWidth + EPS);
          for (let j = i + 1; j < boxes.length; j += 1) {
            const b = boxes[j];
            if (a.row !== b.row) continue;
            const gap = a.x < b.x ? b.x - (a.x + a.width) : a.x - (b.x + b.width);
            expect(gap).toBeGreaterThanOrEqual(LINE_LABEL_GAP_PX - EPS);
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it("always uses one of the three reserved rows", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        for (const box of placeLineLabels(input)) {
          expect([0, 1, 2]).toContain(box.row);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("assigns the rows in the fixed order when the three positions are equal", () => {
    fc.assert(
      fc.property(
        position,
        fc.tuple(width, width, width),
        lineWidth,
        (p, widths, line) => {
          const [then, now, answer] = placeLineLabels({
            positions: [p, p, p],
            widths,
            lineWidth: line,
          });
          expect([then.row, now.row, answer.row]).toEqual([0, 1, 2]);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe("placeLineLabels, unit cases", () => {
  it("centres a label on its point when there is room", () => {
    const [then] = placeLineLabels({
      positions: [0.5, 0.9, 0.1],
      widths: [40, 40, 40],
      lineWidth: 400,
    });
    expect(then.x).toBe(180);
    expect(then.row).toBe(0);
  });

  it("clamps a label at the left end", () => {
    const [then] = placeLineLabels({
      positions: [0, 0.9, 0.5],
      widths: [40, 40, 40],
      lineWidth: 400,
    });
    expect(then.x).toBe(0);
  });

  it("clamps a label at the right end", () => {
    const [, now] = placeLineLabels({
      positions: [0.1, 1, 0.5],
      widths: [40, 40, 40],
      lineWidth: 400,
    });
    expect(now.x).toBe(360);
  });

  it("moves a label to the next row when it would overlap one in row 0", () => {
    const [then, now] = placeLineLabels({
      positions: [0.5, 0.5, 0.9],
      widths: [60, 60, 60],
      lineWidth: 400,
    });
    expect(then.row).toBe(0);
    expect(now.row).toBe(1);
  });

  it("keeps a label in row 0 when the next one is far enough away", () => {
    const [then, now] = placeLineLabels({
      positions: [0.1, 0.9, 0.5],
      widths: [40, 40, 40],
      lineWidth: 400,
    });
    expect(then.row).toBe(0);
    expect(now.row).toBe(0);
  });
});
