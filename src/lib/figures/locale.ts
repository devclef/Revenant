// Locale selection for figure number formatting (spec 03-persona-demo).
//
// Maps a figure's region to a BCP 47 locale used by Intl.NumberFormat when
// rendering values. The UI is English only (see tech.md), so every locale here
// is an English locale. The locale changes only the number formatter's
// conventions (for example the currency and grouping style). It never changes
// the stored value, which stays at full published precision, and it never
// affects period formatting, which is handled by formatPeriod.
//
// The "U.S." region formats with US conventions. The "EU27, weighted average"
// region formats with Irish English. Every other region falls back to en-GB.
//
// Pure module: no imports, and nothing from src/lib/crypto, src/lib/db or
// Node built-ins.

/**
 * The BCP 47 locale to format a figure's values with.
 *
 * `"U.S."` returns `"en-US"`, `"EU27, weighted average"` returns `"en-IE"`,
 * and every other region returns `"en-GB"`.
 */
export function localeForRegion(region: string): string {
  if (region === "U.S.") {
    return "en-US";
  }
  if (region === "EU27, weighted average") {
    return "en-IE";
  }
  return "en-GB";
}
