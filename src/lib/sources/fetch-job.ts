// The Fetch_Job core (spec 08-judge-polish, task 16; design.md "The daily figure
// fetch"). `runFetchJob` asks every Catalogue series for its figures once, checks
// each result whole, writes each series in its own transaction, records one run
// row per series and returns the exit status.
//
// Pure module: it reads no environment variable, logs nothing itself (the caller
// passes `log`), and imports no database client. The Postgres store, the adapter
// wiring and the script entry live outside this file. A series' adapter is
// injected, so tests drive every outcome with stubs and an in-memory store.
//
// Data integrity (data-integrity.md): a result that fails validation stores
// nothing; no value is filled, converted or substituted. Stored rows carry the
// adapter's own value strings and the catalogue's provenance, unchanged.

import { CATALOGUE } from "@/lib/figures";
import type { FigureFile } from "@/lib/figures/types";

import { SourceError } from "./errors";
import type { FreshSeries } from "./refresh";
import { validateFreshSeries } from "./validate";

/** How long one series may take before the job abandons it (R20.6). */
export const FETCH_TIMEOUT_MS = 30_000;

type CatalogueMetric = (typeof CATALOGUE)[number]["metric"];

/**
 * One stored figure, with the eight R20.3 provenance fields. `retrievedAt` is
 * the UTC download time, `YYYY-MM-DDTHH:MM:SSZ`.
 */
export interface FigureRow {
  metricId: string;
  kind: "official";
  value: string;
  unit: string;
  region: string;
  period: string;
  source: string;
  seriesId: string;
  sourceUrl: string;
  retrievedAt: string;
}

/** One `figure_fetch_runs` row: a series' outcome in one run. */
export interface RunRow {
  runStartedAt: Date;
  metricId: string;
  outcome: "stored" | "no_new_period" | "failed";
  added: number;
  revisions: number;
  reason: string;
}

/**
 * The storage the job writes to. The Postgres implementation runs each
 * `insertIfChanged` call in one transaction under `pg_advisory_xact_lock` for
 * the series, and inserts a row only when its value differs from the
 * newest-`retrieved_at` row for the same series and period. The job itself
 * never updates or deletes.
 */
export interface FigureStore {
  /** Number of rows in `figures`. A failure here means the database is unreachable. */
  count(): Promise<number>;
  /** Writes the rows of one series in one transaction. Returns how many were inserted and how many of those were Revision_Rows. */
  insertIfChanged(
    rows: readonly FigureRow[],
  ): Promise<{ inserted: number; revisions: number }>;
  /** Appends run rows. */
  recordRun(rows: readonly RunRow[]): Promise<void>;
  /** Inserts every seed row in one transaction. Writes no run row. */
  seedFrom(rows: readonly FigureRow[]): Promise<void>;
}

/** Fetches one series' figures. A thrown error is a failure of that series. */
export type SeriesAdapter = () => Promise<FreshSeries>;

export interface FetchJobDeps {
  store: FigureStore;
  /**
   * One adapter per Catalogue metric id. The caller makes sure a download shared
   * by two series (the Weekly Oil Bulletin carries both EU series) happens once
   * per run.
   */
  adapters: Readonly<Record<string, SeriesAdapter>>;
  /** The run's UTC start. It becomes the Last_Success_Time of each successful series. */
  runStartedAt: Date;
  /** Rows of `fuel-figures.json`, used only when `figures` is empty. */
  seed: readonly FigureRow[];
  /** Receives one line per series, and the database or seed summary line. */
  log: (line: string) => void;
  /** Per-series deadline. Defaults to FETCH_TIMEOUT_MS. */
  timeoutMs?: number;
}

export interface SeriesOutcome {
  metricId: string;
  outcome: "stored" | "no_new_period" | "failed";
  added: number;
  revisions: number;
  /** A fixed token: `none` for stored, otherwise see {@link failureReason}. */
  reason: string;
}

export interface FetchJobResult {
  exitCode: 0 | 1;
  series: SeriesOutcome[];
}

/** Raised when a series does not answer within the deadline. */
class JobTimeout extends Error {
  constructor() {
    super("timeout");
    this.name = "JobTimeout";
  }
}

/** Rejects with JobTimeout if `work` does not settle within `ms`. */
function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new JobTimeout()), ms);
  });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}

/**
 * The fixed reason token for a failed download. Only these tokens reach the log:
 * `timeout`, `http <status>`, `request failed`, `empty`, `parse`, or a validation
 * token (`malformed <field>`, `malformed period`, `malformed value`).
 */
export function failureReason(err: unknown): string {
  if (err instanceof JobTimeout) return "timeout";
  if (err instanceof SourceError) {
    switch (err.kind) {
      case "auth_required":
      case "http_status": {
        const status = err.detail.status;
        return typeof status === "number" ? `http ${status}` : "request failed";
      }
      case "network":
      case "wrong_host":
        return "request failed";
      case "empty_body":
        return "empty";
      default:
        return "parse";
    }
  }
  return "request failed";
}

/** Maps a validateFreshSeries reason onto the fixed token set. */
function validationReason(reason: string): string {
  if (reason === "duplicate period") return "malformed period";
  if (reason === "unknown series") return "malformed series";
  return reason; // "empty", "malformed <field>", "malformed period", "malformed value"
}

