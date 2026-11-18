// Short forms of the units the receipt rows show on the Write desk (spec 14,
// W10). The full unit stays in each row's accessible name (figureRowName) and
// is never replaced in the data. Units not listed here are shown as they are.
//
// Keys are the catalogue's published units and display_rescale units
// (src/lib/figures/catalogue.ts). Pure module: safe in the browser and in tests.

const SHORT_UNITS: ReadonlyMap<string, string> = new Map([
  ["USD per gallon", "USD/gal"],
  ["EUR per 1,000 litres", "EUR/1,000 L"],
  ["EUR per litre", "EUR/L"],
]);

/** The short form of a unit for a receipt row, or the unit itself when none is listed. */
export function shortUnit(unit: string): string {
  return SHORT_UNITS.get(unit) ?? unit;
}
