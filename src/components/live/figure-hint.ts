/**
 * Which picker hint the Seal_Page shows (spec 09, A4.1 to A4.3).
 *
 * Pure module: no React, so the rules are tested directly and the picker only
 * renders the result. The stated maximum is the smaller of MAX_FIGURES and the
 * number of series the picker offers (Sealable_Count). Callers pass that
 * maximum, so a zero limit is never stated: a count of 0 gives `none`, which
 * shows no range or limit text at all.
 */

export type PickerHint =
  { key: "none" } | { key: "one" } | { key: "many"; max: number };

/**
 * The hint for a picker whose stated maximum is `max`, where
 * `max = min(MAX_FIGURES, sealableCount)`. Fractions and negatives are floored
 * to 0, so no input can produce a range that reads "between 1 and 0".
 */
export function pickerHint(max: number): PickerHint {
  const limit = Math.max(0, Math.floor(max));
  if (limit === 0) return { key: "none" };
  if (limit === 1) return { key: "one" };
  return { key: "many", max: limit };
}
