// Tests for GET /api/figures in database mode (spec 08-judge-polish, Property 23,
// database part, and the R20.12, R20.17 and R21.5 examples).
//
// Every test uses an in-memory FigureReadStore that applies the same rules as
// the SQL in db-store.ts: the latest figure per (source, series_id, unit,
// region) is the greatest period, then the newest retrieved_at; Last_Success_Time
// is the newest run_started_at whose outcome is not `failed`. No test touches a
// database or the network.
//
// The figures in this file are fake test values, not published numbers. Their
// source and series fields are copied from the Catalogue so the matching rule is
// exercised for real.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { bundledLatestFigure } from "@/lib/figures/bundled-latest";
import { CATALOGUE } from "@/lib/figures/catalogue";
import { parseFiguresResponse } from "@/lib/figures/now";
import type { CatalogueSeries } from "@/lib/figures/types";
import type { FigureV1 } from "@/lib/seal-format";

import {
  chooseFigure,
  hasAnyBundled,
  shapeDbFiguresResponse,
  readDbFigures,
  toInstant,
  toUtcSeconds,
  type FigureReadStore,
  type StoredFigureRow,
} from "./db-response";
import { respondFigures } from "./respond";

const FAKE_SOURCE_URL = "https://test.invalid/fake-figure";
const GENERATED = new Date("2026-11-05T15:00:00Z");
const WEEK0 = Date.UTC(2026, 7, 3); // a fixed Monday in August 2026
const RUN0 = Date.UTC(2026, 10, 1); // 1 November 2026, UTC

interface RunFixture {
  metricId: string;
  runStartedAt: Date;
  outcome: "stored" | "no_new_period" | "failed";
}

/** True when row `a` is the latest of the two: greatest period, then newest retrieved_at, then later index. */
function isLatestOver(
  a: StoredFigureRow,
  aIndex: number,
  b: StoredFigureRow,
  bIndex: number,
): boolean {
  if (a.period !== b.period) return a.period > b.period;
  if (timeOf(a) !== timeOf(b)) {
    return timeOf(a) > timeOf(b);
  }
  return aIndex > bIndex;
}

/** The retrieved_at of a row as milliseconds. NaN when it is not a valid timestamp. */
function timeOf(row: StoredFigureRow): number {
  return toInstant(row.retrieved_at)?.getTime() ?? NaN;
}

/** An in-memory store with the same answers as the Postgres queries. */
class MemoryReadStore implements FigureReadStore {
  constructor(
    private readonly rows: readonly StoredFigureRow[],
    private readonly runs: readonly RunFixture[] = [],
    private readonly failWith?: Error,
  ) {}

  async latestFigures(): Promise<readonly StoredFigureRow[]> {
    if (this.failWith) throw this.failWith;
    const best = new Map<string, { row: StoredFigureRow; index: number }>();
    this.rows.forEach((row, index) => {
      const key = JSON.stringify([row.source, row.series_id, row.unit, row.region]);
      const current = best.get(key);
      if (current === undefined || isLatestOver(row, index, current.row, current.index)) {
        best.set(key, { row, index });
      }
    });
    return [...best.values()].map((entry) => entry.row);
  }

  async lastSuccessTimes(): Promise<ReadonlyMap<string, Date>> {
    if (this.failWith) throw this.failWith;
    const newest = new Map<string, Date>();
    for (const run of this.runs) {
      if (run.outcome === "failed") continue;
      const prior = newest.get(run.metricId);
      if (prior === undefined || run.runStartedAt.getTime() > prior.getTime()) {
        newest.set(run.metricId, run.runStartedAt);
      }
    }
    return newest;
  }
}

