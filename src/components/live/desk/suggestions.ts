/**
 * The question suggestions the Write desk offers for an Occasion (spec 14, W8).
 * A suggestion is only a candidate row. It is never sent or sealed until the
 * author adds it, and it leaves the list once a row with the same text exists.
 *
 * Pure module: no React, safe in the browser and in tests.
 */

import { OCCASIONS, SHARED_SUGGESTIONS, type OccasionId } from "../occasions";

/**
 * The suggestions for an Occasion, in list order: the Occasion's own
 * suggestions first, then SHARED_SUGGESTIONS. A suggestion already present as
 * a row (compared after trim) is skipped. Duplicates in the list are kept once,
 * at their first position.
 */
export function suggestionsFor(
  occasion: OccasionId,
  existingRows: readonly string[],
): string[] {
  const found = OCCASIONS.find((o) => o.id === occasion);
  if (!found) {
    throw new Error(`Unknown occasion: ${occasion}`);
  }

  const taken = new Set(existingRows.map((row) => row.trim()));
  const seen = new Set<string>();
  const result: string[] = [];

  for (const suggestion of [...found.suggestions, ...SHARED_SUGGESTIONS]) {
    if (seen.has(suggestion)) continue;
    seen.add(suggestion);
    if (taken.has(suggestion.trim())) continue;
    result.push(suggestion);
  }

  return result;
}
