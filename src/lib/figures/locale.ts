// Locale selection for figure display (spec 03-persona-demo).
//
// Maps a figure's region to a BCP 47 locale used by Intl.NumberFormat and
// Intl.DateTimeFormat when rendering values and periods. The UI is English
// only (see tech.md): the "U.S." region formats with US conventions, and
// every other region falls back to a region-neutral English locale so the
// text, month names and separators stay English.
//
// EU and Sweden gain their own entries in the real-data spec; until then they
// fall through to the "en" default by design.
//
// Pure module: no imports, and nothing from src/lib/crypto, src/lib/db or
// Node built-ins.

/**
 * The BCP 47 locale to format a figure's values and periods with.
 *
 * `"U.S."` returns `"en-US"`; every other region returns `"en"`, keeping the
 * UI English regardless of the figure's region.
 */
export function localeForRegion(region: string): string {
  return region === "U.S." ? "en-US" : "en";
}
