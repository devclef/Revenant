// Postgres tests for the figure tables and the Fetch_Job store (spec
// 08-judge-polish, task 19; design.md "Testing Strategy", requirements R20.4,
// R20.5, R20.17, R22.5, R30.4). Three things are proved against a real database:
//
//   1. The `figures` and `figure_fetch_runs` triggers reject UPDATE, DELETE and
//      TRUNCATE (the migration `drizzle/0002_figures.sql`).
//   2. The insert-if-different query adds no row for an equal value and one row
//      for a different value.
//   3. The Postgres store from `scripts/fetch-figures-store.ts` passes the same
//      R30.4 cases that the in-memory store passes in `fetch-job.test.ts`.
//
// The in-memory store there is private to that file, so the R30.4 cases are
// restated here against the Postgres store, using the same stub adapters and
// `runFetchJob`. Each case is listed by its design.md item.
//
// Like the other integration files, this suite runs only through `describeDb`:
// it skips locally without a test `DATABASE_URL` and fails, never skips, in CI.
//
// The database is shared and figure rows are immutable, so nothing here can be
// cleaned up. Every test therefore uses its own random periods (weekly dates in
// 2000 to about 5800) and its own random run start times. Counts and assertions
// look only at those rows, so reruns and other files on the same database do
// not change the result. The figures in this file are fake test values with the
// label "fixture-series". They are never shown anywhere.

import { randomInt } from "node:crypto";

import postgres from "postgres";
import type { Sql } from "postgres";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { CATALOGUE } from "@/lib/figures";
import type { FreshSeries } from "@/lib/sources/refresh";
import { SourceError } from "@/lib/sources/errors";
import {
  runFetchJob,
  type FigureRow,
  type FigureStore,
  type SeriesAdapter,
} from "@/lib/sources/fetch-job";

// The Postgres store under test. It is a script module, not an app module, so
// it is imported by relative path.
import { createPostgresFigureStore } from "../../../scripts/fetch-figures-store";

import { describeDb } from "./setup";

// A fetch run and the migrations need more than Vitest's default 5 s.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// --- Fixtures and helpers ----------------------------------------------------

const URL_FIXTURE = "https://www.eia.gov/dnav/pet/hist/fixture-series";
const META = new Map(CATALOGUE.map((s) => [s.metric.id, s.metric]));
const IDS = CATALOGUE.map((s) => s.metric.id);
const WEEK_MS = 7 * 86_400_000;

/** Fixed `retrieved_at` values in the required `YYYY-MM-DDTHH:MM:SSZ` form. */
const RETRIEVED = {
  a: "2026-11-01T10:00:00Z",
  b: "2026-11-02T10:00:00Z",
  c: "2026-11-03T10:00:00Z",
};

interface Point {
  period: string;
  value: string;
}

/** A weekly period, `YYYY-MM-DD`, k weeks after 1 January 2000 (UTC). */
function periodOf(k: number): string {
  return new Date(Date.UTC(2000, 0, 1) + k * WEEK_MS).toISOString().slice(0, 10);
}

/** Per-test periods that no other test uses. Two adjacent weeks. */
function freshPeriods(): string[] {
  const k = randomInt(0, 200_000);
  return [periodOf(k), periodOf(k + 1)];
}

/** A run start in UTC, to the millisecond, unique per call. */
function freshRunStart(): Date {
  return new Date(Date.UTC(2000, 0, 1) + randomInt(0, 3_000_000_000_000));
}

/** The same points for every series, paired with the periods of the test. */
function pointsFor(periods: readonly string[], values: readonly string[]): Point[] {
  return periods.map((period, i) => ({ period, value: values[i] }));
}

const BASE_VALUES = ["3.541", "3.595"] as const;

/** A FreshSeries for one metric. */
function freshFor(metricId: string, points: Point[], downloadedAt: string): FreshSeries {
  return { metricId, points, downloadedAt, sourceUrl: URL_FIXTURE };
}

