// Feature: 05-reveal-ceremony
//
// The fixed crack geometry for the Seal_Break (design.md "Cracks (`cracks.ts`)",
// R6.2, R6.6). A sealed wax disc breaks the same way every time: nine cracks run
// from the seal's centre outward, drawn one after another in a fixed order, and
// the seal then splits into FLAKE_COUNT flakes that fall along fixed paths.
//
// This module is pure and deterministic. It owns no DOM, reads no data, and
// calls neither Math.random nor Date.now. The contact point, the persona key
// and the letter are never inputs: every persona's seal cracks identically and
// only its decorative pattern (WaxSeal) differs (R6.6, R10.1). The sole input to
// the drawing function is a progress value in 0..1.
//
// Coordinates are in the WaxSeal's fixed 100×100 user space, centred at
// (50, 50) with a disc radius of 46 (see envelope/WaxSeal.tsx). The cracks are
// drawn in the same space so they overlay the disc exactly at any rendered size.

import { FLAKE_COUNT } from "../constants";

/** The seal's centre and disc radius, matching WaxSeal's 100×100 user space. */
export const SEAL_CENTER = 50;

/** How many cracks there are. Path `i` (0-based) draws when progress ≥ i / CRACK_COUNT. */
export const CRACK_COUNT = 9;

/**
 * One nominal stroke length for every crack path, used as the `stroke-dasharray`
 * and the starting `stroke-dashoffset`. A single constant keeps the dash maths
 * uniform across paths; it only needs to be at least as long as the longest
 * path so a dashoffset of `TOTAL_LENGTH` fully hides it and `0` fully draws it.
 * The exact value is not read from any geometry — it is a drawing constant.
 */
export const TOTAL_LENGTH = 100;

/**
 * The nine crack paths, as literal SVG path data in draw order. Every path
 * starts at the seal's centre (`M 50 50`) and branches outward toward the rim,
 * some with a bend so they read as splintering wax rather than clean spokes.
 * The order is fixed: earlier paths are revealed first. Nothing here is computed
 * from data; these are plain constants.
 */
export const CRACK_PATHS: readonly string[] = [
  // 0 — up, slight lean right
  "M50 50 L52 22",
  // 1 — down-right
  "M50 50 L74 68",
  // 2 — down-left
  "M50 50 L28 70",
  // 3 — right, kinked
  "M50 50 L70 48 L82 42",
  // 4 — up-left, kinked
  "M50 50 L34 38 L22 30",
  // 5 — left
  "M50 50 L18 54",
  // 6 — up-right
  "M50 50 L66 30 L74 20",
  // 7 — down, slight lean left
  "M50 50 L46 80",
  // 8 — down-left shallow, kinked
  "M50 50 L36 60 L24 64",
];

/** One crack's drawing state at a given overall progress. */
export type CrackDraw = {
  /** The path's draw order index, 0..CRACK_COUNT-1. */
  index: number;
  /** The literal SVG path data for this crack. */
  d: string;
  /** How far this individual path is drawn, 0 (hidden) to 1 (fully drawn). */
  drawn: number;
  /**
   * The `stroke-dashoffset` for this path: `TOTAL_LENGTH` when hidden, `0` when
   * fully drawn. Paired with `stroke-dasharray: TOTAL_LENGTH` it reveals the
   * stroke from the centre outward as `drawn` rises.
   */
  dashoffset: number;
};

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Given overall progress `p` in 0..1, return the drawing state of all nine
 * cracks in draw order. Path `i` begins drawing when `p ≥ i / CRACK_COUNT` and
 * completes over the following `1 / CRACK_COUNT` of progress, so the cracks
 * splinter outward one after another and all nine are fully drawn at `p = 1`.
 *
 * Pure: the only input is `p`. The contact point and persona key are not
 * parameters, so every seal cracks the same way (R6.2, R6.6).
 */
export function cracksForProgress(p: number): CrackDraw[] {
  const clamped = clamp01(p);
  return CRACK_PATHS.map((d, index) => {
    const start = index / CRACK_COUNT;
    const local = clamp01((clamped - start) * CRACK_COUNT);
    return {
      index,
      d,
      drawn: local,
      dashoffset: TOTAL_LENGTH * (1 - local),
    };
  });
}

/**
 * One flake's fixed break-up geometry. `angleDeg` is the direction it tumbles
 * away from the centre; `distance` is how far it travels in user-space units;
 * `rotateDeg` is the spin it picks up as it falls; `delay` (0..1) staggers the
 * start of its fall within the split so the flakes don't all leave at once.
 * Every field is fixed per index and taken from constants — never random.
 */
export type FlakeFall = {
  /** The flake's index, 0..FLAKE_COUNT-1. */
  index: number;
  /** Direction of travel in degrees, measured clockwise from straight up. */
  angleDeg: number;
  /** Distance travelled from the centre, in the 100×100 user space. */
  distance: number;
  /** Rotation the flake accrues as it falls, in degrees. */
  rotateDeg: number;
  /** Fraction of the split (0..1) to wait before this flake begins to fall. */
  delay: number;
  /** The flake's horizontal offset from centre at rest, in user-space units. */
  x: number;
  /** The flake's vertical offset from centre at rest, in user-space units. */
  y: number;
};

const TAU = Math.PI * 2;

/**
 * The fall paths for all FLAKE_COUNT flakes, fixed per index. The flakes are
 * spread evenly around the disc with a small fixed per-index variation on
 * distance, spin and delay, all derived from the index alone. There is no
 * randomness: `FLAKE_FALLS[i]` is the same on every render, on the server and
 * the client alike.
 *
 * `x`/`y` are each flake's resting offset from the seal centre, placed on a ring
 * inside the disc radius so the broken pieces start spread across the wax.
 */
export const FLAKE_FALLS: readonly FlakeFall[] = Array.from(
  { length: FLAKE_COUNT },
  (_, index): FlakeFall => {
    // Even spread around the disc, offset so no flake sits dead-centre.
    const angleDeg = (index / FLAKE_COUNT) * 360;
    const a = (angleDeg / 360) * TAU;
    // A fixed resting radius ring just inside the rim.
    const restRadius = 26;
    // Per-index, deterministic variation — a fixed pattern, not random.
    const distance = 52 + (index % 5) * 6;
    const rotateDeg = (index % 2 === 0 ? 1 : -1) * (12 + (index % 4) * 9);
    const delay = (index % 7) / 20; // 0 .. 0.3
    return {
      index,
      angleDeg,
      distance,
      rotateDeg,
      delay,
      x: Math.sin(a) * restRadius,
      y: -Math.cos(a) * restRadius,
    };
  },
);
