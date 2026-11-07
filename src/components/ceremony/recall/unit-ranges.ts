// The fixed Recall_Scale ranges per display unit (spec 08 design.md, "The
// Unit_Range_Table"; spec 09 C8, option b).
//
// The table is keyed by the unit the judge sees. A sealed unit whose display is
// rescaled (`EUR per 1,000 litres`, shown as `EUR per litre`) is resolved with
// `displayUnitFor` first, so the range, the ticks and the typed answer all use
// the displayed unit. The stored answer is never converted.
//
// These are literals. They are not computed from any figure, so the scale never
// depends on a Now_Figure, a Catalogue value or an answer. Lookup is exact: no
// trimming and no case folding.
//
// Pure module: no DOM, clock or randomness.

import { displayRescaleForUnit } from "@/lib/figures/rescale";

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

/** Approved ranges, keyed by the displayed unit. Exactly these two keys. */
export const UNIT_RANGE_TABLE: Readonly<Record<string, ScaleRange>> = {
  "USD per gallon": {
    min: 0,
    max: 10,
    scale: "linear",
    ticks: [0, 2, 4, 6, 8, 10],
  },
  "EUR per litre": {
    min: 0,
    max: 3,
    scale: "linear",
    ticks: [0, 0.5, 1, 1.5, 2, 2.5, 3],
  },
};

/**
 * The range for a displayed unit string. Only an exact own key of
 * UNIT_RANGE_TABLE returns its entry; every other string gets FALLBACK_RANGE
 * (R7.3, R7.4, R7.5).
 */
export function scaleRangeFor(unit: string): ScaleRange {
  return Object.hasOwn(UNIT_RANGE_TABLE, unit)
    ? UNIT_RANGE_TABLE[unit]
    : FALLBACK_RANGE;
}

/**
 * The unit the judge sees for a sealed unit string. A unit with a display
 * rescale (C8) shows its display unit; every other unit shows itself. It reads
 * only the sealed unit string.
 */
export function displayUnitFor(sealedUnit: string): string {
  return displayRescaleForUnit(sealedUnit)?.displayUnit ?? sealedUnit;
}

/**
 * The rescale note shown beside each figure value of a sealed unit, or null
 * when the unit is shown as sealed.
 */
export function rescaleNoteFor(sealedUnit: string): string | null {
  return displayRescaleForUnit(sealedUnit)?.note ?? null;
}
