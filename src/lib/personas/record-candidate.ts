// The sealed Then_Value as the Testify field shows it, written with two decimals
// (spec 10 design.md, "C5. Sample answers").
//
// No persona Figure_Question holds a Record_Candidate any more. The sample
// lists in content/personas/letters/samples.json never contain the sealed
// Then_Value. This function remains only for the letter price lines (P1), which
// print the Then_Value as "about $3.64 a gallon". `formatValue(shown, region, 2)`
// is the number part of that line, where `shown` is the sealed value after the
// unit's Display_Rescale (or the sealed value when the unit has none).
//
// Pure module: no DOM, clock or randomness.

import { formatValue } from "@/lib/figures/format-change";
import {
  displayRescaleForUnit,
  rescaleForDisplay,
} from "@/lib/figures/rescale";

import { SAMPLE_DECIMALS } from "./samples";

/** The sealed figure fields this function reads. */
export type RecordCandidateFigure = {
  value: string;
  unit: string;
  region: string;
};

/**
 * The Then_Value as the Testify field shows it, as a plain decimal string:
 * the sealed value rescaled for display when the unit has a Display_Rescale,
 * otherwise the sealed value itself. Never rounded.
 */
export function shownThenValue(figure: RecordCandidateFigure): string {
  const rescale = displayRescaleForUnit(figure.unit);
  return rescale === null
    ? figure.value
    : rescaleForDisplay(figure.value, rescale.divisor);
}

/**
 * The Record_Candidate for a sealed Then_Figure: the shown Then_Value written
 * with two decimals in the figure's region, for example "3.64" for Maya's
 * regular gasoline value 3.643.
 */
export function recordCandidate(figure: RecordCandidateFigure): string {
  return formatValue(shownThenValue(figure), figure.region, SAMPLE_DECIMALS);
}
