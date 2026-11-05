// Feature: 08-judge-polish, task 2
//
// Number_Line label placement (spec 08 design.md, "Number_Line labels").
// Pure: no DOM, no clock, no randomness, and no figure value. It takes the
// three points' positions (0 to 1), the three label widths in px and the line
// width in px, and returns where each label goes (R5.4 to R5.6).
//
// Labels go in the fixed order Then, Now, Your answer. Each is centred on its
// point and clamped inside the line. It then takes the lowest row in which it
// overlaps no label already placed there, with LINE_LABEL_GAP_PX between
// labels in one row. Three labels never need more than three rows, so a free
// row always exists.

import { LINE_LABEL_GAP_PX } from "../constants";

export type LineLabelInput = {
  /** Then, Now and Your answer positions on the line, each 0 to 1. */
  readonly positions: readonly [number, number, number];
  /** Then, Now and Your answer label widths, in px. */
  readonly widths: readonly [number, number, number];
  /** The line's width, in px. */
  readonly lineWidth: number;
};

export type LabelBox = {
  /** Left edge, in px from the line's left end. */
  readonly x: number;
  /** Width, in px. */
  readonly width: number;
  /** Row below the axis: 0 is the first row. */
  readonly row: 0 | 1 | 2;
};

function clampTo(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(value, high));
}

// Two boxes in one row collide when, with the gap added, their extents meet.
function collides(
  a: { x: number; width: number },
  b: { x: number; width: number },
): boolean {
  return (
    a.x < b.x + b.width + LINE_LABEL_GAP_PX && b.x < a.x + a.width + LINE_LABEL_GAP_PX
  );
}

export function placeLineLabels(
  input: LineLabelInput,
): readonly [LabelBox, LabelBox, LabelBox] {
  const { positions, widths, lineWidth } = input;
  const placed: Array<{ x: number; width: number; row: 0 | 1 | 2 }> = [];

  for (let i = 0; i < 3; i += 1) {
    const width = widths[i];
    const centre = positions[i] * lineWidth;
    const x = clampTo(centre - width / 2, 0, lineWidth - width);

    let row: 0 | 1 | 2 = 0;
    while (placed.some((other) => other.row === row && collides({ x, width }, other))) {
      row = (row + 1) as 0 | 1 | 2;
    }
    placed.push({ x, width, row });
  }

  return [placed[0], placed[1], placed[2]] as const;
}