/** The figure a user sees for one row: the eight provenance fields plus metric_id and kind. */
function asFigure(row: StoredFigureRow): FigureV1 {
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

/** Independent oracle: the latest stored row for one series, by sorting. */
function oracleFigure(metricId: string, rows: readonly StoredFigureRow[]): FigureV1 | null {
  const m = CATALOGUE.find((c) => c.metric.id === metricId)?.metric;
  if (m === undefined) throw new Error("unknown metric in test");
  const owned = rows.filter(
    (r) =>
      r.source === m.source &&
      r.series_id === m.series_id &&
      r.unit === m.unit &&
      r.region === m.region,
  );
  if (owned.length === 0) return null;
  const sorted = [...owned].sort((a, b) =>
    a.period === b.period
      ? timeOf(b) - timeOf(a)
      : a.period < b.period
        ? 1
        : -1,
  );
  return asFigure(sorted[0]);
}

/** Independent oracle: the newest success run start for one metric, or null. */
function oracleLastSuccess(metricId: string, runs: readonly RunFixture[]): string | null {
  const successes = runs.filter((r) => r.metricId === metricId && r.outcome !== "failed");
  if (successes.length === 0) return null;
  const newest = Math.max(...successes.map((r) => r.runStartedAt.getTime()));
  return toUtcSeconds(new Date(newest));
}

async function bodyFrom(store: FigureReadStore) {
  const response = await respondFigures("db", {
    readStore: () => store,
    now: () => GENERATED,
  });
  expect(response.status).toBe(200);
  const parsed = parseFiguresResponse(await response.json());
  if (!parsed.ok) throw new Error("body rejected by parseFiguresResponse");
  return parsed.value;
}

// --- Generators --------------------------------------------------------------

const SERIES_COUNT = CATALOGUE.length;

interface FigureSpec {
  metricIdx: number;
  weekIdx: number;
  minute: number;
  value: string;
}

interface RunSpec {
  metricIdx: number;
  minute: number;
  outcome: RunFixture["outcome"];
}

const valueArb = fc
  .tuple(fc.nat({ max: 99999 }), fc.nat({ max: 9999 }))
  .map(([whole, frac]) => `${whole}.${String(frac).padStart(4, "0")}`);

const figureSpecArb = fc.record({
  metricIdx: fc.nat({ max: SERIES_COUNT - 1 }),
  weekIdx: fc.nat({ max: 9 }),
  minute: fc.nat({ max: 600 }),
  value: valueArb,
});

const runSpecArb = fc.record({
  metricIdx: fc.nat({ max: SERIES_COUNT - 1 }),
  minute: fc.nat({ max: 600 }),
  outcome: fc.constantFrom<RunFixture["outcome"]>("stored", "no_new_period", "failed"),
});

/** Rows with revisions: same series and period, different retrieved_at, values may differ. */
function buildRows(specs: readonly FigureSpec[]): StoredFigureRow[] {
  const seen = new Set<string>();
  const rows: StoredFigureRow[] = [];
  for (const spec of specs) {
    const m = CATALOGUE[spec.metricIdx].metric;
    const period = new Date(WEEK0 + spec.weekIdx * 7 * 86_400_000).toISOString().slice(0, 10);
    const retrievedAt = new Date(RUN0 + spec.minute * 60_000);
    const key = `${m.id}|${period}|${retrievedAt.getTime()}`;
    if (seen.has(key)) continue; // the table's unique key: one row per series, period and retrieved_at
    seen.add(key);
    rows.push({
      metric_id: m.id,
      kind: "official",
      value: spec.value,
      unit: m.unit,
      region: m.region,
      period,
      source: m.source,
      series_id: m.series_id,
      source_url: FAKE_SOURCE_URL,
      retrieved_at: retrievedAt,
    });
  }
  return rows;
}

function buildRuns(specs: readonly RunSpec[]): RunFixture[] {
  const seen = new Set<string>();
  const runs: RunFixture[] = [];
  for (const spec of specs) {
    const metricId = CATALOGUE[spec.metricIdx].metric.id;
    const runStartedAt = new Date(RUN0 + spec.minute * 60_000);
    const key = `${metricId}|${runStartedAt.getTime()}`;
    if (seen.has(key)) continue; // unique (run_started_at, metric_id)
    seen.add(key);
    runs.push({ metricId, runStartedAt, outcome: spec.outcome });
  }
  return runs;
}

// --- Property 23 (database part) ---------------------------------------------

describe("Property 23 (database part): the Figures_API lists every series with its latest figure and Last_Success_Time", () => {
  it("holds for any stored rows, revision rows and run rows", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(figureSpecArb, { maxLength: 60 }),
        fc.array(runSpecArb, { maxLength: 30 }),
        async (figureSpecs, runSpecs) => {
          const rows = buildRows(figureSpecs);
          const runs = buildRuns(runSpecs);

          const body = await bodyFrom(new MemoryReadStore(rows, runs));

          expect(body.source_mode).toBe("db");
          expect(body.generated_at).toBe("2026-11-05T15:00:00Z");
          // Exactly one entry per Catalogue series, in Catalogue order.
          expect(body.series.map((s) => s.metric.id)).toEqual(
            CATALOGUE.map((c) => c.metric.id),
          );
          for (const entry of body.series) {
            const cat = CATALOGUE.find((c) => c.metric.id === entry.metric.id);
            if (cat === undefined) throw new Error("unknown metric in test");
            // Property 1: stored, else bundled, else null.
            const stored = oracleFigure(entry.metric.id, rows);
            const bundled = bundledLatestFigure(cat);
            expect(entry.figure, entry.metric.id).toEqual(stored ?? bundled);
            expect(entry.fallback, entry.metric.id).toBe(
              stored === null && bundled !== null,
            );
            expect(entry.last_success_at, entry.metric.id).toEqual(
              oracleLastSuccess(entry.metric.id, runs),
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Examples ----------------------------------------------------------------

/** The Catalogue entry for one metric ID. Looked up by ID, never by position. */
function catalogueSeries(metricId: string): CatalogueSeries {
  const found = CATALOGUE.find((c) => c.metric.id === metricId);
  if (found === undefined) throw new Error(`unknown metric in test: ${metricId}`);
  return found;
}

const GASOLINE = catalogueSeries("us-gasoline-regular").metric;
const DIESEL = catalogueSeries("us-diesel").metric;

function stored(
  metric: typeof GASOLINE,
  period: string,
  value: string,
  retrievedAt: string,
): StoredFigureRow {
  return {
    metric_id: metric.id,
    kind: "official",
    value,
    unit: metric.unit,
    region: metric.region,
    period,
    source: metric.source,
    series_id: metric.series_id,
    source_url: FAKE_SOURCE_URL,
    retrieved_at: new Date(retrievedAt),
  };
}

describe("database mode examples", () => {
  it("lists every series in Catalogue order, with the bundled figure where nothing is stored and null last_success_at where nothing succeeded", async () => {
    const body = await bodyFrom(
      new MemoryReadStore([stored(GASOLINE, "2026-10-05", "1.0001", "2026-11-02T10:00:00Z")]),
    );

    expect(body.series).toHaveLength(CATALOGUE.length);
    const byId = new Map(body.series.map((s) => [s.metric.id, s]));
    expect(byId.get(GASOLINE.id)?.figure).not.toBeNull();
    expect(byId.get(GASOLINE.id)?.fallback).toBe(false);
    expect(byId.get(DIESEL.id)?.figure).toEqual(bundledLatestFigure(catalogueSeries("us-diesel")));
    expect(byId.get(DIESEL.id)?.fallback).toBe(true);
    expect(byId.get(DIESEL.id)?.last_success_at).toBeNull();
  });

  it("serves the newest period, and a Revision_Row over the row it revised", async () => {
    const older = stored(GASOLINE, "2026-10-05", "9.0001", "2026-11-05T09:00:00Z");
    const first = stored(GASOLINE, "2026-10-12", "1.0001", "2026-11-02T10:00:00Z");
    const revision = stored(GASOLINE, "2026-10-12", "1.0002", "2026-11-03T10:00:00Z");

    const body = await bodyFrom(new MemoryReadStore([first, older, revision]));

    const figure = body.series.find((s) => s.metric.id === GASOLINE.id)?.figure;
    expect(figure).toEqual(asFigure(revision));
    expect(figure?.period).toBe("2026-10-12");
    expect(figure?.value).toBe("1.0002");
  });

  it("does not let a failed run set Last_Success_Time, and takes the newest success", async () => {
    const runs: RunFixture[] = [
      { metricId: GASOLINE.id, runStartedAt: new Date("2026-11-01T06:17:00Z"), outcome: "stored" },
      { metricId: GASOLINE.id, runStartedAt: new Date("2026-11-02T06:17:00Z"), outcome: "failed" },
      { metricId: GASOLINE.id, runStartedAt: new Date("2026-11-03T06:17:00Z"), outcome: "no_new_period" },
      { metricId: GASOLINE.id, runStartedAt: new Date("2026-11-04T06:17:00Z"), outcome: "failed" },
    ];

    const body = await bodyFrom(new MemoryReadStore([], runs));

    const entry = body.series.find((s) => s.metric.id === GASOLINE.id);
    expect(entry?.last_success_at).toBe("2026-11-03T06:17:00Z");
  });

  it("gives null last_success_at for every series after seeding, which writes no run row", async () => {
    // R20.12: the seed keeps each figure's original retrieved_at and writes no run.
    const seeded = [
      stored(GASOLINE, "2026-10-05", "1.0001", "2026-10-30T06:00:00Z"),
      stored(DIESEL, "2026-10-05", "1.0002", "2026-10-30T06:00:00Z"),
    ];

    const body = await bodyFrom(new MemoryReadStore(seeded, []));

    for (const entry of body.series) {
      expect(entry.last_success_at, entry.metric.id).toBeNull();
    }
    expect(body.series.find((s) => s.metric.id === DIESEL.id)?.figure).toEqual(
      asFigure(seeded[1]),
    );
  });

  it("ignores stored rows for a series outside the Catalogue", async () => {
    const foreign: StoredFigureRow = {
      ...stored(GASOLINE, "2026-10-05", "7.0007", "2026-11-02T10:00:00Z"),
      source: "Some other publisher",
      series_id: "NOT_IN_CATALOGUE",
    };

    const body = await bodyFrom(new MemoryReadStore([foreign]));

    expect(body.series.map((s) => s.metric.id)).toEqual(
      CATALOGUE.map((c) => c.metric.id),
    );
    for (const entry of body.series) {
      const cat = CATALOGUE.find((c) => c.metric.id === entry.metric.id);
      if (cat === undefined) throw new Error("unknown metric in test");
      expect(entry.figure, entry.metric.id).toEqual(bundledLatestFigure(cat));
      expect(entry.fallback, entry.metric.id).toBe(true);
    }
  });

  it("answers the bundled fallback with 200 when the store fails, and the detail stays out", async () => {
    const store = new MemoryReadStore(
      [],
      [],
      new Error("connect ECONNREFUSED postgres://user:secret@db:5432/revenant"),
    );

    const response = await respondFigures("db", {
      readStore: () => store,
      now: () => GENERATED,
    });
    const text = await response.text();

    // X3: a failed read answers the bundled fallback (200), not 500.
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    // X3: the body is the fallback, not an error. It must still carry no secret.
    expect(parseFiguresResponse(JSON.parse(text)).ok).toBe(true);
    expect(text).not.toMatch(/secret/);
  });
});

// --- Read step (issue #313): the store's rejection passes through unchanged ---

describe("readDbFigures", () => {
  it("passes a store rejection to the caller unchanged, and reads both answers", async () => {
    const failure = new Error("connect ECONNREFUSED postgres://user:secret@db/x");
    const store: FigureReadStore = {
      latestFigures: () => Promise.reject(failure),
      lastSuccessTimes: () => Promise.resolve(new Map<string, Date>()),
    };

    await expect(readDbFigures(store)).rejects.toBe(failure);
  });

  it("returns the rows and success times it read, without shaping them", async () => {
    const successAt = new Date("2026-11-01T06:00:00Z");
    const store: FigureReadStore = {
      latestFigures: async () => [],
      lastSuccessTimes: async () => new Map([["us-gasoline-regular", successAt]]),
    };

    const reads = await readDbFigures(store);

    expect(reads.rows).toEqual([]);
    expect(reads.successTimes.get("us-gasoline-regular")).toBe(successAt);
  });
});

// --- Property 1 (Fallback_Refresh): stored, else bundled, else null -----------

describe("Property 1: stored, else bundled, else null", () => {
  const storedFigure = asFigure(stored(GASOLINE, "2026-10-05", "1.0001", "2026-11-02T10:00:00Z"));
  const bundledFigure = bundledLatestFigure(catalogueSeries("us-gasoline-regular"));

  it("gives the stored figure with fallback false when a stored row exists", () => {
    expect(chooseFigure(storedFigure, bundledFigure)).toEqual({
      figure: storedFigure,
      fallback: false,
    });
    expect(chooseFigure(storedFigure, null)).toEqual({
      figure: storedFigure,
      fallback: false,
    });
  });

  it("gives the bundled figure with fallback true when nothing is stored", () => {
    expect(chooseFigure(null, bundledFigure)).toEqual({
      figure: bundledFigure,
      fallback: true,
    });
  });

  it("gives null with fallback false when neither is available", () => {
    expect(chooseFigure(null, null)).toEqual({ figure: null, fallback: false });
  });

  it("holds for any combination of stored and bundled presence", () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (hasStored, hasBundled) => {
        const result = chooseFigure(
          hasStored ? storedFigure : null,
          hasBundled ? bundledFigure : null,
        );
        if (hasStored) {
          expect(result).toEqual({ figure: storedFigure, fallback: false });
        } else if (hasBundled) {
          expect(result).toEqual({ figure: bundledFigure, fallback: true });
        } else {
          expect(result).toEqual({ figure: null, fallback: false });
        }
      }),
    );
  });

  it("serves the stored figure over the bundled one for the same series", async () => {
    const storedRow = stored(GASOLINE, "2026-10-05", "1.0001", "2026-11-02T10:00:00Z");
    const body = await bodyFrom(new MemoryReadStore([storedRow]));

    const entry = body.series.find((s) => s.metric.id === GASOLINE.id);
    expect(entry?.figure).toEqual(asFigure(storedRow));
    expect(entry?.fallback).toBe(false);
    expect(entry?.figure).not.toEqual(bundledFigure);
  });
});

describe("hasAnyBundled", () => {
  it("is false when no series in the body holds a figure", () => {
    const body = shapeDbFiguresResponse(
      { rows: [], successTimes: new Map() },
      [],
      "2026-11-05T15:00:00Z",
    );
    expect(hasAnyBundled(body)).toBe(false);
  });

  it("is true when at least one series holds a bundled figure", () => {
    const body = shapeDbFiguresResponse(
      { rows: [], successTimes: new Map() },
      CATALOGUE,
      "2026-11-05T15:00:00Z",
    );
    const anyBundled = CATALOGUE.some((s) => bundledLatestFigure(s) !== null);
    expect(anyBundled).toBe(true);
    expect(hasAnyBundled(body)).toBe(true);
  });
});
