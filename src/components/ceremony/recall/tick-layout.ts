// Which tick labels under the Recall_Scale track are drawn, and where
// (spec 08 design.md, "Tick labels", R6.5; spec 09 design.md, A10).
//
// The ticks are drawn at every k-th entry of the range's tick list, starting
// at the first, where k is the smallest divisor of (number of ticks - 1) whose
// labels all fit: each box stays inside the track and keeps a gap of at least
// TICK_GAP_PX from its neighbour. The first and last ticks are always drawn,
// so k = (number of ticks - 1) is the last resort and keeps only the two ends.
// The first tick is anchored at its start, the last at its end, and the rest
// are centred on their position.
//
// Pure module: the caller supplies the track width and each label's width.

import { TICK_GAP_PX } from "../constants";
import { positionOfIn } from "./scale-math";
import type { ScaleRange } from "./unit-ranges";

export { TICK_CHAR_PX, TICK_GAP_PX, TRACK_MIN_PX } from "../constants";

/** One tick label that is drawn. */
export type VisibleTick = {
  value: number;
  /** Position along the track in [0, 1]. */
  position: number;
  anchor: "start" | "centre" | "end";
};

type Box = { left: number; right: number };

/** The divisors of `m` (m >= 1), smallest first. */
function divisorsAscending(m: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= m; d += 1) if (m % d === 0) out.push(d);
  return out;
}

/**
 * The tick labels to draw for `range` on a track `trackPx` wide. `labelPx`
 * gives each tick's label width in px. Boxes stay inside [0, trackPx] and keep
 * a gap of at least TICK_GAP_PX between neighbours. The first and last ticks
 * are always drawn.
 */
export function visibleTicks(
  range: ScaleRange,
  trackPx: number,
  labelPx: (tick: number) => number,
): VisibleTick[] {
  const ticks = range.ticks;
  const count = ticks.length;
  if (count === 0) return [];
  if (count === 1) {
    return [{ value: ticks[0], position: positionOfIn(ticks[0], range), anchor: "start" }];
  }

  const anchorOf = (i: number): VisibleTick["anchor"] =>
    i === 0 ? "start" : i === count - 1 ? "end" : "centre";

  const boxOf = (i: number): Box => {
    const x = positionOfIn(ticks[i], range) * trackPx;
    const w = labelPx(ticks[i]);
    if (anchorOf(i) === "start") return { left: x, right: x + w };
    if (anchorOf(i) === "end") return { left: x - w, right: x };
    return { left: x - w / 2, right: x + w / 2 };
  };

  const place = (indices: number[]): VisibleTick[] =>
    indices.map((i) => ({
      value: ticks[i],
      position: positionOfIn(ticks[i], range),
      anchor: anchorOf(i),
    }));

  const fits = (indices: number[]): boolean => {
    const boxes = indices.map(boxOf);
    for (const box of boxes) {
      if (box.left < 0 || box.right > trackPx) return false;
    }
    for (let i = 1; i < boxes.length; i += 1) {
      if (boxes[i].left - boxes[i - 1].right < TICK_GAP_PX) return false;
    }
    return true;
  };

  for (const k of divisorsAscending(count - 1)) {
    const kept: number[] = [];
    for (let i = 0; i < count; i += k) kept.push(i);
    if (fits(kept)) return place(kept);
  }
  return place([0, count - 1]);
}
