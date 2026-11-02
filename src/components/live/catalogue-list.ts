// The figures a visitor can pick on the live Seal_Page (spec 06, design.md
// "Components and Interfaces", catalogue-list.ts; R13.1, R13.7).
//
// Pure module: imports only the figures barrel's pure helpers, so it is safe in
// the browser and in tests.

import { isFixtureFigure, type LoadedFigures } from "@/lib/figures";

/** One series the visitor can pick, with the fields the picker shows. */
export interface PickableSeries {
  metricId: string;
  displayName: string;
  unit: string;
  region: string;
  /** The period of the latest figure, shown as "Latest period: {period}". */
  latestPeriod: string;
  /** True when the latest figure is fixture data (labelled "fixture data"). */
  isFixture: boolean;
}

/**
 * List the series a visitor can pick, in catalogue order.
 *
 * Only series with at least one figure are included. The list never sorts by
 * movement: the order comes from the loaded figures alone (R13.7), so picking
 * cannot be steered by which way a figure moved. `isFixture` is read from the
 * latest figure of each series.
 */
export function listPickableSeries(figures: LoadedFigures): PickableSeries[] {
  const out: PickableSeries[] = [];

  for (const [metricId, series] of figures.series) {
    const latest = series.figures[series.figures.length - 1];
    if (latest === undefined) continue;

    out.push({
      metricId,
      displayName: series.metric.display_name,
      unit: series.metric.unit,
      region: series.metric.region,
      latestPeriod: latest.period,
      isFixture: isFixtureFigure(latest),
    });
  }

  return out;
}
