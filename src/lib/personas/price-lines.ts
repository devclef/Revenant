// Letter_Price_Line checks for the persona letters (spec 10 design.md,
// "C5. Sample answers"; issue #307, P1).
//
// A persona letter states each tracked price once, as a sentence such as
// "about $3.64 a gallon" or "about €1.79 a litre". The number in that sentence
// must be the same number the Record_Candidate shows for the same sealed
// figure, so both come from recordCandidate. expectedPrices returns those
// numbers in the persona's metric order.
//
// Pure module: no DOM, clock, randomness or I/O.

import { DEMO_FIGURES } from "@/lib/figures/demo";
import type { LoadedFigures } from "@/lib/figures/types";
import { thenAndNow } from "@/lib/figures/then-now";

import type { Persona } from "./schema";
import { recordCandidate } from "./record-candidate";

/**
 * A price phrase in a persona letter: "about", then "$" or "€", then a number
 * with exactly two decimals. Capture group 1 is the number. Global, so use
 * matchAll (which copies the regex) rather than exec on this shared object.
 */
export const PRICE_RE = /about (?:\$|€)([0-9]+\.[0-9]{2})(?![0-9])/g;

/**
 * The Letter_Price_Line numbers a persona letter must state, one per tracked
 * metric in the persona's metric order. Each number is the Record_Candidate of
 * the then-figure at the persona's written_as_of date. Throws RangeError when
 * the sealed figure is missing, because a price line is never estimated.
 */
export function expectedPrices(
  persona: Persona,
  figures: LoadedFigures = DEMO_FIGURES,
): string[] {
  return persona.metrics.map((metric) => {
    const { then } = thenAndNow(
      metric.metric_id,
      persona.written_as_of,
      figures,
    );
    if (!then.found) {
      throw new RangeError(
        `persona "${persona.key}": no then-figure for ${metric.metric_id} (${then.reason})`,
      );
    }
    return recordCandidate(then.figure);
  });
}
