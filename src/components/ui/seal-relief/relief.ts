// Feature: 13-the-seal (U1 to U5, U8 to U10)
//
// Seal_Relief: the relief drawn on a seal, derived from a letter's SHA-256
// fingerprint (design.md "1. Seal_Relief").
//
// Two layers read disjoint hex digits (U10.2):
//   - Coarse_Layer: hex digits 0 to 7 (bytes 0 to 3). Notches and rings.
//   - Fine_Layer: hex digits 8 to 63 (bytes 4 to 31). 32 ticks and 32 dots.
//     Ticks 0 to 3 and dots 0 to 3 are fixed (U10.3).
//
// The module does arithmetic on doubles and literal tables only. It makes no
// trig calls at run time, so every browser and server gets the same numbers
// (see slot-vectors.ts). It draws nothing itself. It imports nothing outside
// this folder, so it can never reach the crypto, letter store or database
// code (G1.5).

import {
  DOT_DIR,
  DOT_TAN,
  NOTCH_DIR,
  NOTCH_TAN,
  TICK_DIR,
  TICK_TAN,
} from "./slot-vectors";

/** A point in the 100-unit drawing space. */
export type Pt = readonly [number, number];

/** Recorded ranges (U10.4). */
export const TICK_COUNT = 32;
export const DOT_COUNT = 32;
export const NOTCH_MIN = 3;
export const NOTCH_MAX = 7;
export const RING_MIN = 1;
export const RING_MAX = 2;
export const COARSE_FEATURE_MAX = 12;
/** Largest distance from the centre of any fine vertex or dot edge. */
export const RELIEF_MAX_RADIUS = 43.5;
/** Largest distance from the centre of any coarse vertex or ring edge. */
export const COARSE_MAX_RADIUS = 44.8;

/** The centre of the 100-unit drawing space. */
const CENTRE = 50;

/** The fixed nibble for ticks 0 to 3 and dots 0 to 3 (a = 1, b = 1). */
const FIXED_NIBBLE = 5;

// Fine_Layer geometry.
const TICK_R0 = 34.9;
const TICK_HALF_WIDTH = 1.0;
const DOT_R_BASE = 27.75;
const DOT_RADIUS = 0.7;

// Coarse_Layer geometry.
export const NOTCH_RADIUS_INNER = 28.4;
export const NOTCH_RADIUS_OUTER = 34.3;
export const NOTCH_HALF_WIDTH = 5.5;
export const RING_WIDTH = 4.2;
export const RING_CENTRE_INNER = 37.7;
export const RING_CENTRE_OUTER = 42.7;

/**
 * Notch offsets in 15 degree slots, per notch count. Every row starts at 0,
 * and every gap between neighbours (wrap-around included) is at least 3 slots,
 * so no two notches overlap.
 */
const NOTCH_PATTERN: readonly (readonly number[])[] = [
  [],
  [],
  [],
  [0, 8, 16],
  [0, 6, 12, 18],
  [0, 5, 10, 14, 19],
  [0, 4, 8, 12, 16, 20],
  [0, 3, 7, 10, 14, 17, 21],
];

const RING_NAME = ["inner", "outer", "both"] as const;

const HEX = "0123456789abcdef";
const FINGERPRINT = /^[0-9a-f]{64}$/;

export type TickMark = {
  kind: "tick";
  slot: number;
  nibble: number;
  lengthLevel: number;
  shiftLevel: number;
  corners: readonly [Pt, Pt, Pt, Pt];
};

export type DotMark = {
  kind: "dot";
  slot: number;
  nibble: number;
  radialLevel: number;
  shiftLevel: number;
  cx: number;
  cy: number;
  r: number;
};

/** Exactly 64 marks in a fixed order: ticks 0 to 31, then dots 0 to 31. */
export type ReliefMark = TickMark | DotMark;

export type CoarseNotch = {
  kind: "notch";
  index: number;
  slot: number;
  corners: readonly [Pt, Pt, Pt, Pt];
};

export type CoarseRing = {
  kind: "ring";
  band: "inner" | "outer";
  radius: number;
  width: number;
};

export type CoarseLayer = {
  /** Rotation, 0 to 23. */
  sum: number;
  /** Notch count, 3 to 7. */
  notchCount: number;
  /** 0 inner ring only, 1 outer ring only, 2 both. */
  ringState: 0 | 1 | 2;
  mirror: 0 | 1;
  notches: readonly CoarseNotch[];
  rings: readonly CoarseRing[];
  notchPath: string;
  /** The value of data-coarse, for example "n7;s20;m1;r=outer". */
  signature: string;
};

export type SealRelief =
  | {
      kind: "relief";
      hash: string;
      coarse: CoarseLayer;
      marks: readonly ReliefMark[];
      tickPath: string;
      dotPath: string;
    }
  | {
      kind: "blank";
      coarse: null;
      marks: readonly [];
      tickPath: "";
      dotPath: "";
    };

