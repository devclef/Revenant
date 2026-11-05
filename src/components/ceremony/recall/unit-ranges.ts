// The fixed Recall_Scale ranges per sealed unit, and the Unit_Helper_Line
// (spec 08 design.md, "The Unit_Range_Table" and R7).
//
// These are literals. They are not computed from any figure, so the scale never
// depends on a Now_Figure, a Catalogue value or an answer. Lookup is exact: no
// trimming and no case folding.
//
// Pure module: no DOM, clock or randomness. It imports only copy strings.

import { CEREMONY_COPY } from "../copy";

/** The track range for one unit. Both shipped ranges are linear. */
export type ScaleRange = {
  min: number;
  max: number;
  scale: "linear" | "log";
  /** The tick values drawn under the track, in ascending order. */
  ticks: readonly number[];
};

/** The range for a unit with no entry in the table: the 10^-2 to 10^5 log track. */
export const FALLBACK_RANGE: ScaleRange = {
  min: 0.01,
  max: 100000,
  scale: "log",
  ticks: [0.01, 0.1, 1, 10, 100, 1000, 10000, 100000],
};

/** Approved ranges (R7.10). Exactly these two keys: no Sweden unit is listed (R7.1, R23.1). */
export const UNIT_RANGE_TABLE: Readonly<Record<string, ScaleRange>> = {
  "USD per gallon": {
    min: 0,
    max: 10,
    scale: "linear",
    ticks: [0, 2, 4, 6, 8, 10],
  },
  "EUR per 1,000 litres": {
    min: 0,
    max: 3000,
    scale: "linear",
    ticks: [0, 500, 1000, 1500, 2000, 2500, 3000],
  },
};

/**
 * The range for a sealed unit string. Only an exact own key of
 * UNIT_RANGE_TABLE returns its entry; every other string gets FALLBACK_RANGE
 * (R7.3, R7.4, R7.5).
 */
export function scaleRangeFor(unit: string): ScaleRange {
  return Object.hasOwn(UNIT_RANGE_TABLE, unit)
    ? UNIT_RANGE_TABLE[unit]
    : FALLBACK_RANGE;
}

/** The one unit that shows the Unit_Helper_Line (R7.8). */
export const UNIT_HELPER_UNIT = "EUR per 1,000 litres";

/**
 * The Unit_Helper_Line for a sealed unit, or null. It compares the unit string
 * with one constant and reads nothing else (R7.9).
 */
export function unitHelperFor(unit: string): string | null {
  return unit === UNIT_HELPER_UNIT ? CEREMONY_COPY.unitHelperEurPer1000L : null;
}
