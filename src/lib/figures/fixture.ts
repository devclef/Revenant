// Fixture predicates for the figures model (spec 02-demo-figures).
//
// Fixture data (source or series_id starting with FIXTURE) may appear on the
// demo site, but only with a visible "fixture data" label next to each figure
// until real data replaces it (data-integrity.md). These predicates let the UI
// and loader tell fixture figures and metrics apart from real ones.
//
// Pure module: no runtime dependencies, safe in the browser and on the server.

import type { FigureV1, MetricDefinitionV1 } from "@/lib/seal-format";

export const FIXTURE_PREFIX = "FIXTURE";

// True when the figure's source or series_id starts with FIXTURE (case-sensitive).
export function isFixtureFigure(
  f: Pick<FigureV1, "source" | "series_id">,
): boolean {
  return (
    f.source.startsWith(FIXTURE_PREFIX) || f.series_id.startsWith(FIXTURE_PREFIX)
  );
}

// True when the metric's source or series_id starts with FIXTURE (case-sensitive).
export function isFixtureMetric(
  m: Pick<MetricDefinitionV1, "source" | "series_id">,
): boolean {
  return (
    m.source.startsWith(FIXTURE_PREFIX) || m.series_id.startsWith(FIXTURE_PREFIX)
  );
}