/** The Blank_Signet: what a seal draws when there is no valid fingerprint. */
export const BLANK_RELIEF: SealRelief = {
  kind: "blank",
  coarse: null,
  marks: [],
  tickPath: "",
  dotPath: "",
};

/** True for exactly 64 lowercase hex characters. Anything else is refused. */
export function isFingerprintHex(s: unknown): s is string {
  return typeof s === "string" && FINGERPRINT.test(s);
}

function fmt(n: number): string {
  return n.toFixed(2);
}

function quadPath(corners: readonly Pt[]): string {
  const [a, b, c, d] = corners;
  return `M ${fmt(a[0])} ${fmt(a[1])} L ${fmt(b[0])} ${fmt(b[1])} L ${fmt(c[0])} ${fmt(c[1])} L ${fmt(d[0])} ${fmt(d[1])} Z`;
}

function circlePath(cx: number, cy: number, r: number): string {
  return (
    `M ${fmt(cx - r)} ${fmt(cy)} A ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx + r)} ${fmt(cy)} ` +
    `A ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx - r)} ${fmt(cy)} Z`
  );
}

/** A tick: a quad at radius TICK_R0 along slot k, length and shift from the nibble. */
function tickMark(k: number, nibble: number): TickMark {
  const a = nibble >> 2;
  const b = nibble & 3;
  const length = 3.4 + 1.6 * a;
  const shift = (b - 1.5) * 1.2;
  const [dx, dy] = TICK_DIR[k];
  const [tx, ty] = TICK_TAN[k];
  const bx = CENTRE + dx * TICK_R0 + tx * shift;
  const by = CENTRE + dy * TICK_R0 + ty * shift;
  const w = TICK_HALF_WIDTH;
  return {
    kind: "tick",
    slot: k,
    nibble,
    lengthLevel: a,
    shiftLevel: b,
    corners: [
      [bx - tx * w, by - ty * w],
      [bx + tx * w, by + ty * w],
      [bx + tx * w + dx * length, by + ty * w + dy * length],
      [bx - tx * w + dx * length, by - ty * w + dy * length],
    ],
  };
}

/** A dot: a circle of radius DOT_RADIUS along dot slot k, radius and shift from the nibble. */
function dotMark(k: number, nibble: number): DotMark {
  const c = nibble >> 2;
  const e = nibble & 3;
  const radius = DOT_R_BASE + 1.0 * c;
  const shift = (e - 1.5) * 1.0;
  const [dx, dy] = DOT_DIR[k];
  const [tx, ty] = DOT_TAN[k];
  return {
    kind: "dot",
    slot: k,
    nibble,
    radialLevel: c,
    shiftLevel: e,
    cx: CENTRE + dx * radius + tx * shift,
    cy: CENTRE + dy * radius + ty * shift,
    r: DOT_RADIUS,
  };
}

/** The four corners of a notch on notch slot `slot`, in order around the quad. */
function notchCorners(slot: number): readonly [Pt, Pt, Pt, Pt] {
  const [dx, dy] = NOTCH_DIR[slot];
  const [tx, ty] = NOTCH_TAN[slot];
  const at = (r: number, side: 1 | -1): Pt => [
    CENTRE + dx * r + tx * side * NOTCH_HALF_WIDTH,
    CENTRE + dy * r + ty * side * NOTCH_HALF_WIDTH,
  ];
  return [
    at(NOTCH_RADIUS_INNER, -1),
    at(NOTCH_RADIUS_INNER, 1),
    at(NOTCH_RADIUS_OUTER, 1),
    at(NOTCH_RADIUS_OUTER, -1),
  ];
}

/** Coarse_Layer from hex digits 0 to 7 (values 0 to 15 each). */
function coarseLayer(d: readonly number[]): CoarseLayer {
  let total = 0;
  for (let i = 0; i < 8; i++) total += d[i];
  const sum = total % 24;
  const notchCount = 3 + ((d[0] + d[1]) % 5);
  const ringState = ((d[2] + d[3]) % 3) as 0 | 1 | 2;
  const mirror = ((d[4] + d[5] + d[6] + d[7]) % 2) as 0 | 1;

  const notches: CoarseNotch[] = NOTCH_PATTERN[notchCount].map(
    (offset, index) => {
      const turned = mirror === 1 ? -offset : offset;
      const slot = (((sum + turned) % 24) + 24) % 24;
      return { kind: "notch", index, slot, corners: notchCorners(slot) };
    },
  );

  const rings: CoarseRing[] = [];
  if (ringState === 0 || ringState === 2) {
    rings.push({
      kind: "ring",
      band: "inner",
      radius: RING_CENTRE_INNER,
      width: RING_WIDTH,
    });
  }
  if (ringState === 1 || ringState === 2) {
    rings.push({
      kind: "ring",
      band: "outer",
      radius: RING_CENTRE_OUTER,
      width: RING_WIDTH,
    });
  }

  return {
    sum,
    notchCount,
    ringState,
    mirror,
    notches,
    rings,
    notchPath: notches.map((n) => quadPath(n.corners)).join(" "),
    signature: `n${notchCount};s${sum};m${mirror};r=${RING_NAME[ringState]}`,
  };
}

