/**
 * The one way a sealed figure value is shown on screen.
 *
 * Applies the unit's Display_Rescale (for example "EUR per 1,000 litres" shown
 * as "EUR per litre") and then the display precision for the shown unit. The
 * sealed and stored value never changes: this only decides what the reveal
 * prints.
 */

import {
  displayRescaleForUnit,
  formatValue,
  rescaleForDisplay,
} from "@/lib/figures";
import { displayPrecisionForUnit } from "./display-precision";

/** A figure value ready to print: the number text and the unit it is shown in. */
export type DisplayFigure = { text: string; unit: string };

/**
 * Format a sealed figure for display.
 *
 * `value` is the decimal string exactly as published. `unit` is the sealed
 * unit. `region` is the figure's region, which picks the number separators.
 */
export function displayFigureValue(
  value: string,
  unit: string,
  region: string,
): DisplayFigure {
  const rescale = displayRescaleForUnit(unit);
  const shownValue =
    rescale === null ? value : rescaleForDisplay(value, rescale.divisor);
  const shownUnit = rescale === null ? unit : rescale.displayUnit;
  const precision =
    displayPrecisionForUnit(shownUnit) ?? fractionDigitsOf(shownValue);
  return {
    text: formatValue(shownValue, region, precision),
    unit: shownUnit,
  };
}

/**
 * The decimals in a canonical decimal string, for a unit with no display
 * precision. Without this, `Intl` rounds to three decimals and a figure would
 * not keep the precision it was published with.
 */
function fractionDigitsOf(value: string): number {
  const point = value.indexOf(".");
  return point === -1 ? 0 : value.length - point - 1;
}
