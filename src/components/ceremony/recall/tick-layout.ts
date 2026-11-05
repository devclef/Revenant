// Which tick labels under the Recall_Scale track are drawn, and where
// (spec 08 design.md, "Tick labels", R6.5).
//
// The first tick is anchored at its start, the last at its end, and the rest
// are centred on their position. Ticks are kept from both ends inward: a tick
// is dropped when its box would come within TICK_GAP_PX of a kept neighbour or
// of the last tick. The first and last ticks are always kept.
//
// Pure module: the caller supplies the track width and each label's width.

import { positionOfIn } from "./scale-math";
import type { ScaleRange } from "./unit-ranges";

/** Smallest gap between two tick label boxes, in px. */
export const TICK_GAP_PX = 4;
/** Track width used before measurement (server render and first client render). */
export const TRACK_MIN_PX = 260;
/** Estimated width of one character of a tick label at 0.75rem, in px. */
export const TICK_CHAR_PX = 7.5;

/** One tick label that is drawn. */
export type VisibleTick = {
  value: number;
  /** Position along the track in [0, 1]. */
  position: number;
  anchor: "start" | "centre" | "end";
};

type Box = { left: number; right: number };

/**
 * The tick labels to draw for `range` on a track `trackPx` wide. `labelPx`
 * gives each tick's label width in px. Boxes stay inside [0, trackPx] and keep
 * a gap of at least TICK_GAP_PX between them.
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

  const first = boxOf(0);
  const last = boxOf(count - 1);
  const keep = new Set<number>([0, count - 1]);
  let placedRight = first.right;

  for (let i = 1; i < count - 1; i += 1) {
    const box = boxOf(i);
    const clearOfLeft = box.left - placedRight >= TICK_GAP_PX;
    const clearOfLast = last.left - box.right >= TICK_GAP_PX;
    const inside = box.left >= 0 && box.right <= trackPx;
    if (clearOfLeft && clearOfLast && inside) {
      keep.add(i);
      placedRight = box.right;
    }
  }

  return [...keep]
    .sort((a, b) => a - b)
    .map((i) => ({
      value: ticks[i],
      position: positionOfIn(ticks[i], range),
      anchor: anchorOf(i),
    }));
}
