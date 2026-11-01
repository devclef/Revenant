// Append-only refresh logic for the real figures file (spec 04-real-figures,
// task 4). This is a pure dev-side module: it takes the figures already on disk
// and the freshly-downloaded series, and decides which periods are new, which
// are revisions to leave untouched, which are gaps, and which would be a
// backfill that fails the run. It serialises the merged file deterministically.
//
// Pure module. It imports only `@/lib/figures` (CATALOGUE, loadFigureFile),
// the sealed-letter figure type from `@/lib/seal-format`, and the SourceFigure
// type from `./types`. It performs no network request and never touches
// `node:fs`: reading and writing the file is the caller's job (the script
// entry in task 5). Nothing here depends on the browser or the server runtime.
//
// Data integrity (data-integrity.md, neutrality.md): existing figures are
// carried through exactly as parsed — their `value` and `retrieved_at` are
// never recomputed. No number is invented, estimated or filled. The report
// wording states only what happened to each period and never says a value
// rose, fell, improved, worsened, corrected or revised.

import { CATALOGUE, loadFigureFile } from "@/lib/figures";
import type { FigureV1 } from "@/lib/seal-format";

import type { SourceFigure } from "./types";

// Reference loadFigureFile so the import is used before `serialiseFigureFile`
// (task 4) is implemented. `mergeRefresh` below uses CATALOGUE directly.
void loadFigureFile;

// --- Types -------------------------------------------------------------------

/**
 * One series as freshly downloaded: its catalogue metric id, the points read
 * from the source (ascending by `period`), the UTC time the file it came from
 * was downloaded (`YYYY-MM-DDTHH:MM:SSZ`), and the series' reference URL.
 */
export interface FreshSeries {
  metricId: string;
  points: SourceFigure[];
  downloadedAt: string;
  sourceUrl: string;
}

/**
 * What a merge did, for printing and for tests. Every list is in catalogue
 * order, then `period` ascending. `perSeries` has one entry per catalogue
 * series that produced at least one added figure; `first`/`last` are the
 * earliest and latest added periods for that series.
 */
export interface Report {
  perSeries: {
    metricId: string;
    kept: number;
    added: number;
    first: string;
    last: string;
  }[];
  gaps: { metricId: string; period: string; reason: string }[];
  revisions: {
    metricId: string;
    period: string;
    committed: string;
    source: string;
  }[];
  missingFromSource: { metricId: string; period: string }[];
  backfills: { metricId: string; period: string; latest: string }[];
}

/**
 * The outcome of a merge. `ok: false` is returned only when a backfill was
 * detected (`report.backfills` is non-empty): in that case no figures are
 * returned at all, not even the later periods. Otherwise `ok: true` carries
 * every existing figure unchanged plus the added ones.
 */
export type MergeResult =
  | { ok: true; figures: FigureV1[]; report: Report }
  | { ok: false; report: Report };

// --- Report wording ----------------------------------------------------------

/**
 * One report line to format, as a discriminated union on `kind`. Each shape
 * matches an item in {@link Report}; `added` carries the `perSeries` counts.
 */
export type ReportLine =
  | {
      kind: "revision";
      metricId: string;
      period: string;
      committed: string;
      source: string;
    }
  | { kind: "backfill"; metricId: string; period: string; latest: string }
  | {
      kind: "added";
      metricId: string;
      added: number;
      first: string;
      last: string;
    }
  | { kind: "gap"; metricId: string; period: string; reason: string }
  | { kind: "missing-from-source"; metricId: string; period: string };

/**
 * Produce the one fixed line form for a report item (design.md "Report
 * wording"). The text is neutral: it states what happened to a period and
 * never says a value rose, fell, improved, worsened, corrected or revised.
 *
 *   revision <metricId> <period> committed <committed> source now shows <source>
 *   backfill <metricId> <period> latest <latest>
 *   added <metricId> <added> first <first> last <last>
 *   gap <metricId> <period> <reason>
 *   missing-from-source <metricId> <period>
 */
export function formatReportLine(line: ReportLine): string {
  switch (line.kind) {
    case "revision":
      return `revision ${line.metricId} ${line.period} committed ${line.committed} source now shows ${line.source}`;
    case "backfill":
      return `backfill ${line.metricId} ${line.period} latest ${line.latest}`;
    case "added":
      return `added ${line.metricId} ${line.added} first ${line.first} last ${line.last}`;
    case "gap":
      return `gap ${line.metricId} ${line.period} ${line.reason}`;
    case "missing-from-source":
      return `missing-from-source ${line.metricId} ${line.period}`;
  }
}

// --- Merge and serialise (implemented in tasks 3 and 4) ----------------------

