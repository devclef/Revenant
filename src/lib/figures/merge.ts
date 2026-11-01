// Merge two loaded figure sets (spec 04-real-figures, R9).
//
// mergeLoadedFigures combines two LoadedFigures into one Merged_Set. Series
// objects are reused as they are: the merged map holds the same frozen
// LoadedSeries instances the inputs hold, never copies.
//
// Pure module: imports only the loader's error type and figures types. Nothing
// from src/lib/crypto, src/lib/db or Node built-ins, no network.

import { FigureDataError } from "./load";
import type { LoadedFigures, LoadedSeries } from "./types";

/**
 * Merge two loaded figure sets into one frozen LoadedFigures.
 *
 * A metric ID present in both sets is allowed only when both sides hold the
 * same catalogue metric object and at most one side has figures. In that case
 * the merged map keeps the side that has figures (or `a` when neither does).
 * Any other duplicate throws FigureDataError("duplicate_metric_id",
 * "merged.series.<id>").
 *
 * Series order: every series from `a` in its order, then each series from `b`
 * that `a` does not already hold.
 *
 * The result's `fixture` flag is `a.fixture || b.fixture`. A Merged_Set is
 * fixture (R9.3) as soon as any input it was built from is fixture, so a
 * fixture figure can never be presented as real data just because it was
 * merged with real data. The flag says that some of the figures may be
 * fixture data, and each figure keeps its own FIXTURE-prefixed metric and
 * source, so the UI can still label them one by one.
 */
export function mergeLoadedFigures(
  a: LoadedFigures,
  b: LoadedFigures,
): LoadedFigures {
  const series = new Map<string, LoadedSeries>();

  for (const [id, seriesA] of a.series) {
    series.set(id, seriesA);
  }

  for (const [id, seriesB] of b.series) {
    const seriesA = series.get(id);
    if (seriesA === undefined) {
      series.set(id, seriesB);
      continue;
    }

    const sameMetric = seriesA.metric === seriesB.metric;
    const atMostOneHasFigures =
      seriesA.figures.length === 0 || seriesB.figures.length === 0;
    if (!sameMetric || !atMostOneHasFigures) {
      throw new FigureDataError("duplicate_metric_id", `merged.series.${id}`);
    }

    // Shared and allowed: keep the side that has figures, or `a` if neither.
    if (seriesA.figures.length === 0 && seriesB.figures.length > 0) {
      series.set(id, seriesB);
    }
  }

  const merged: LoadedFigures = {
    fixture: a.fixture || b.fixture,
    series,
  };

  // Freeze like a loaded file: the result, and the map so entries cannot be
  // added or removed. Each LoadedSeries is already deep-frozen by the loader.
  Object.freeze(merged);
  Object.freeze(series);

  return merged;
}
