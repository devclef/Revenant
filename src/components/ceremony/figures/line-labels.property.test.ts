// Feature: 08-judge-polish, task 2 (spec 10 R6)
//
// Property 15: Number_Line labels for three points, the third being "No answer",
// never overlap, stay on the line, and handle coincident points (R6.1, R6.2).
// placeLineLabels is pure, so the same input must always give the same boxes.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  LINE_LABEL_GAP_PX,
  LINE_LABEL_MAX_PX,
  LINE_MIN_PX,
} from "../constants";
import { placeLineLabels, type LineLabelInput } from "./line-labels";

const position = fc.double({ min: 0, max: 1, noNaN: true });
const width = fc.double({ min: 0, max: LINE_LABEL_MAX_PX, noNaN: true });
const lineWidth = fc.double({ min: LINE_MIN_PX, max: 2000, noNaN: true });

const EPS = 1e-9;

// Then and Now are figure points; the third label is "No answer".
const threeLabelArb: fc.Arbitrary<LineLabelInput> = fc.record({
  positions: fc.tuple(position, position, position),
  widths: fc.tuple(width, width, width),
  lineWidth,
});

// Coincident points: either all three share one spot, or two share a spot and
// the third is free (Then and Now on one spot, or Now and No answer).
const coincidentArb: fc.Arbitrary<LineLabelInput> = fc
  .record({
    spot: position,
    other: position,
    widths: fc.tuple(width, width, width),
    lineWidth,
    shape: fc.constantFrom<"all" | "then-now" | "now-answer">(
      "all",
      "then-now",
      "now-answer",
    ),
  })
  .map(({ spot, other, widths, lineWidth: line, shape }) => {
    const positions: [number, number, number] =
      shape === "all"
        ? [spot, spot, spot]
        : shape === "then-now"
          ? [spot, spot, other]
          : [other, spot, spot];
    return { positions, widths, lineWidth: line };
  });

function assertNoOverlapAndOnLine(input: LineLabelInput): void {
  const boxes = placeLineLabels(input);
  for (let i = 0; i < boxes.length; i += 1) {
    const a = boxes[i];
    expect(a.x).toBeGreaterThanOrEqual(-EPS);
    expect(a.x + a.width).toBeLessThanOrEqual(input.lineWidth + EPS);
    for (let j = i + 1; j < boxes.length; j += 1) {
      const b = boxes[j];
      if (a.row !== b.row) continue;
      const gap = a.x < b.x ? b.x - (a.x + a.width) : a.x - (b.x + b.width);
      expect(gap).toBeGreaterThanOrEqual(LINE_LABEL_GAP_PX - EPS);
    }
  }
}

describe("Property 15: three labels, the third being No answer (R6.1, R6.2)", () => {
  it("never overlaps two labels in one row and keeps each label on the line", () => {
    fc.assert(
      fc.property(threeLabelArb, (input) => {
        assertNoOverlapAndOnLine(input);
      }),
      { numRuns: 300 },
    );
  });

  it("is pure: the same input always gives the same boxes", () => {
    fc.assert(
      fc.property(threeLabelArb, (input) => {
        const first = placeLineLabels(input);
        const second = placeLineLabels({
          positions: [...input.positions],
          widths: [...input.widths],
          lineWidth: input.lineWidth,
        });
        expect(second).toEqual(first);
      }),
      { numRuns: 100 },
    );
  });

  it("keeps the No answer label (third) on a valid row", () => {
    fc.assert(
      fc.property(threeLabelArb, (input) => {
        const boxes = placeLineLabels(input);
        expect([0, 1, 2]).toContain(boxes[2].row);
      }),
      { numRuns: 200 },
    );
  });
});

describe("Property 15: coincident points (R6.1, R6.2)", () => {
  it("handles every point at one spot without overlap or leaving the line", () => {
    fc.assert(
      fc.property(coincidentArb, (input) => {
        assertNoOverlapAndOnLine(input);
      }),
      { numRuns: 300 },
    );
  });

  it("gives three coincident points three distinct rows", () => {
    fc.assert(
      fc.property(
        position,
        fc.tuple(width, width, width),
        lineWidth,
        (spot, widths, line) => {
          const boxes = placeLineLabels({
            positions: [spot, spot, spot],
            widths,
            lineWidth: line,
          });
          expect(new Set(boxes.map((b) => b.row)).size).toBe(3);
        },
      ),
      { numRuns: 200 },
    );
  });
});
