// Feature: 05-reveal-ceremony
//
// Number_Line geometry (design.md, "Number_Line geometry"). Pure: no DOM,
// no clock, no randomness. The range comes only from the then and now values,
// so a Mark can never move a stamp. Positions are for drawing only. Number()
// is used here and nowhere else; no displayed number is ever computed from a
// position (R12.4), and the stored value strings are never changed.

import {
  LINE_PAD_SPAN_FRACTION,
  LINE_PAD_VALUE_FRACTION,
  LINE_PAD_ZERO,
} from "../constants";

export interface NumberLineGeometry {
  /** Lower edge of the drawn range, in the figure's unit. */
  readonly rangeLow: number;
  /** Upper edge of the drawn range, in the figure's unit. */
  readonly rangeHigh: number;
  /** Padding added on each side of the span. */
  readonly pad: number;
  /** Position of the then value on the axis, 0 to 1. */
  readonly posThen: number;
  /** Position of the now value on the axis, 0 to 1. */
  readonly posNow: number;
  /** Position of the Mark, 0 to 1. Undefined when there is no answer. */
  readonly posMark: number | undefined;
}

/** Clamp a number to the closed interval [0, 1]. */
export function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function drawableNumber(value: string | number, label: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new RangeError(`number-line: ${label} is not a finite number`);
  }
  return n;
}

/**
 * Geometry for one comparable figure pair.
 *
 * @param thenValue the then value, as the figure's value string (or number)
 * @param nowValue the now value, as the figure's value string (or number)
 * @param markValue the Mark value, or undefined for "No answer"
 */
export function numberLineGeometry(
  thenValue: string | number,
  nowValue: string | number,
  markValue?: string | number,
): NumberLineGeometry {
  const t = drawableNumber(thenValue, "then");
  const n = drawableNumber(nowValue, "now");
  const m = markValue === undefined ? undefined : drawableNumber(markValue, "mark");

  const lo = Math.min(t, n);
  const hi = Math.max(t, n);
  const span = hi - lo;

  let pad = Math.max(LINE_PAD_SPAN_FRACTION * span, LINE_PAD_VALUE_FRACTION * Math.abs(t));
  if (pad === 0) pad = LINE_PAD_ZERO; // only when then = now = 0

  const rangeLow = lo - pad;
  const rangeHigh = hi + pad;
  const width = span + 2 * pad;

  const pos = (v: number): number => clamp01((v - rangeLow) / width);

  return {
    rangeLow,
    rangeHigh,
    pad,
    posThen: pos(t),
    posNow: pos(n),
    posMark: m === undefined ? undefined : pos(m),
  };
}