/** One adapter per catalogue series, all returning `points`, with overrides. */
function adaptersFor(
  points: Point[],
  downloadedAt: string,
  overrides: Record<string, SeriesAdapter> = {},
): Record<string, SeriesAdapter> {
  const adapters: Record<string, SeriesAdapter> = {};
  for (const id of IDS) {
    adapters[id] = async () => freshFor(id, points, downloadedAt);
  }
  return { ...adapters, ...overrides };
}

/** Runs the job once with the Postgres store and returns its result and log. */
async function runJob(
  store: FigureStore,
  adapters: Record<string, SeriesAdapter>,
  runStartedAt: Date,
  timeoutMs?: number,
) {
  const lines: string[] = [];
  const result = await runFetchJob({
    store,
    adapters,
    runStartedAt,
    seed: [],
    log: (line) => lines.push(line),
    timeoutMs,
  });
  return { result, lines };
}

/** One row as read back from Postgres, with the eight provenance fields. */
interface StoredRow {
  id: string;
  metric_id: string;
  kind: string;
  value: string;
  unit: string;
  region: string;
  period: string;
  source: string;
  series_id: string;
  source_url: string;
  retrieved_at: Date;
}

/** Every row for the given metrics and periods, in id order. */
function storedRows(
  sql: Sql,
  metricIds: readonly string[],
  periods: readonly string[],
): Promise<StoredRow[]> {
  return sql<StoredRow[]>`
    SELECT id::text AS id, metric_id, kind, value::text AS value, unit, region,
           period, source, series_id, source_url, retrieved_at
    FROM figures
    WHERE metric_id = ANY(${[...metricIds]}::text[])
      AND period = ANY(${[...periods]}::text[])
    ORDER BY id`;
}

/** Stored rows that a run wrote for one series, compared without the id. */
function withoutId(rows: StoredRow[]): Omit<StoredRow, "id">[] {
  return rows.map((r) => ({
    metric_id: r.metric_id,
    kind: r.kind,
    value: r.value,
    unit: r.unit,
    region: r.region,
    period: r.period,
    source: r.source,
    series_id: r.series_id,
    source_url: r.source_url,
    retrieved_at: r.retrieved_at,
  }));
}

/** The eight provenance fields, as the catalogue and the run define them. */
function expectedRow(metricId: string, period: string, value: string, retrievedAt: string) {
  const meta = META.get(metricId);
  if (meta === undefined) throw new Error(`no catalogue entry for ${metricId}`);
  return {
    metric_id: metricId,
    kind: "official",
    value,
    unit: meta.unit,
    region: meta.region,
    period,
    source: meta.source,
    series_id: meta.series_id,
    source_url: URL_FIXTURE,
    retrieved_at: new Date(retrievedAt),
  };
}

/** Counts run rows for one metric whose run start is one of `starts`. */
async function runOutcomes(
  sql: Sql,
  metricId: string,
  starts: readonly Date[],
): Promise<{ outcome: string; run_started_at: Date }[]> {
  return sql<{ outcome: string; run_started_at: Date }[]>`
    SELECT outcome, run_started_at FROM figure_fetch_runs
    WHERE metric_id = ${metricId}::text
      AND run_started_at = ANY(${starts.map((d) => d.toISOString())}::timestamptz[])
    ORDER BY run_started_at`;
}

/** Reads the DATABASE_URL, failing if it is unset. The value is never logged. */
function requireUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for the figures tests");
  return url;
}

// --- Suite -------------------------------------------------------------------

