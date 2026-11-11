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
// A series with no stored row takes its latest real bundled figure, marked
// `fallback: true`, and only when the bundled file has one. Otherwise it is
// listed with `figure: null`.

import { bundledLatestFigure } from "@/lib/figures/bundled-latest";
import { chooseFigure, type ChosenFigure } from "@/lib/figures/choose";
import { isFixtureFigure } from "@/lib/figures/fixture";
import type { FiguresResponseV1 } from "@/lib/figures/now";
import type { CatalogueSeries, LoadedSeries } from "@/lib/figures/types";
import { figureV1Schema, type FigureV1 } from "@/lib/seal-format";

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
 * The figure a stored row stands for, or null when the row is not a valid figure.
 * A row with a missing or invalid retrieved_at, or any field that fails the
 * figure schema, is not used. Nothing is repaired or filled in.
 */
function rowToFigure(row: StoredFigureRow): FigureV1 | null {
  if (
    !(row.retrieved_at instanceof Date) ||
    Number.isNaN(row.retrieved_at.getTime())
  ) {
    return null;
  }
  const parsed = figureV1Schema.safeParse(toFigure(row));
  return parsed.success ? parsed.data : null;
}

/**
 * Keeps the valid rows. Each invalid row is dropped, and its metric is logged once
 * as `figures_row_skipped metric_id=<id>`. The line carries no value, message or
 * stack, only the metric ID.
 */
function validFigures(rows: readonly StoredFigureRow[]): FigureV1[] {
  const figures: FigureV1[] = [];
  const logged = new Set<string>();
  for (const row of rows) {
    const figure = rowToFigure(row);
    if (figure !== null) {
      figures.push(figure);
      continue;
    }
    const id = typeof row.metric_id === "string" ? row.metric_id : "unknown";
    if (!logged.has(id)) {
      logged.add(id);
      console.error(`figures_row_skipped metric_id=${id}`);
    }
  }
  return figures;
}

/** Re-exported so existing imports from this module keep working. */
export { chooseFigure, type ChosenFigure };

/** The raw answers of the read step, before any shaping. */
export interface DbFigureReads {
  readonly rows: readonly StoredFigureRow[];
  readonly successTimes: ReadonlyMap<string, Date>;
}

/**
 * The read step: latest figures and success times from the store. It only reads.
 * The store may reject; the rejection passes to the caller unchanged.
 */
export async function readDbFigures(store: FigureReadStore): Promise<DbFigureReads> {
  const [rows, successTimes] = await Promise.all([
    store.latestFigures(),
    store.lastSuccessTimes(),
  ]);
  return { rows, successTimes };
}

/**
 * The shape step: builds the FiguresResponseV1 from the read answers. Invalid
 * stored rows are skipped (see validFigures). Each series gets its figure from
 * chooseFigure. last_success_at still comes only from
 * figure_fetch_runs, never from a bundled or stored figure.
 */
export function shapeDbFiguresResponse(
  reads: DbFigureReads,
  catalogue: readonly CatalogueSeries[],
  generatedAt: string,
): FiguresResponseV1 {
  const { rows, successTimes } = reads;
  const figures = validFigures(rows);

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

  const body = buildFiguresResponse({
    loaded: {
      fixture: figures.some((f) => isFixtureFigure(f)),
      series,
    },
    catalogue,
    fetchStatus,
    sourceMode: "db",
    generatedAt,
  });

  return {
    ...body,
    series: body.series.map((entry) => {
      const cat = catalogue.find((c) => c.metric.id === entry.metric.id);
      const bundled =
        entry.figure === null && cat !== undefined ? bundledLatestFigure(cat) : null;
      return { ...entry, ...chooseFigure(entry.figure, bundled) };
    }),
  };
}

/**
 * True when at least one series in the body holds a figure. A figure here may be
 * a stored one or a bundled fallback; the caller does not need to tell them apart.
 */
export function hasAnyBundled(body: FiguresResponseV1): boolean {
  return body.series.some((entry) => entry.figure !== null);
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
  const reads = await readDbFigures(store);
  return shapeDbFiguresResponse(reads, catalogue, generatedAt);
}
