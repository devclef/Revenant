// Feature: 10 (spec 10 X1.1, X1.2, X1.3)
//
// Number_Line tick heights. Pure: no DOM, no clock, no figure value.
//
// A tick (the Then tick, the Now tick and the Mark's leader) hangs from the
// axis top edge, so it always starts at y = 0. It ends TICK_LABEL_GAP_PX above
// the top of its own label row, whichever row placeLineLabels gives it. The
// label row top is the same calc the labels use in NumberLine.tsx:
//   top = LINE_LABEL_TOP_REM rem + row * LINE_LABEL_ROW_EM em,
// where em is the label's own font size (0.8rem, see .lineLabel).

import {
  LINE_LABEL_ROW_EM,
  LINE_LABEL_TOP_REM,
  TICK_LABEL_GAP_PX,
} from "../constants";
import { tickCrosses, type LabelBox } from "./line-labels";

/** Root font size used for the static render, before any measurement (X1.2). */
export const STATIC_REM_PX = 16;

/** The label font size in rem. Matches `.lineLabel { font-size: 0.8rem }`. */
export const LABEL_FONT_REM = 0.8;

/**
 * Top edge of a label row below the axis, in px from the axis top edge.
 *
 * @param row the label row, 0 is the first row
 * @param remPx the root font size in px
 * @param emPx the label's own font size in px
 */
export function labelRowTopPx(
  row: number,
  remPx: number,
  emPx: number,
): number {
  return LINE_LABEL_TOP_REM * remPx + row * LINE_LABEL_ROW_EM * emPx;
}

/**
 * Height of a tick that hangs from the axis top edge and stops
 * TICK_LABEL_GAP_PX above its label row.
 *
 * @param row the row the tick's label was placed in
 * @param remPx the root font size in px
 * @param emPx the label's own font size in px
 */
export function tickLeaderPx(row: number, remPx: number, emPx: number): number {
  return labelRowTopPx(row, remPx, emPx) - TICK_LABEL_GAP_PX;
}

/**
 * Bottom edge of each tick, in px from the axis top edge (spec 10 X1.4).
 *
 * A tick normally ends TICK_LABEL_GAP_PX above its own label row. If it would
 * pass through a label in a row above its own, it stops TICK_LABEL_GAP_PX above
 * the top of the highest such row instead. The label then loses its leader.
 * This happens only in the fallback layout, or when two points sit at one spot.
 *
 * @param boxes the placed labels, from placeLineLabels
 * @param tickXs each tick's x in px, in the same order as boxes
 * @param remPx the root font size in px
 * @param emPx the label's own font size in px
 */
export function tickBottomsPx(
  boxes: readonly LabelBox[],
  tickXs: readonly number[],
  remPx: number,
  emPx: number,
): number[] {
  return boxes.map((box, i) => {
    let bottom = tickLeaderPx(box.row, remPx, emPx);
    boxes.forEach((other, k) => {
      if (k === i || other.row >= box.row) return;
      if (tickCrosses(tickXs[i], other.x, other.width)) {
        bottom = Math.min(
          bottom,
          labelRowTopPx(other.row, remPx, emPx) - TICK_LABEL_GAP_PX,
        );
      }
    });
    return bottom;
  });
}
