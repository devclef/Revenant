// Per-series validation for one freshly-downloaded series (spec 08-judge-polish,
// task 2; design.md "The daily figure fetch", step 2). The prefetch and the
// Fetch_Job (task 16) both call it, so one rule set decides whether a series'
// result may be stored at all.
//
// A series fails as a whole: when any check fails, none of its points are
// stored. Pure module. It imports only the Catalogue and period helpers from
// `@/lib/figures` and the FreshSeries type. It reads no file and no network.
//
// Data integrity (data-integrity.md): nothing is repaired or filled. A failing
// series is reported with a fixed reason token and its points are dropped.

import { CATALOGUE, isRealDate, isRealMonth } from "@/lib/figures";

import type { FreshSeries } from "./refresh";

/** Result of validating one series. `reason` is a fixed token, never a value. */
export type SeriesValidation = { ok: true } | { ok: false; reason: string };

const RETRIEVED_AT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/**
 * Check one fresh series against the Catalogue. The checks, in order, and the
 * reason token each produces:
 *
 *  - unknown metric id                → `unknown series`
 *  - missing provenance on the series  → `malformed <field>` (`retrieved_at`,
 *    `source_url`, or a Catalogue field such as `source`)
 *  - zero points                      → `empty`
 *  - period not matching the series' `period_type` (weekly `YYYY-MM-DD` as a
 *    real date; monthly `YYYY-MM` as a real month) → `malformed period`
 *  - two points with the same period   → `duplicate period`
 *  - value empty or not a finite number → `malformed value`
 *
 * Periods are checked before duplicates, and values after both, so the first
 * failing point in ascending order decides the reason.
 */
export function validateFreshSeries(series: FreshSeries): SeriesValidation {
  const entry = CATALOGUE.find((s) => s.metric.id === series.metricId);
  if (entry === undefined) return { ok: false, reason: "unknown series" };

  const metric = entry.metric;
  const provenance: [string, string][] = [
    ["source", metric.source],
    ["series_id", metric.series_id],
    ["unit", metric.unit],
    ["region", metric.region],
    ["retrieved_at", series.downloadedAt],
    ["source_url", series.sourceUrl],
  ];
  for (const [field, text] of provenance) {
    if (typeof text !== "string" || text.trim() === "") {
      return { ok: false, reason: `malformed ${field}` };
    }
  }
  if (!RETRIEVED_AT_PATTERN.test(series.downloadedAt)) {
    return { ok: false, reason: "malformed retrieved_at" };
  }

  if (series.points.length === 0) return { ok: false, reason: "empty" };

  const periodOk = (period: string): boolean =>
    entry.period_type === "weekly"
      ? isRealDate(period)
      : isRealMonth(period);

  const seen = new Set<string>();
  for (const point of series.points) {
    if (typeof point.period !== "string" || !periodOk(point.period)) {
      return { ok: false, reason: "malformed period" };
    }
    if (seen.has(point.period)) {
      return { ok: false, reason: "duplicate period" };
    }
    seen.add(point.period);
  }

  for (const point of series.points) {
    if (
      typeof point.value !== "string" ||
      point.value.trim() === "" ||
      !Number.isFinite(Number(point.value))
    ) {
      return { ok: false, reason: "malformed value" };
    }
  }

  return { ok: true };
}
