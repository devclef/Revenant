/**
 * Display precision for receipts (P5.1).
 *
 * Fuel prices are shown to two decimal places. Every other unit keeps the
 * precision it was published with. The stored value never changes: this only
 * decides how many decimals the reveal shows.
 */

export const DISPLAY_PRECISION_FUEL = 2;

/**
 * Units shown at fuel precision, keyed by the unit as the reveal displays it
 * (after any Display_Rescale). EU prices published per 1,000 litres are shown
 * per litre, so the displayed unit is what counts here.
 */
const FUEL_DISPLAY_UNITS: ReadonlySet<string> = new Set([
  "USD per gallon",
  "EUR per litre",
]);

/**
 * The number of decimals to show for a figure in this unit, or `undefined`
 * when the figure keeps its published precision.
 */
export function displayPrecisionForUnit(unit: string): number | undefined {
  return FUEL_DISPLAY_UNITS.has(unit) ? DISPLAY_PRECISION_FUEL : undefined;
}
