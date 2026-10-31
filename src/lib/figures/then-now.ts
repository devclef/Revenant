// Then-and-now lookup for the figures model (spec 02-demo-figures).
//
// Given a metric id, a reference date and a loaded figure file, this returns
// the figure that was current at or before the date ("then") and the latest
// figure in the series ("now"). It never invents, copies, rounds, rescales,
// interpolates, averages or computes across figures: the returned figures are
// the exact frozen references held in `data` (data-integrity.md). A gap is
// reported as a gap, never filled.
//
// Pure module: imports only sibling period helpers and types, nothing from
// src/lib/crypto, src/lib/db or Node built-ins, so it is safe in the browser
// and on the server.

import { isRealDate, periodEnd } from "./periods";
import type { LoadedFigures, ThenNow, Found, Missing } from "./types";

/**
 * Find the "then" and "now" figures for one series at a reference date.
 *
 * @param metricId the series (metric) id to look up.
 * @param date     the reference date as a real "YYYY-MM-DD" calendar date.
 * @param data     a loaded, frozen figure file.
 * @returns        `{ then, now }`, each either a found frozen figure or a
 *                 reason it is missing.
 * @throws {RangeError} if `date` is not a real calendar date.
 */
export function thenAndNow(
  metricId: string,
  date: string,
  data: LoadedFigures,
): ThenNow {
  // (1) The date must be a real calendar date (R6.8).
  if (!isRealDate(date)) {
    throw new RangeError(
      "date must be a real calendar date in the form YYYY-MM-DD",
    );
  }

  // (2) Unknown series: both results are unknown_series (R6.5).
  const series = data.series.get(metricId);
  if (series === undefined) {
    const missing: Missing = { found: false, reason: "unknown_series" };
    return { then: missing, now: missing };
  }

  // (3) Series with no figures: both results are no_figures (R6.6).
  const figures = series.figures;
  if (figures.length === 0) {
    const missing: Missing = { found: false, reason: "no_figures" };
    return { then: missing, now: missing };
  }

  // (4) "now" is the last element of the already-sorted figures: the maximum
  //     period end (R6.3). The exact frozen reference is returned.
  const now: Found = { found: true, figure: figures[figures.length - 1] };

  // (5) "then" is the last figure whose period end is <= date, else
  //     none_at_or_before_date (R6.2, R6.7). Figures are sorted oldest first,
  //     so walk from the end and take the first that qualifies.
  let then: Found | Missing = {
    found: false,
    reason: "none_at_or_before_date",
  };
  for (let i = figures.length - 1; i >= 0; i--) {
    const figure = figures[i];
    if (periodEnd(figure.period, series.period_type) <= date) {
      then = { found: true, figure };
      break;
    }
  }

  return { then, now };
}