describeDb("figures tables and the Fetch_Job Postgres store", () => {
  let sql: Sql;

  beforeAll(() => {
    sql = postgres(requireUrl(), { max: 1 });
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  // 1. Triggers ------------------------------------------------------------

  /** A synthetic series, so trigger tests never touch catalogue series. */
  function syntheticSeries() {
    const tag = randomInt(0, 2 ** 40).toString(36);
    return {
      metricId: `test-metric-${tag}`,
      source: `test-source-${tag}`,
      seriesId: `test-series-${tag}`,
      unit: "test unit",
      region: "test region",
    };
  }

  it("rejects UPDATE, DELETE and TRUNCATE on figures", async () => {
    const s = syntheticSeries();
    const store = createPostgresFigureStore(sql);
    await store.insertIfChanged([
      {
        metricId: s.metricId,
        kind: "official",
        value: "3.541",
        unit: s.unit,
        region: s.region,
        period: freshPeriods()[0],
        source: s.source,
        seriesId: s.seriesId,
        sourceUrl: URL_FIXTURE,
        retrievedAt: RETRIEVED.a,
      },
    ]);
    const [{ id }] = await sql<{ id: string }[]>`
      SELECT id::text AS id FROM figures WHERE metric_id = ${s.metricId}::text`;

    await expect(
      sql`UPDATE figures SET value = 9 WHERE id = ${id}::bigint`,
    ).rejects.toThrow(/UPDATE on figures is not allowed/);
    await expect(
      sql`DELETE FROM figures WHERE id = ${id}::bigint`,
    ).rejects.toThrow(/DELETE on figures is not allowed/);
    await expect(sql`TRUNCATE figures`).rejects.toThrow(
      /TRUNCATE on figures is not allowed/,
    );

    // The refused statements changed nothing: the row is still there, unchanged.
    const [after] = await sql<{ value: string }[]>`
      SELECT value::text AS value FROM figures WHERE id = ${id}::bigint`;
    expect(after.value).toBe("3.541");
  });

  it("rejects UPDATE, DELETE and TRUNCATE on figure_fetch_runs", async () => {
    const s = syntheticSeries();
    const store = createPostgresFigureStore(sql);
    const runStartedAt = freshRunStart();
    await store.recordRun([
      {
        runStartedAt,
        metricId: s.metricId,
        outcome: "stored",
        added: 1,
        revisions: 0,
        reason: "none",
      },
    ]);
    const [{ id }] = await sql<{ id: string }[]>`
      SELECT id::text AS id FROM figure_fetch_runs
      WHERE metric_id = ${s.metricId}::text`;

    await expect(
      sql`UPDATE figure_fetch_runs SET outcome = 'failed' WHERE id = ${id}::bigint`,
    ).rejects.toThrow(/UPDATE on figure_fetch_runs is not allowed/);
    await expect(
      sql`DELETE FROM figure_fetch_runs WHERE id = ${id}::bigint`,
    ).rejects.toThrow(/DELETE on figure_fetch_runs is not allowed/);
    await expect(sql`TRUNCATE figure_fetch_runs`).rejects.toThrow(
      /TRUNCATE on figure_fetch_runs is not allowed/,
    );

    const [after] = await sql<{ outcome: string }[]>`
      SELECT outcome FROM figure_fetch_runs WHERE id = ${id}::bigint`;
    expect(after.outcome).toBe("stored");
  });

  // 2. Insert if different --------------------------------------------------

  it("adds no row for an equal value and one row for a different value", async () => {
    const s = syntheticSeries();
    const store = createPostgresFigureStore(sql);
    const period = freshPeriods()[0];
    const row = (value: string, retrievedAt: string): FigureRow => ({
      metricId: s.metricId,
      kind: "official",
      value,
      unit: s.unit,
      region: s.region,
      period,
      source: s.source,
      seriesId: s.seriesId,
      sourceUrl: URL_FIXTURE,
      retrievedAt,
    });
    const countRows = async () =>
      (await sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM figures WHERE metric_id = ${s.metricId}::text`)[0].n;

    // The first value is a new period: one row, not a revision.
    expect(await store.insertIfChanged([row("3.541", RETRIEVED.a)])).toEqual({
      inserted: 1,
      revisions: 0,
    });
    expect(await countRows()).toBe(1);

    // The same value at a later retrieval: the query adds no row.
    expect(await store.insertIfChanged([row("3.541", RETRIEVED.b)])).toEqual({
      inserted: 0,
      revisions: 0,
    });
    expect(await countRows()).toBe(1);

    // A different value: one Revision_Row, and the earlier row is still there.
    expect(await store.insertIfChanged([row("3.600", RETRIEVED.c)])).toEqual({
      inserted: 1,
      revisions: 1,
    });
    expect(await countRows()).toBe(2);
    const kept = await sql<{ value: string; retrieved_at: Date }[]>`
      SELECT value::text AS value, retrieved_at FROM figures
      WHERE metric_id = ${s.metricId}::text ORDER BY id`;
    expect(kept).toEqual([
      { value: "3.541", retrieved_at: new Date(RETRIEVED.a) },
      { value: "3.600", retrieved_at: new Date(RETRIEVED.c) },
    ]);
  });

  // 3. The R30.4 cases on the Postgres store ----------------------------------

  // R30.4 item: every stored row carries the eight provenance fields.
  it("stores all eight provenance fields for every series", async () => {
    const periods = freshPeriods();
    const store = createPostgresFigureStore(sql);
    const { result } = await runJob(
      store,
      adaptersFor(pointsFor(periods, BASE_VALUES), RETRIEVED.a),
      freshRunStart(),
    );
    expect(result.exitCode).toBe(0);

    const rows = await storedRows(sql, IDS, periods);
    expect(rows).toHaveLength(IDS.length * periods.length);
    for (const id of IDS) {
      const forSeries = rows.filter((r) => r.metric_id === id);
      expect(withoutId(forSeries)).toEqual(
        periods.map((period, i) => expectedRow(id, period, BASE_VALUES[i], RETRIEVED.a)),
      );
    }
  });

  // R30.4 items: two runs add zero rows the second time, and a failed run in
  // between does not change that. A run with no new period exits 0.
  it("adds zero rows on a repeat run, also after a failed run", async () => {
    const periods = freshPeriods();
    const store = createPostgresFigureStore(sql);
    const points = pointsFor(periods, BASE_VALUES);
    await runJob(store, adaptersFor(points, RETRIEVED.a), freshRunStart());
    const before = await storedRows(sql, IDS, periods);
    expect(before).toHaveLength(IDS.length * periods.length);

    const second = await runJob(store, adaptersFor(points, RETRIEVED.b), freshRunStart());
    expect(second.result.exitCode).toBe(0);
    expect(second.result.series.every((s) => s.outcome === "no_new_period")).toBe(true);
    expect(second.lines[0]).toBe(
      `fetch-figures ${IDS[0]} no_new_period added=0 revisions=0 reason=no new period`,
    );
    expect(await storedRows(sql, IDS, periods)).toEqual(before);

    const failing = await runJob(
      store,
      adaptersFor(points, RETRIEVED.c, {
        [IDS[0]]: async () => {
          throw new SourceError("eia", "network", { url: URL_FIXTURE });
        },
      }),
      freshRunStart(),
    );
    expect(failing.result.exitCode).toBe(1);
    expect(await storedRows(sql, IDS, periods)).toEqual(before);

    const third = await runJob(store, adaptersFor(points, RETRIEVED.c), freshRunStart());
    expect(third.result.exitCode).toBe(0);
    expect(await storedRows(sql, IDS, periods)).toEqual(before);
  });

  // R30.4 item: exit 1 for each of the six failure kinds (R20.6). Each case
  // fails one series, stores nothing from it and names the reason token.
  it.each([
    {
      name: "a network error",
      reason: "request failed",
      adapter: (async () => {
        throw new SourceError("eia", "network", { url: URL_FIXTURE });
      }) as SeriesAdapter,
      timeoutMs: undefined,
    },
    {
      name: "a series that does not answer in time",
      reason: "timeout",
      adapter: (() => new Promise<FreshSeries>(() => {})) as SeriesAdapter,
      timeoutMs: 20,
    },
    {
      name: "a non-2xx status",
      reason: "http 503",
      adapter: (async () => {
        throw new SourceError("eia", "http_status", { url: URL_FIXTURE, status: 503 });
      }) as SeriesAdapter,
      timeoutMs: undefined,
    },
    {
      name: "an empty result",
      reason: "empty",
      adapter: (async () => freshFor(IDS[0], [], RETRIEVED.a)) as SeriesAdapter,
      timeoutMs: undefined,
    },
    {
      name: "a file that cannot be parsed",
      reason: "parse",
      adapter: (async () => {
        throw new SourceError("eia", "unreadable_file", { url: URL_FIXTURE });
      }) as SeriesAdapter,
      timeoutMs: undefined,
    },
    {
      name: "a malformed value",
      reason: "malformed value",
      adapter: (async () =>
        freshFor(IDS[0], [{ period: "2026-10-05", value: "not-a-number" }], RETRIEVED.a)) as SeriesAdapter,
      timeoutMs: undefined,
    },
  ])("exits 1 for $name and stores nothing from that series", async (c) => {
    const periods = freshPeriods();
    const store = createPostgresFigureStore(sql);
    const { result, lines } = await runJob(
      store,
      adaptersFor(pointsFor(periods, BASE_VALUES), RETRIEVED.a, { [IDS[0]]: c.adapter }),
      freshRunStart(),
      c.timeoutMs,
    );
    expect(result.exitCode).toBe(1);
    const failed = result.series.find((s) => s.metricId === IDS[0]);
    expect(failed).toEqual({
      metricId: IDS[0],
      outcome: "failed",
      added: 0,
      revisions: 0,
      reason: c.reason,
    });
    expect(lines).toContain(
      `fetch-figures ${IDS[0]} failed added=0 revisions=0 reason=${c.reason}`,
    );
    expect(await storedRows(sql, [IDS[0]], periods)).toEqual([]);
    // The other series are still stored.
    expect(await storedRows(sql, IDS.slice(1), periods)).toHaveLength(
      (IDS.length - 1) * periods.length,
    );
  });

  // R30.4 item: when one source fails, the other source's rows are stored.
  it("stores the other source's rows when one source fails", async () => {
    const periods = freshPeriods();
    const failId = "us-diesel";
    const failSource = META.get(failId)?.source;
    const otherIds = IDS.filter((id) => META.get(id)?.source !== failSource);
    expect(otherIds.length).toBeGreaterThan(0);

    const store = createPostgresFigureStore(sql);
    const { result } = await runJob(
      store,
      adaptersFor(pointsFor(periods, BASE_VALUES), RETRIEVED.a, {
        [failId]: async () => {
          throw new SourceError("eia", "network", { url: URL_FIXTURE });
        },
      }),
      freshRunStart(),
    );
    expect(result.exitCode).toBe(1);
    expect(await storedRows(sql, [failId], periods)).toEqual([]);
    expect(await storedRows(sql, otherIds, periods)).toHaveLength(
      otherIds.length * periods.length,
    );
  });

  // R30.4 items: a changed value is appended as a Revision_Row and the earlier
  // row is unchanged. This also proves the job never updates or deletes a row:
  // every row stored before the revision is still there, identical, with its id.
  it("appends a Revision_Row for a changed value and leaves earlier rows unchanged", async () => {
    const periods = freshPeriods();
    const store = createPostgresFigureStore(sql);
    await runJob(
      store,
      adaptersFor(pointsFor(periods, BASE_VALUES), RETRIEVED.a),
      freshRunStart(),
    );
    const before = await storedRows(sql, IDS, periods);

    const revised = pointsFor(periods, [BASE_VALUES[0], "3.600"]);
    const { result } = await runJob(
      store,
      adaptersFor(revised, RETRIEVED.b),
      freshRunStart(),
    );
    expect(result.exitCode).toBe(0);
    for (const outcome of result.series) {
      expect(outcome).toMatchObject({ outcome: "stored", added: 1, revisions: 1 });
    }

    const after = await storedRows(sql, IDS, periods);
    expect(after).toHaveLength(before.length + IDS.length);
    // The rows stored before the revision are the first rows, unchanged.
    expect(after.slice(0, before.length)).toEqual(before);
    // The new rows are the revised value at the later retrieval.
    const added = after.slice(before.length);
    expect(withoutId(added)).toEqual(
      IDS.map((id) => expectedRow(id, periods[1], "3.600", RETRIEVED.b)),
    );
  });

  // R30.4 item: Last_Success_Time moves for successful runs only. A failed row
  // is recorded but does not count as a success.
  it("sets Last_Success_Time from success outcomes only", async () => {
    const periods = freshPeriods();
    const store = createPostgresFigureStore(sql);
    const okAt = freshRunStart();
    const failAt = new Date(okAt.getTime() + 60_000);
    const failId = "us-diesel";
    const points = pointsFor(periods, BASE_VALUES);

    await runJob(store, adaptersFor(points, RETRIEVED.a), okAt);
    const failed = await runJob(
      store,
      adaptersFor(points, RETRIEVED.b, {
        [failId]: async () => {
          throw new SourceError("eia", "network", { url: URL_FIXTURE });
        },
      }),
      failAt,
    );
    expect(failed.result.exitCode).toBe(1);

    // The failed run is recorded as a failed row, and the earlier run as a success.
    const rows = await runOutcomes(sql, failId, [okAt, failAt]);
    expect(rows.map((r) => [r.run_started_at.getTime(), r.outcome])).toEqual([
      [okAt.getTime(), "stored"],
      [failAt.getTime(), "failed"],
    ]);

    // Last_Success_Time for this series, over this test's runs, is the earlier
    // success. The failed run does not move it. The predicate is the one the read
    // store uses (outcome <> 'failed').
    const [{ at }] = await sql<{ at: Date }[]>`
      SELECT max(run_started_at) AS at FROM figure_fetch_runs
      WHERE metric_id = ${failId}::text AND outcome <> 'failed'
        AND run_started_at = ANY(${[okAt, failAt].map((d) => d.toISOString())}::timestamptz[])`;
    expect(at.getTime()).toBe(okAt.getTime());
  });

  // R30.4 item: when the database is unreachable, no source is requested, the
  // job exits 1 and no row changes.
  it("requests no source and exits 1 when the database cannot be reached", async () => {
    const periods = freshPeriods();
    const dead = postgres(requireUrl(), { max: 1 });
    await dead.end({ timeout: 1 });

    let requested = 0;
    const adapters = adaptersFor(pointsFor(periods, BASE_VALUES), RETRIEVED.a);
    for (const id of IDS) {
      const real = adapters[id];
      adapters[id] = async () => {
        requested += 1;
        return real();
      };
    }
    const { result, lines } = await runJob(
      createPostgresFigureStore(dead),
      adapters,
      freshRunStart(),
    );
    expect(result.exitCode).toBe(1);
    expect(requested).toBe(0);
    expect(lines[0]).toBe("fetch-figures failed: database");
    expect(lines.join("\n")).not.toContain("postgres://");
    expect(await storedRows(sql, IDS, periods)).toEqual([]);
  });

  // R30.4 item: a failed write rolls its series back, exits 1 and stores none
  // of that series. The failure is a real one: a non-https source_url breaks the
  // figures_source_url_https CHECK inside the series' transaction.
  it("rolls back a series whose write fails, exits 1, and stores the others", async () => {
    const periods = freshPeriods();
    const failId = "us-diesel";
    const store = createPostgresFigureStore(sql);
    const { result } = await runJob(
      store,
      adaptersFor(pointsFor(periods, BASE_VALUES), RETRIEVED.a, {
        [failId]: async () => ({
          metricId: failId,
          points: pointsFor(periods, BASE_VALUES),
          downloadedAt: RETRIEVED.a,
          sourceUrl: "http://www.eia.gov/dnav/pet/hist/fixture-series",
        }),
      }),
      freshRunStart(),
    );
    expect(result.exitCode).toBe(1);
    expect(result.series.find((s) => s.metricId === failId)?.reason).toBe("database");
    expect(await storedRows(sql, [failId], periods)).toEqual([]);
    const others = IDS.filter((id) => id !== failId);
    expect(await storedRows(sql, others, periods)).toHaveLength(
      others.length * periods.length,
    );
  });
});
