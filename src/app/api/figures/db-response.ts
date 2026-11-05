// Builds the body of GET /api/figures in database mode (spec 08-judge-polish,
// design "The Figures_API", `db` mode; Property 23, database part).
//
// The read store answers two questions (the SQL is in db-store.ts): the latest
// figure per series, and the newest successful run per metric. This module
// shapes those answers into a FiguresResponseV1 with the same rules file mode
// uses (buildFiguresResponse), so both modes give the same body for the same
// data.
//
// Data integrity (data-integrity.md): nothing is filled, converted or estimated.
// A series with no stored row is listed with `figure: null`.

import { isFixtureFigure } from "@/lib/figures/fixture";
import type { FiguresResponseV1 } from "@/lib/figures/now";
import type { CatalogueSeries, LoadedSeries } from "@/lib/figures/types";
import type { FigureV1 } from "@/lib/seal-format";

import { buildFiguresResponse } from "./build-response";

/** A figures row as the database returns it. `retrieved_at` is a Date. */
export interface StoredFigureRow {
  metric_id: string;
  kind: "official";
  value: string;
  unit: string;
  region: string;
  period: string;
  source: string;
  series_id: string;
  source_url: string;
  retrieved_at: Date;
}

/** The two reads the Figures_API needs. Implemented by db-store.ts and by tests. */
export interface FigureReadStore {
  /**
   * One row per (source, series_id, unit, region): the greatest period, then the
   * newest retrieved_at. Rows for series outside the Catalogue may appear and are
   * ignored.
   */
  latestFigures(): Promise<readonly StoredFigureRow[]>;
  /**
   * metric_id to the newest run_started_at whose outcome is a success. A metric
   * with no success is absent from the map.
   */
  lastSuccessTimes(): Promise<ReadonlyMap<string, Date>>;
}

/** A Date as `YYYY-MM-DDTHH:MM:SSZ`, the second-precision UTC form the figures use. */
export function toUtcSeconds(at: Date): string {
  return at.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function toFigure(row: StoredFigureRow): FigureV1 {
  return {
    kind: "official",
    metric_id: row.metric_id,
    value: row.value,
    unit: row.unit,
    region: row.region,
    period: row.period,
    source: row.source,
    series_id: row.series_id,
    retrieved_at: toUtcSeconds(row.retrieved_at),
    source_url: row.source_url,
  };
}

/**
 * Reads the latest figures and the success times, then shapes the response. The
 * store may reject; the caller decides what to answer (respond.ts answers 500).
 */
export async function buildDbFiguresResponse(
  store: FigureReadStore,
  catalogue: readonly CatalogueSeries[],
  generatedAt: string,
): Promise<FiguresResponseV1> {
  const [rows, successTimes] = await Promise.all([
    store.latestFigures(),
    store.lastSuccessTimes(),
  ]);
  const figures = rows.map(toFigure);

  // A catalogue series owns the rows whose four series fields all match it.
  const series = new Map<string, LoadedSeries>();
  for (const cat of catalogue) {
    const m = cat.metric;
    const owned = figures.filter(
      (f) =>
        f.source === m.source &&
        f.series_id === m.series_id &&
        f.unit === m.unit &&
        f.region === m.region,
    );
    series.set(m.id, { metric: m, period_type: cat.period_type, figures: owned });
  }

  const fetchStatus: Record<string, string> = {};
  for (const [metricId, at] of successTimes) {
    fetchStatus[metricId] = toUtcSeconds(at);
  }

  return buildFiguresResponse({
    loaded: {
      fixture: figures.some((f) => isFixtureFigure(f)),
      series,
    },
    catalogue,
    fetchStatus,
    sourceMode: "db",
    generatedAt,
  });
}
