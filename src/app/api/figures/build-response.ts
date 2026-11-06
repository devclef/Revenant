// Builds the body of GET /api/figures in file mode (spec 08-judge-polish,
// design "The Figures_API"; Property 23, file-mode part).
//
// Pure function: it takes the loaded figures, the catalogue, the parsed
// fetch-status file and the source mode, and returns a FiguresResponseV1. The
// route handler supplies the real inputs; tests supply their own.
//
// Rules:
// - exactly one entry per Catalogue series, in Catalogue order;
// - `figure` is the stored row with the greatest period and, within that
//   period, the newest retrieved_at, or null when the series has no row;
// - `last_success_at` is the fetch-status entry for the series, or null when
//   the status is missing or has no entry. The newest retrieved_at is never
//   used as a stand-in (design, "The Figures_API").

import type { CatalogueSeries, LoadedFigures } from "@/lib/figures/types";
import { periodEnd } from "@/lib/figures/periods";
import type { FiguresResponseV1 } from "@/lib/figures/now";
import type { FigureV1 } from "@/lib/seal-format";

export type FiguresSourceMode = "db" | "file";

/**
 * Reads FIGURES_SOURCE. Only the exact value `file` selects file mode; unset,
 * empty or any other value means `db`, the default (design, "Environment").
 */
export function figuresSourceMode(value: string | undefined): FiguresSourceMode {
  return value === "file" ? "file" : "db";
}

/** The stored row that is "latest" for a series: greatest period, then newest retrieved_at. */
function latestFigure(
  figures: readonly FigureV1[],
  periodType: CatalogueSeries["period_type"],
): FigureV1 | null {
  let best: FigureV1 | null = null;
  for (const fig of figures) {
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

/** The fetch-status entry for one metric ID, or null when there is none. */
function lastSuccessAt(fetchStatus: unknown, metricId: string): string | null {
  if (
    typeof fetchStatus !== "object" ||
    fetchStatus === null ||
    Array.isArray(fetchStatus) ||
    !Object.prototype.hasOwnProperty.call(fetchStatus, metricId)
  ) {
    return null;
  }
  const value = (fetchStatus as Record<string, unknown>)[metricId];
  return typeof value === "string" ? value : null;
}

export interface BuildFiguresResponseInput {
  readonly loaded: LoadedFigures;
  readonly catalogue: readonly CatalogueSeries[];
  /** Parsed fetch-status.json, or null when the file is missing. */
  readonly fetchStatus: unknown | null;
  readonly sourceMode: FiguresSourceMode;
  /** Server UTC time of the response, ISO. */
  readonly generatedAt: string;
}

export function buildFiguresResponse(
  input: BuildFiguresResponseInput,
): FiguresResponseV1 {
  return {
    format: "revenant-figures-v1",
    generated_at: input.generatedAt,
    source_mode: input.sourceMode,
    series: input.catalogue.map((cat) => {
      const loaded = input.loaded.series.get(cat.metric.id);
      const rows = loaded?.figures ?? [];
      return {
        metric: cat.metric,
        period_type: cat.period_type,
        last_success_at: lastSuccessAt(input.fetchStatus, cat.metric.id),
        figure: latestFigure(rows, cat.period_type),
        // File mode never falls back to the bundled file, so this is always false.
        fallback: false,
      };
    }),
  };
}
