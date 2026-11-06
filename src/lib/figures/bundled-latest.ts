// The bundled fallback figures for the Figures_API (spec 08-judge-polish,
// Fallback_Refresh). When the database has no figure for a Catalogue series,
// the API may answer with the latest real figure from the committed
// fuel-figures.json instead, marked `fallback: true`.
//
// The bundled file is validated with the same loader the app uses, so every
// figure keeps its full provenance (value, unit, region, period, source,
// series_id, source_url, retrieved_at) copied field for field. A Fixture_Figure
// is never returned as a fallback (data-integrity.md).
//
// Pure module apart from the JSON import: no network, no database. Safe in the
// browser and on the server.

import fuelFigures from "./real/fuel-figures.json";

import { CATALOGUE } from "./catalogue";
import { isFixtureFigure } from "./fixture";
import { loadFigureFile } from "./load";
import { periodEnd } from "./periods";
import type { CatalogueSeries } from "./types";
import type { FigureV1 } from "@/lib/seal-format";

// Loaded once at module start. A file that breaks the loader rules throws here,
// which fails the build or test rather than serving bad data.
const LOADED = loadFigureFile(fuelFigures, CATALOGUE);

/**
 * The latest non-fixture figure in a series: the greatest period, then the
 * newest retrieved_at within that period. Same rule as the Figures_API.
 */
function latestRealFigure(
  figures: readonly FigureV1[],
  periodType: CatalogueSeries["period_type"],
): FigureV1 | null {
  let best: FigureV1 | null = null;
  for (const fig of figures) {
    if (isFixtureFigure(fig)) continue;
    if (best === null) {
      best = fig;
      continue;
    }
    const endFig = periodEnd(fig.period, periodType);
    const endBest = periodEnd(best.period, periodType);
    if (endFig !== endBest) {
      if (endFig > endBest) best = fig;
      continue;
    }
    const atFig = fig.kind === "official" ? fig.retrieved_at : "";
    const atBest = best.kind === "official" ? best.retrieved_at : "";
    if (atFig > atBest) best = fig;
  }
  return best;
}

/**
 * The latest real bundled figure for one Catalogue series, or null when the
 * bundled file holds no non-fixture figure for it. Returns a copy, so callers
 * cannot change the frozen bundled data.
 */
export function bundledLatestFigure(series: CatalogueSeries): FigureV1 | null {
  const loaded = LOADED.series.get(series.metric.id);
  const figure = latestRealFigure(loaded?.figures ?? [], series.period_type);
  return figure === null ? null : { ...figure };
}
