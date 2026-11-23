// Persona "now" figures for the week of the opening date (spec 15-the-flow,
// design section 4).
//
// figureAtOpening returns the latest figure at or before the date part of
// `opensAt` for one metric. personaNowResponse builds a FiguresResponseV1 for a
// persona, so the reveal's pickNow runs unchanged. Both return the frozen
// figures held in `data` with their provenance. Neither converts, rounds,
// interpolates or fills a gap (data-integrity.md). A gap stays a gap, with its
// reason.
//
// Pure module: imports nothing from src/lib/crypto, src/lib/db or Node
// built-ins, so it is safe in the browser and on the server.

import { CATALOGUE } from "./catalogue";
import type { FiguresResponseV1 } from "./now";
import { thenAndNow } from "./then-now";
import type { Found, LoadedFigures, Missing } from "./types";

/** The part of a persona that the "now" figures need. */
export interface PersonaForNow {
  opens_at: string; // ISO instant at 00:00 UTC, form "YYYY-MM-DDT00:00:00.000Z"
  metrics: readonly { metric_id: string }[];
}

/**
 * The latest figure for `metricId` at or before the date part of `opensAt`.
 * `opensAt` is an ISO instant at 00:00 UTC; only its date part is used.
 *
 * @returns the frozen figure with its provenance, or a gap with its reason.
 */
export function figureAtOpening(
  metricId: string,
  opensAt: string,
  data: LoadedFigures,
): Found | Missing {
  const date = opensAt.slice(0, 10);
  return thenAndNow(metricId, date, data).then;
}

/**
 * The Figures_API body for a persona's "now" figures, one series entry per
 * persona metric. A series with no figure at the opening date holds
 * `figure: null`, which pickNow reports as `no_figure`.
 */
export function personaNowResponse(
  persona: PersonaForNow,
  data: LoadedFigures,
  generatedAt: string,
): FiguresResponseV1 {
  const series = persona.metrics.map((m) => {
    const cat = CATALOGUE.find((c) => c.metric.id === m.metric_id);
    if (cat === undefined) {
      throw new RangeError(`unknown persona metric: ${m.metric_id}`);
    }
    const result = figureAtOpening(m.metric_id, persona.opens_at, data);
    return {
      metric: cat.metric,
      period_type: cat.period_type,
      last_success_at: null,
      figure: result.found ? result.figure : null,
      fallback: false,
    };
  });
  return {
    format: "revenant-figures-v1",
    generated_at: generatedAt,
    source_mode: "file",
    series,
  };
}
