// The figures a visitor can pick on the live Seal_Page (spec 06, design.md
// "Components and Interfaces", catalogue-list.ts; R13.1, R13.7).
//
// Pure module: imports only the figures barrel's pure helpers, so it is safe in
// the browser and in tests.

import {
  isFixtureFigure,
  type LoadedFigures,
  type LoadedSeries,
} from "@/lib/figures";
import type { FiguresResponseV1 } from "@/lib/figures/now";
import type { FiguresState } from "@/components/reveal/figures-api";

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
  /**
   * Set only for a Fallback_Figure (spec 09, A1.8): the figure's real
   * `retrieved_at`, shown with fallbackNote. Absent for every other figure.
   */
  fallbackRetrievedAt?: string;
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

/**
 * The pickable series from a Figures_API body (issue #202). A series whose
 * `figure` is null has no figure to seal, so it is left out. Order is the
 * response's order, which follows the catalogue.
 */
export function listPickableFromResponse(
  response: FiguresResponseV1,
): PickableSeries[] {
  const out: PickableSeries[] = [];

  for (const entry of response.series) {
    const figure = entry.figure;
    if (figure === null) continue;

    out.push({
      metricId: entry.metric.id,
      displayName: entry.metric.display_name,
      unit: entry.metric.unit,
      region: entry.metric.region,
      latestPeriod: figure.period,
      isFixture: isFixtureFigure(figure),
      ...(entry.fallback === true
        ? { fallbackRetrievedAt: figure.retrieved_at }
        : {}),
    });
  }

  return out;
}

/**
 * The figures a Live_Letter is built from, taken from the same Figures_API body
 * the Reveal reads. Each series holds its one figure from the response, so the
 * "then" figure chosen at sealing is the "now" figure the reveal shows later.
 */
export function loadedFiguresFromResponse(
  response: FiguresResponseV1,
): LoadedFigures {
  const series = new Map<string, LoadedSeries>();

  for (const entry of response.series) {
    if (entry.figure === null) continue;
    series.set(entry.metric.id, {
      metric: entry.metric,
      period_type: entry.period_type,
      figures: [entry.figure],
    });
  }

  const fixture = [...series.values()].some((s) =>
    isFixtureFigure(s.figures[0]),
  );
  return { fixture, series };
}

/** What the Seal_Page knows about the figures it can seal with. */
export type SealFigures =
  | {
      status: "ready";
      pickable: PickableSeries[];
      figures: LoadedFigures;
    }
  | { status: "loading" }
  | { status: "failed" };

/**
 * Turns the Figures_API state into what the Seal_Page needs. Only a ready
 * response yields figures. A loading or failed request yields no figures, and
 * there is no bundled fallback, so sealing cannot start without the response.
 */
export function sealFiguresFrom(state: FiguresState): SealFigures {
  if (state.status !== "ready") return { status: state.status };
  return {
    status: "ready",
    pickable: listPickableFromResponse(state.figures),
    figures: loadedFiguresFromResponse(state.figures),
  };
}
