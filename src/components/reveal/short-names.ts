/**
 * Short everyday names for receipts (P5.4, P5.5, P5.7).
 *
 * Keyed by the sealed metric_id, and the names are literal. The lookup never
 * reads the Catalogue at runtime, so a letter still shows a readable name when
 * a series is removed from the catalogue. An unknown metric_id falls back to
 * the display_name written into the sealed letter.
 *
 * Names contain no direction word, so the reveal never reads a change into a
 * name.
 */

const SHORT_NAMES: ReadonlyMap<string, string> = new Map([
  ["us-gasoline-regular", "Regular gasoline"],
  ["us-diesel", "Diesel"],
  ["eu-petrol-euro95", "Unleaded petrol"],
  ["eu-diesel", "Diesel"],
]);

/**
 * The short name for a metric_id, or the sealed display_name when the id has
 * no short name.
 */
export function shortNameFor(metricId: string, sealedDisplayName: string): string {
  return SHORT_NAMES.get(metricId) ?? sealedDisplayName;
}

/** The literal short names, for tests and review. */
export const SHORT_NAME_TABLE: ReadonlyMap<string, string> = SHORT_NAMES;