/** Derives the relief for a valid fingerprint. Callers use sealRelief. */
function deriveRelief(hash: string): SealRelief {
  const d: number[] = Array.from(hash, (ch) => HEX.indexOf(ch));

  const marks: ReliefMark[] = [];
  for (let k = 0; k < TICK_COUNT; k++) {
    const nibble = k < 4 ? FIXED_NIBBLE : d[2 * k];
    marks.push(tickMark(k, nibble));
  }
  for (let k = 0; k < DOT_COUNT; k++) {
    const nibble = k < 4 ? FIXED_NIBBLE : d[2 * k + 1];
    marks.push(dotMark(k, nibble));
  }

  const tickPath = marks
    .filter((m): m is TickMark => m.kind === "tick")
    .map((m) => quadPath(m.corners))
    .join(" ");
  const dotPath = marks
    .filter((m): m is DotMark => m.kind === "dot")
    .map((m) => circlePath(m.cx, m.cy, m.r))
    .join(" ");

  return {
    kind: "relief",
    hash,
    coarse: coarseLayer(d.slice(0, 8)),
    marks,
    tickPath,
    dotPath,
  };
}

/**
 * The relief for a fingerprint. Deterministic and total: any input that is not
 * exactly 64 lowercase hex characters returns BLANK_RELIEF, and it never throws.
 */
export function sealRelief(hash: unknown): SealRelief {
  return isFingerprintHex(hash) ? deriveRelief(hash) : BLANK_RELIEF;
}

function dist(p: Pt, q: Pt): number {
  return Math.sqrt((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2);
}

/** Largest move of any corner of two index-matched features. */
function cornerMove(a: readonly Pt[], b: readonly Pt[]): number {
  let max = 0;
  for (let i = 0; i < a.length; i++) max = Math.max(max, dist(a[i], b[i]));
  return max;
}

/** Largest move of one fine mark. Ticks compare corners, dots compare centres. */
function markMove(a: ReliefMark, b: ReliefMark): number {
  if (a.kind === "tick" && b.kind === "tick")
    return cornerMove(a.corners, b.corners);
  if (a.kind === "dot" && b.kind === "dot")
    return dist([a.cx, a.cy], [b.cx, b.cy]);
  return Infinity;
}

/**
 * Largest displacement of any index-matched feature (fine marks, notches by
 * index, rings by band). Infinity when either relief is blank, or when the
 * notch count or the ring state differs (a count change).
 */
export function reliefDistance(a: SealRelief, b: SealRelief): number {
  if (a.kind === "blank" || b.kind === "blank") return Infinity;
  if (a.coarse.notchCount !== b.coarse.notchCount) return Infinity;
  if (a.coarse.ringState !== b.coarse.ringState) return Infinity;

  let max = 0;
  for (let i = 0; i < a.marks.length; i++) {
    max = Math.max(max, markMove(a.marks[i], b.marks[i]));
  }
  for (let i = 0; i < a.coarse.notches.length; i++) {
    max = Math.max(
      max,
      cornerMove(a.coarse.notches[i].corners, b.coarse.notches[i].corners),
    );
  }
  for (let i = 0; i < a.coarse.rings.length; i++) {
    max = Math.max(
      max,
      Math.abs(a.coarse.rings[i].radius - b.coarse.rings[i].radius),
    );
  }
  return max;
}

/**
 * Count of fine marks, matched by index, that move at least `minUnits`. A blank
 * relief has no marks, so the count is 0.
 */
export function movedMarks(
  a: SealRelief,
  b: SealRelief,
  minUnits: number,
): number {
  if (a.kind === "blank" || b.kind === "blank") return 0;
  let count = 0;
  for (let i = 0; i < a.marks.length; i++) {
    if (markMove(a.marks[i], b.marks[i]) >= minUnits) count++;
  }
  return count;
}

/**
 * U9.5 coarse difference: the size of the symmetric difference of the occupied
 * notch slots, plus the size of the symmetric difference of the ring bands.
 * Infinity if either relief is blank.
 */
export function coarseDifference(a: SealRelief, b: SealRelief): number {
  if (a.kind === "blank" || b.kind === "blank") return Infinity;
  const xorSize = <T>(x: ReadonlySet<T>, y: ReadonlySet<T>): number => {
    let n = 0;
    for (const v of x) if (!y.has(v)) n++;
    for (const v of y) if (!x.has(v)) n++;
    return n;
  };
  const slotsA = new Set(a.coarse.notches.map((n) => n.slot));
  const slotsB = new Set(b.coarse.notches.map((n) => n.slot));
  const bandsA = new Set(a.coarse.rings.map((r) => r.band));
  const bandsB = new Set(b.coarse.rings.map((r) => r.band));
  return xorSize(slotsA, slotsB) + xorSize(bandsA, bandsB);
}