/**
 * Merge freshly-downloaded series into the existing figures, append-only, with
 * backfill refusal (design.md "Append-only merge with backfill refusal", D5).
 *
 * The catalogue is walked in its own order; for each series its existing
 * figures and the matching fresh series are reconciled:
 *
 *  - A fresh point whose `metric_id|period` key already exists is a revision
 *    when its value differs; the existing figure is reported and kept exactly
 *    as parsed — its `value` and `retrieved_at` are never recomputed.
 *  - A fresh point earlier than the series' latest existing period is a
 *    backfill: it is reported with that latest period, and nothing is added.
 *  - Otherwise the fresh point is added as a new official figure built from the
 *    catalogue metric and the fresh series' `downloadedAt` / `sourceUrl`.
 *  - An existing figure with no matching fresh point is reported as
 *    missing-from-source and kept.
 *
 * If any backfill was reported the run fails: `{ ok: false, report }` is
 * returned and no figure at all is produced, not even later periods. Otherwise
 * every existing figure is carried through unchanged plus the added ones.
 *
 * Period comparison is a plain string comparison of the `YYYY-MM-DD` form, the
 * same order `loadFigureFile` sorts weekly series by.
 */
export function mergeRefresh(
  existing: readonly FigureV1[],
  fresh: readonly FreshSeries[],
): MergeResult {
  const key = (metricId: string, period: string): string =>
    `${metricId}|${period}`;

  // Index existing figures by key so revision and missing-from-source checks
  // are O(1), and keep them grouped per metric for the per-series pass.
  const existingByKey = new Map<string, FigureV1>();
  const existingByMetric = new Map<string, FigureV1[]>();
  for (const fig of existing) {
    existingByKey.set(key(fig.metric_id, fig.period), fig);
    const group = existingByMetric.get(fig.metric_id);
    if (group) group.push(fig);
    else existingByMetric.set(fig.metric_id, [fig]);
  }

  // Index the fresh series by metric id. A catalogue series with no fresh
  // series simply has no new points.
  const freshByMetric = new Map<string, FreshSeries>();
  for (const series of fresh) freshByMetric.set(series.metricId, series);

  const report: Report = {
    perSeries: [],
    gaps: [],
    revisions: [],
    missingFromSource: [],
    backfills: [],
  };

  const added: FigureV1[] = [];

  for (const series of CATALOGUE) {
    const metricId = series.metric.id;
    const existingGroup = existingByMetric.get(metricId) ?? [];
    const freshSeries = freshByMetric.get(metricId);

    // The greatest existing period for this series, or none. String compare of
    // YYYY-MM-DD, matching loadFigureFile's weekly ordering.
    let latest: string | null = null;
    for (const fig of existingGroup) {
      if (latest === null || fig.period > latest) latest = fig.period;
    }

    // Which periods the fresh series actually carries, so existing figures
    // absent from it can be reported missing-from-source.
    const freshPeriods = new Set<string>();

    // The added periods for this series, for the per-series summary. Fresh
    // points are ascending by `period` (the adapters sort them), so the first
    // and last added keep that order.
    let seriesFirstAdded: string | null = null;
    let seriesLastAdded: string | null = null;
    let seriesAddedCount = 0;

    if (freshSeries) {
      for (const point of freshSeries.points) {
        freshPeriods.add(point.period);
        const existingFig = existingByKey.get(key(metricId, point.period));

        if (existingFig) {
          // Present already: a revision only when the value differs. Keep the
          // existing figure untouched either way.
          if (existingFig.value !== point.value) {
            report.revisions.push({
              metricId,
              period: point.period,
              committed: existingFig.value,
              source: point.value,
            });
          }
          continue;
        }

        if (latest !== null && point.period < latest) {
          // Earlier than the latest existing period: a backfill. Report it and
          // add nothing.
          report.backfills.push({ metricId, period: point.period, latest });
          continue;
        }

        // A genuinely new period at or after `latest` (or the first run, where
        // `latest` is none): add it as an official figure built from the
        // catalogue metric and the fresh series' download provenance.
        added.push({
          kind: "official",
          metric_id: metricId,
          value: point.value,
          unit: series.metric.unit,
          region: series.metric.region,
          period: point.period,
          source: series.metric.source,
          series_id: series.metric.series_id,
          retrieved_at: freshSeries.downloadedAt,
          source_url: freshSeries.sourceUrl,
        });
        seriesAddedCount += 1;
        if (seriesFirstAdded === null) seriesFirstAdded = point.period;
        seriesLastAdded = point.period;
      }
    }

    // Existing figures with no matching fresh point are missing-from-source.
    // A period present in `existing` whose fresh point was a gap (never in
    // `freshSeries.points`) falls here, not under revision.
    for (const fig of existingGroup) {
      if (!freshPeriods.has(fig.period)) {
        report.missingFromSource.push({ metricId, period: fig.period });
      }
    }

    if (seriesAddedCount > 0) {
      report.perSeries.push({
        metricId,
        kept: existingGroup.length,
        added: seriesAddedCount,
        first: seriesFirstAdded as string,
        last: seriesLastAdded as string,
      });
    }
  }

  // A backfill fails the whole run: nothing is written, not even later periods.
  if (report.backfills.length > 0) {
    return { ok: false, report };
  }

  // Every existing figure is carried through exactly as parsed, plus the added
  // ones. Serialisation (task 4) imposes the final catalogue/period order.
  const figures: FigureV1[] = [...existing, ...added];
  return { ok: true, figures, report };
}

/**
 * Serialise figures to the deterministic figure-file layout and key order.
 * Implemented in task 4 (see design.md "Deterministic serialisation").
 */
export function serialiseFigureFile(figures: readonly FigureV1[]): string {
  void figures;
  throw new Error("serialiseFigureFile is not implemented yet");
}
