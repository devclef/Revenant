// Test-only helpers for the live Seal_Page figure tests. Not used by the app.
//
// Builds LoadedFigures directly, so tests control every period and value. The
// figures are shaped like real official figures (https source_url, schema-valid
// value strings). The fixture metrics use the FIXTURE source prefix, so they
// are labelled as fixture data, as they would be on the page.

import type { FigureV1, MetricDefinitionV1 } from "@/lib/seal-format";
import { CATALOGUE, type LoadedFigures, type LoadedSeries } from "@/lib/figures";

export const FIXTURE_SOURCE = "FIXTURE weekly retail price (fake data)";

/** A fixture metric with the same id shape as the real series. */
export function fixtureMetric(id: string): MetricDefinitionV1 {
  return {
    id,
    display_name: `Fixture series ${id} (fake data)`,
    unit: "USD per gallon",
    region: "U.S.",
    source: FIXTURE_SOURCE,
    series_id: `FIXTURE-${id.toUpperCase()}`,
  };
}

/** The catalogue metric for a real series id. Throws if the id is unknown. */
export function catalogueMetric(id: string): MetricDefinitionV1 {
  const found = CATALOGUE.find((s) => s.metric.id === id);
  if (found === undefined) throw new Error(`no catalogue metric ${id}`);
  return found.metric;
}

/** One official figure for a metric at a weekly period. */
export function figureFor(
  metric: MetricDefinitionV1,
  period: string,
  value: string,
): FigureV1 {
  return {
    kind: "official",
    metric_id: metric.id,
    value,
    unit: metric.unit,
    region: metric.region,
    period,
    source: metric.source,
    series_id: metric.series_id,
    retrieved_at: "2026-10-30T14:02:11Z",
    source_url: "https://example.invalid/figure-source",
  };
}

export interface SeriesInput {
  metric: MetricDefinitionV1;
  figures: { period: string; value: string }[];
}

/**
 * Build LoadedFigures from plain series inputs. Series keep the order given
 * (catalogue order in the app); each series' figures are sorted oldest first,
 * as the loader does. Weekly periods are "YYYY-MM-DD" and sort as strings.
 */
export function makeFigures(entries: readonly SeriesInput[]): LoadedFigures {
  const series = new Map<string, LoadedSeries>();
  for (const entry of entries) {
    const figures = [...entry.figures]
      .sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0))
      .map((f) => figureFor(entry.metric, f.period, f.value));
    series.set(entry.metric.id, {
      metric: entry.metric,
      period_type: "weekly",
      figures,
    });
  }
  return { fixture: false, series };
}