function failedFor(metricId: string, reason: string): SeriesOutcome {
  return { metricId, outcome: "failed", added: 0, revisions: 0, reason };
}

/** The rows for one validated series, with the Catalogue provenance. */
function rowsFor(metric: CatalogueMetric, fresh: FreshSeries): FigureRow[] {
  return fresh.points.map((point) => ({
    metricId: metric.id,
    kind: "official",
    value: point.value,
    unit: metric.unit,
    region: metric.region,
    period: point.period,
    source: metric.source,
    seriesId: metric.series_id,
    sourceUrl: fresh.sourceUrl,
    retrievedAt: fresh.downloadedAt,
  }));
}

/**
 * The seed rows of a figure file, field by field, with each figure's own
 * `retrieved_at` and `source_url`. Only official figures can be seeded.
 */
export function seedRowsFromFigureFile(file: FigureFile): FigureRow[] {
  return file.figures.map((figure) => {
    if (figure.kind !== "official") {
      throw new Error("seed file holds a figure that is not official");
    }
    return {
      metricId: figure.metric_id,
      kind: "official",
      value: figure.value,
      unit: figure.unit,
      region: figure.region,
      period: figure.period,
      source: figure.source,
      seriesId: figure.series_id,
      sourceUrl: figure.source_url,
      retrievedAt: figure.retrieved_at,
    };
  });
}

/**
 * Download, validate and write one series. It always returns an outcome: any
 * failure before the write, or in the write itself, becomes a `failed` outcome
 * with its reason token, and nothing from that result is stored.
 */
async function attemptSeries(
  metric: CatalogueMetric,
  deps: FetchJobDeps,
  timeoutMs: number,
): Promise<SeriesOutcome> {
  const adapter = deps.adapters[metric.id];

  let fresh: FreshSeries;
  try {
    if (adapter === undefined) throw new Error("no adapter");
    fresh = await withDeadline(
      Promise.resolve().then(() => adapter()),
      timeoutMs,
    );
  } catch (err) {
    return failedFor(metric.id, failureReason(err));
  }

  if (fresh.metricId !== metric.id) {
    return failedFor(metric.id, "malformed series");
  }
  const verdict = validateFreshSeries(fresh);
  if (!verdict.ok) {
    return failedFor(metric.id, validationReason(verdict.reason));
  }

  try {
    const { inserted, revisions } = await deps.store.insertIfChanged(
      rowsFor(metric, fresh),
    );
    return inserted > 0
      ? { metricId: metric.id, outcome: "stored", added: inserted, revisions, reason: "none" }
      : { metricId: metric.id, outcome: "no_new_period", added: 0, revisions: 0, reason: "no new period" };
  } catch {
    return failedFor(metric.id, "database");
  }
}

/**
 * Runs the Fetch_Job once. Order:
 *
 *  1. `count()`. If it fails, every series fails with `database`, no source is
 *     requested, and the job exits 1.
 *  2. If `figures` is empty, `seedFrom(seed)` inserts the seed in one
 *     transaction and writes no run row. A seed error ends the job the same way.
 *  3. Each Catalogue series, in order: download (with a deadline), validate the
 *     whole result, `insertIfChanged` in its own transaction, then `recordRun`.
 *     Every series is attempted, even after a failure.
 *
 * Exit 1 when any series failed or a run row could not be written, else 0.
 */
export async function runFetchJob(deps: FetchJobDeps): Promise<FetchJobResult> {
  const { store, log, runStartedAt } = deps;
  const timeoutMs = deps.timeoutMs ?? FETCH_TIMEOUT_MS;

  const emit = (outcome: SeriesOutcome): void => {
    log(
      `fetch-figures ${outcome.metricId} ${outcome.outcome} added=${outcome.added} revisions=${outcome.revisions} reason=${outcome.reason}`,
    );
  };

  // Database down before any request: every series fails and nothing is requested.
  const allFailed = (reason: string): FetchJobResult => {
    const series = CATALOGUE.map(({ metric }) => failedFor(metric.id, reason));
    series.forEach(emit);
    return { exitCode: 1, series };
  };

  let existing: number;
  try {
    existing = await store.count();
  } catch {
    log("fetch-figures failed: database");
    return allFailed("database");
  }

  if (existing === 0) {
    try {
      await store.seedFrom(deps.seed);
    } catch {
      log("fetch-figures failed: seed");
      return allFailed("database");
    }
  }

  let failed = false;
  const series: SeriesOutcome[] = [];

  for (const { metric } of CATALOGUE) {
    const outcome = await attemptSeries(metric, deps, timeoutMs);

    // The run row. For a success it is the series' Last_Success_Time.
    if (outcome.outcome === "failed") failed = true;
    try {
      await store.recordRun([
        {
          runStartedAt,
          metricId: metric.id,
          outcome: outcome.outcome,
          added: outcome.added,
          revisions: outcome.revisions,
          reason: outcome.reason,
        },
      ]);
    } catch {
      failed = true;
    }

    emit(outcome);
    series.push(outcome);
  }

  return { exitCode: failed ? 1 : 0, series };
}
