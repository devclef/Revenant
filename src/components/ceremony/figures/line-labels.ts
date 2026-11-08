// Feature: 08-judge-polish, task 2; extended by spec 10 X1 (Property 20)
//
// Number_Line label placement (spec 08 design.md, "Number_Line labels").
// Pure: no DOM, no clock, no randomness, and no figure value. It takes the
// three points' positions (0 to 1), the three label widths in px and the line
// width in px, and returns where each label goes (R5.4 to R5.6).
//
// Labels go in the fixed order Then, Now, Your answer. Each tick hangs from the
// axis top edge down to its own label's row, so a tick crosses every row above
// its own. Placement therefore keeps three things true (spec 10 X1.4, Property
// 20):
//   1. Each tick's x lies inside its own label's box.
//   2. Two labels in one row keep LINE_LABEL_GAP_PX between them.
//   3. No label box contains the x of a tick from a row below it.
//
// The search tries the row plans in order (lowest deepest row first, then the
// smallest total shift from each label's centred spot). Within a plan, a label
// may slide sideways inside its clamp to satisfy rules 1 to 3. When no plan
// satisfies all three, the plan falls back to the greedy placement: each label
// is centred and clamped, then takes the lowest row free of overlaps. That
// fallback can leave a tick crossing a label. tickBottomsPx (tick-leader.ts)
// then stops such a tick above the label it would cross, so no tick runs
// through a label. Ticks at one spot always need that stop: a label containing
// the spot can't also exclude it.

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

/** A tick is 2 px wide and centred on its point (figures.module.css .tick). */
export const TICK_HALF_PX = 1;

// Tolerance for float comparisons. Candidate positions sit this far outside a
// boundary so the boundary itself counts as clear.
const EPS = 0.01;

type Row = 0 | 1 | 2;

// All nine-by-three row plans, lowest deepest row first, then smallest sum.
const ROW_PLANS: ReadonlyArray<readonly [Row, Row, Row]> = (() => {
  const plans: Array<[Row, Row, Row]> = [];
  for (const a of [0, 1, 2] as const) {
    for (const b of [0, 1, 2] as const) {
      for (const c of [0, 1, 2] as const) {
        plans.push([a, b, c]);
      }
    }
  }
  const deepest = (p: readonly [Row, Row, Row]) => Math.max(...p);
  const total = (p: readonly [Row, Row, Row]) => p[0] + p[1] + p[2];
  return plans.sort((p, q) => deepest(p) - deepest(q) || total(p) - total(q));
})();

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

// True when a tick at x (2 px wide) overlaps the box [boxX, boxX + width].
export function tickCrosses(tickX: number, boxX: number, width: number): boolean {
  return boxX < tickX + TICK_HALF_PX && boxX + width > tickX - TICK_HALF_PX;
}

/**
 * Searches one row plan. Returns each label's left edge, or undefined when no
 * edge for the three labels satisfies every rule.
 */
function searchPlan(
  ticks: readonly number[],
  widths: readonly number[],
  lineWidth: number,
  rows: readonly [Row, Row, Row],
): readonly number[] | undefined {
  const lows: number[] = [];
  const highs: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    const low = Math.max(0, ticks[i] - widths[i]);
    const high = Math.min(lineWidth - widths[i], ticks[i]);
    if (low > high) return undefined;
    lows.push(low);
    highs.push(high);
  }

  // Candidate left edges for each label: its centred spot, both clamp ends, and
  // the spots just clear of every other tick and label.
  const candidates = [0, 1, 2].map((i) => {
    const set = new Set<number>([
      clampTo(ticks[i] - widths[i] / 2, lows[i], highs[i]),
      lows[i],
      highs[i],
    ]);
    for (let j = 0; j < 3; j += 1) {
      if (j === i) continue;
      set.add(ticks[j] + TICK_HALF_PX + EPS);
      set.add(ticks[j] - TICK_HALF_PX - widths[i] - EPS);
      set.add(ticks[j] + widths[j] + LINE_LABEL_GAP_PX);
      set.add(ticks[j] - LINE_LABEL_GAP_PX - widths[i]);
    }
    return [...set]
      .filter((x) => x >= lows[i] - EPS && x <= highs[i] + EPS)
      .map((x) => clampTo(x, lows[i], highs[i]));
  });

  const valid = (xs: readonly number[]): boolean => {
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        if (i === j) continue;
        if (rows[i] === rows[j] && i < j) {
          const a = { x: xs[i], width: widths[i] };
          const b = { x: xs[j], width: widths[j] };
          if (collides(a, b)) return false;
        }
        // A tick from a deeper row crosses every label above it.
        if (rows[j] > rows[i] && tickCrosses(ticks[j], xs[i], widths[i])) {
          return false;
        }
      }
    }
    return true;
  };

  let best: number[] | undefined;
  let bestShift = Infinity;
  for (const x0 of candidates[0]) {
    for (const x1 of candidates[1]) {
      for (const x2 of candidates[2]) {
        const xs = [x0, x1, x2];
        if (!valid(xs)) continue;
        const shift = xs.reduce(
          (sum, x, i) => sum + Math.abs(x - (ticks[i] - widths[i] / 2)),
          0,
        );
        if (shift < bestShift) {
          bestShift = shift;
          best = xs;
        }
      }
    }
  }
  return best;
}

/** The greedy fallback: centre and clamp each label, then take the lowest free row. */
function greedy(
  ticks: readonly number[],
  widths: readonly number[],
  lineWidth: number,
): Array<{ x: number; width: number; row: Row }> {
  const placed: Array<{ x: number; width: number; row: Row }> = [];
  for (let i = 0; i < 3; i += 1) {
    const width = widths[i];
    const x = clampTo(ticks[i] - width / 2, 0, lineWidth - width);
    let row: Row = 0;
    while (placed.some((other) => other.row === row && collides({ x, width }, other))) {
      row = (row + 1) as Row;
    }
    placed.push({ x, width, row });
  }
  return placed;
}

export function placeLineLabels(
  input: LineLabelInput,
): readonly [LabelBox, LabelBox, LabelBox] {
  const { positions, widths, lineWidth } = input;
  const ticks = positions.map((p) => p * lineWidth);

  for (const rows of ROW_PLANS) {
    const xs = searchPlan(ticks, widths, lineWidth, rows);
    if (xs !== undefined) {
      return [
        { x: xs[0], width: widths[0], row: rows[0] },
        { x: xs[1], width: widths[1], row: rows[1] },
        { x: xs[2], width: widths[2], row: rows[2] },
      ] as const;
    }
  }

  const placed = greedy(ticks, widths, lineWidth);
  return [placed[0], placed[1], placed[2]] as const;
}
