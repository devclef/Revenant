/**
 * Test helper: stubs GET /api/figures with a response built from a loaded
 * figure file, then reads it through the real `loadFigures` client. Tests call
 * `figuresStateFrom(DEMO_FIGURES)` once and pass the result to the reveal, so
 * the expected values stay the same as before the Figures_API existed.
 *
 * The body keeps the latest figure of each series, the same figure
 * `thenAndNow` reported as "now". The stub is injected into `loadFigures`, so no
 * global fetch is touched. Imported by tests only.
 */

import { loadFigures, type FiguresState } from "./figures-api";
import type { FiguresResponseV1 } from "@/lib/figures/now";
import type { LoadedFigures } from "@/lib/figures/types";

/** The `revenant-figures-v1` body for every series in `loaded`. */
export function figuresResponseFrom(loaded: LoadedFigures): FiguresResponseV1 {
  const series = [...loaded.series.values()].map((entry) => ({
    metric: { ...entry.metric },
    period_type: entry.period_type,
    last_success_at: null,
    figure:
      entry.figures.length === 0
        ? null
        : { ...entry.figures[entry.figures.length - 1] },
  }));
  return {
    format: "revenant-figures-v1",
    generated_at: "2026-10-27T00:00:00Z",
    source_mode: "file",
    series,
  } as FiguresResponseV1;
}

/** A fetch stub that answers every call with `body` as JSON, status 200. */
export function stubFiguresFetch(body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

/** The Figures_API state a reveal would hold after its request succeeded. */
export function figuresStateFrom(loaded: LoadedFigures): Promise<FiguresState> {
  return loadFigures(stubFiguresFetch(figuresResponseFrom(loaded)));
}
