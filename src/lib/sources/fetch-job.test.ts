// Tests for the Fetch_Job core (spec 08-judge-polish, task 16; design.md
// "Correctness Properties" 20, 21, 22 and "Testing Strategy"). Every test uses an
// in-memory FigureStore that records each call, and stub adapters, so no test
// touches the network or a database. The only file read is the real
// `fuel-figures.json`, for the seeding example.
//
// The figures in this file are clearly fake test values, not published numbers.
// The seeding example reads the real file and checks it against itself.

import { readFileSync } from "node:fs";

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { CATALOGUE } from "@/lib/figures";
import type { FigureFile } from "@/lib/figures/types";

import { SourceError } from "./errors";
import {
  FETCH_TIMEOUT_MS,
  runFetchJob,
  seedRowsFromFigureFile,
  type FetchJobDeps,
  type FigureRow,
  type FigureStore,
  type RunRow,
  type SeriesAdapter,
} from "./fetch-job";
import type { FreshSeries } from "./refresh";

const IDS = CATALOGUE.map((s) => s.metric.id);
const URL_OK = "https://www.eia.gov/dnav/pet/hist/fixture-series";
const T0 = "2026-11-01T10:00:00Z";
const T1 = "2026-11-02T10:00:00Z";
const T2 = "2026-11-03T10:00:00Z";
const T3 = "2026-11-04T10:00:00Z";
const RUN_AT = (iso: string): Date => new Date(iso);

interface Point {
  period: string;
  value: string;
}

/** Fixed fake points, used by every series unless a test overrides them. */
const BASE: Point[] = [
  { period: "2026-10-05", value: "3.541" },
  { period: "2026-10-12", value: "3.595" },
];

function fresh(metricId: string, points: Point[], downloadedAt = T0): FreshSeries {
  return { metricId, points, downloadedAt, sourceUrl: URL_OK };
}

/** Adapters that return the same fixed points for every series. */
function allGood(points: Point[] = BASE, downloadedAt = T0): Record<string, SeriesAdapter> {
  const adapters: Record<string, SeriesAdapter> = {};
  for (const id of IDS) {
    adapters[id] = async () => fresh(id, points, downloadedAt);
  }
  return adapters;
}

// --- In-memory store ---------------------------------------------------------

type Call =
  | { op: "count" }
  | { op: "seedFrom"; rows: number }
  | { op: "insertIfChanged"; metricId: string; rows: number }
  | { op: "recordRun"; rows: RunRow[] };

/**
 * Keeps every figure and run row in memory. `insertIfChanged` applies the same
 * rule as the Postgres store: a row is inserted only when its value differs
 * from the newest-`retrievedAt` row for the same series and period. A `failWrites`
 * entry makes that series' write throw, as a rolled-back transaction would.
 */
class MemoryStore implements FigureStore {
  readonly calls: Call[] = [];
  readonly figures: FigureRow[] = [];
  readonly runs: RunRow[] = [];
  readonly failWrites = new Set<string>();
  failCount = false;
  failSeed = false;
  failRuns = false;

  async count(): Promise<number> {
    this.calls.push({ op: "count" });
    if (this.failCount) throw new Error("connect ECONNREFUSED postgres://user:pw@db");
    return this.figures.length;
  }

  async insertIfChanged(
    rows: readonly FigureRow[],
  ): Promise<{ inserted: number; revisions: number }> {
    const metricId = rows[0]?.metricId ?? "";
    this.calls.push({ op: "insertIfChanged", metricId, rows: rows.length });
    if (this.failWrites.has(metricId)) throw new Error("write failed");

    let inserted = 0;
    let revisions = 0;
    const pending: FigureRow[] = [];
    for (const row of rows) {
      const newest = this.newestFor(row.metricId, row.period);
      if (newest !== undefined && newest.value === row.value) continue;
      if (newest !== undefined) revisions += 1;
      pending.push({ ...row });
      inserted += 1;
    }
    this.figures.push(...pending);
    return { inserted, revisions };
  }

  async recordRun(rows: readonly RunRow[]): Promise<void> {
    this.calls.push({ op: "recordRun", rows: rows.map((r) => ({ ...r })) });
    if (this.failRuns) throw new Error("run insert failed");
    this.runs.push(...rows.map((r) => ({ ...r })));
  }

  async seedFrom(rows: readonly FigureRow[]): Promise<void> {
    this.calls.push({ op: "seedFrom", rows: rows.length });
    if (this.failSeed) throw new Error("seed failed");
    this.figures.push(...rows.map((r) => ({ ...r })));
  }

  /** The newest-retrievedAt row for a series and period, or undefined. */
  newestFor(metricId: string, period: string): FigureRow | undefined {
    let newest: FigureRow | undefined;
    for (const row of this.figures) {
      if (row.metricId !== metricId || row.period !== period) continue;
      if (newest === undefined || row.retrievedAt > newest.retrievedAt) newest = row;
    }
    return newest;
  }

  /** Latest successful run start for a series, as epoch ms, or null. */
  lastSuccess(metricId: string): number | null {
    let latest: number | null = null;
    for (const run of this.runs) {
      if (run.metricId !== metricId || run.outcome === "failed") continue;
      const ms = run.runStartedAt.getTime();
      if (latest === null || ms > latest) latest = ms;
    }
    return latest;
  }
}

/** Builds the job deps and a list that collects every log line. */
function deps(
  store: FigureStore,
  adapters: Record<string, SeriesAdapter>,
  options: { runStartedAt?: Date; seed?: FigureRow[]; timeoutMs?: number } = {},
): { deps: FetchJobDeps; lines: string[] } {
  const lines: string[] = [];
  return {
    lines,
    deps: {
      store,
      adapters,
      runStartedAt: options.runStartedAt ?? RUN_AT(T1),
      seed: options.seed ?? [],
      log: (line) => lines.push(line),
      timeoutMs: options.timeoutMs,
    },
  };
}

/** A first run that writes BASE for every series, so the store is not empty. */
async function seededStore(): Promise<MemoryStore> {
  const store = new MemoryStore();
  await runFetchJob(deps(store, allGood(BASE, T0), { runStartedAt: RUN_AT(T0) }).deps);
  return store;
}

const ALLOWED_OPS = new Set(["count", "seedFrom", "insertIfChanged", "recordRun"]);

// --- Example tests: one per failure reason -----------------------------------

describe("runFetchJob: one example per failure reason", () => {
  /** Runs once with `id` replaced by `adapter` and every other series good. */
  async function runWithFailure(id: string, adapter: SeriesAdapter, timeoutMs?: number) {
    const store = new MemoryStore();
    const adapters = { ...allGood(), [id]: adapter };
    const { deps: d, lines } = deps(store, adapters, { timeoutMs });
    const result = await runFetchJob(d);
    const outcome = result.series.find((s) => s.metricId === id);
    return { store, result, lines, outcome };
  }

  it("a thrown network error is `request failed`", async () => {
    const { result, outcome, lines } = await runWithFailure("us-diesel", async () => {
      throw new SourceError("eia", "network", { url: URL_OK });
    });
    expect(outcome).toEqual({
      metricId: "us-diesel",
      outcome: "failed",
      added: 0,
      revisions: 0,
      reason: "request failed",
    });
    expect(result.exitCode).toBe(1);
    expect(lines).toContain(
      "fetch-figures us-diesel failed added=0 revisions=0 reason=request failed",
    );
  });

  it("a series that does not answer in time is `timeout`", async () => {
    const { result, outcome } = await runWithFailure(
      "us-diesel",
      () => new Promise<FreshSeries>(() => {}),
      5,
    );
    expect(outcome?.reason).toBe("timeout");
    expect(outcome?.outcome).toBe("failed");
    expect(result.exitCode).toBe(1);
  });

  it("a non-2xx status is `http <status>`", async () => {
    const { outcome } = await runWithFailure("us-diesel", async () => {
      throw new SourceError("eia", "http_status", { url: URL_OK, status: 404 });
    });
    expect(outcome?.reason).toBe("http 404");
  });

  it("an auth status is `http <status>` too", async () => {
    const { outcome } = await runWithFailure("us-diesel", async () => {
      throw new SourceError("eia", "auth_required", { url: URL_OK, status: 403 });
    });
    expect(outcome?.reason).toBe("http 403");
  });

  it("a file that cannot be parsed is `parse`", async () => {
    const { outcome } = await runWithFailure("us-diesel", async () => {
      throw new SourceError("eia", "unreadable_file", { url: URL_OK });
    });
    expect(outcome?.reason).toBe("parse");
  });

  it("zero figures is `empty` and stores nothing", async () => {
    const { store, outcome } = await runWithFailure("us-diesel", async () =>
      fresh("us-diesel", []),
    );
    expect(outcome?.reason).toBe("empty");
    expect(store.figures.filter((r) => r.metricId === "us-diesel")).toHaveLength(0);
  });

  it("a malformed value is `malformed value` and nothing from that series is stored", async () => {
    const { store, outcome } = await runWithFailure("us-diesel", async () =>
      fresh("us-diesel", [
        { period: "2026-10-05", value: "3.541" },
        { period: "2026-10-12", value: "not-a-number" },
      ]),
    );
    expect(outcome?.reason).toBe("malformed value");
    expect(store.figures.filter((r) => r.metricId === "us-diesel")).toHaveLength(0);
  });

  it("two figures for one period are `malformed period`", async () => {
    const { outcome } = await runWithFailure("us-diesel", async () =>
      fresh("us-diesel", [
        { period: "2026-10-05", value: "3.541" },
        { period: "2026-10-05", value: "3.542" },
      ]),
    );
    expect(outcome?.reason).toBe("malformed period");
  });

  it("a failed database write is `database`, rolls that series back and exits 1", async () => {
    const store = new MemoryStore();
    store.failWrites.add("us-diesel");
    const { deps: d } = deps(store, allGood());
    const result = await runFetchJob(d);
    const outcome = result.series.find((s) => s.metricId === "us-diesel");
    expect(outcome?.reason).toBe("database");
    expect(result.exitCode).toBe(1);
    expect(store.figures.filter((r) => r.metricId === "us-diesel")).toHaveLength(0);
    // The other series are still written.
    expect(store.figures.filter((r) => r.metricId === "us-gasoline-regular")).toHaveLength(2);
  });

  it("a database that cannot be reached requests no source and exits 1", async () => {
    const store = new MemoryStore();
    store.failCount = true;
    let requested = 0;
    const adapters: Record<string, SeriesAdapter> = {};
    for (const id of IDS) {
      adapters[id] = async () => {
        requested += 1;
        return fresh(id, BASE);
      };
    }
    const { deps: d, lines } = deps(store, adapters);
    const result = await runFetchJob(d);
    expect(result.exitCode).toBe(1);
    expect(requested).toBe(0);
    expect(lines[0]).toBe("fetch-figures failed: database");
    expect(store.calls.map((c) => c.op)).toEqual(["count"]);
    // No connection string reaches the log.
    expect(lines.join("\n")).not.toContain("postgres://");
  });

  it("the default deadline is FETCH_TIMEOUT_MS, 30 000 ms", () => {
    expect(FETCH_TIMEOUT_MS).toBe(30_000);
  });
});

describe("runFetchJob: success outcomes", () => {
  it("no new period is a success with exit 0 and sets Last_Success_Time", async () => {
    const store = await seededStore();
    const { deps: d, lines } = deps(store, allGood(BASE, T1), { runStartedAt: RUN_AT(T1) });
    const result = await runFetchJob(d);
    expect(result.exitCode).toBe(0);
    expect(result.series.every((s) => s.outcome === "no_new_period")).toBe(true);
    expect(lines[0]).toBe(
      "fetch-figures us-gasoline-regular no_new_period added=0 revisions=0 reason=no new period",
    );
    expect(store.lastSuccess("us-diesel")).toBe(RUN_AT(T1).getTime());
  });
});

// --- Seeding against the real fuel-figures.json ------------------------------

describe("runFetchJob: seeding from fuel-figures.json", () => {
  it("stores every file row field by field and writes no run row for the seed", async () => {
    const file = JSON.parse(
      readFileSync(new URL("../figures/real/fuel-figures.json", import.meta.url), "utf8"),
    ) as FigureFile;
    const seed = seedRowsFromFigureFile(file);
    expect(seed.length).toBeGreaterThan(0);

    // Each series answers with exactly the file's points, so every run row is
    // no_new_period and no figure is inserted by the run itself.
    const adapters: Record<string, SeriesAdapter> = {};
    for (const id of IDS) {
      const rows = seed.filter((r) => r.metricId === id);
      adapters[id] = async () =>
        fresh(
          id,
          rows.map((r) => ({ period: r.period, value: r.value })),
          rows[0]?.retrievedAt ?? T0,
        );
    }

    const store = new MemoryStore();
    const { deps: d, lines } = deps(store, adapters, { seed });
    const result = await runFetchJob(d);

    // Every seeded row is present, unchanged, including its original retrieved_at.
    expect(store.figures).toEqual(seed);

    // The seed is the first write, and it adds no run row. The only run rows are
    // the four per-series rows recorded after it.
    const ops = store.calls.map((c) => c.op);
    expect(ops[0]).toBe("count");
    expect(ops[1]).toBe("seedFrom");
    expect(store.runs).toHaveLength(IDS.length);
    expect(store.runs.every((r) => r.outcome === "no_new_period")).toBe(true);

    expect(result.exitCode).toBe(0);
    expect(lines.every((l) => !l.includes("https://"))).toBe(true);
  });

  it("does not seed a table that already has rows", async () => {
    const store = await seededStore();
    const { deps: d } = deps(store, allGood(), { seed: [] });
    await runFetchJob(d);
    expect(store.calls.filter((c) => c.op === "seedFrom")).toHaveLength(1);
  });

  it("a seed error exits 1, prints the seed line and requests no source", async () => {
    const store = new MemoryStore();
    store.failSeed = true;
    let requested = 0;
    const adapters: Record<string, SeriesAdapter> = {};
    for (const id of IDS) {
      adapters[id] = async () => {
        requested += 1;
        return fresh(id, BASE);
      };
    }
    const { deps: d, lines } = deps(store, adapters, {
      seed: [{ metricId: "x", kind: "official", value: "1", unit: "u", region: "r", period: "2026-10-05", source: "s", seriesId: "x", sourceUrl: URL_OK, retrievedAt: T0 }],
    });
    const result = await runFetchJob(d);
    expect(result.exitCode).toBe(1);
    expect(requested).toBe(0);
    expect(lines[0]).toBe("fetch-figures failed: seed");
    expect(store.figures).toHaveLength(0);
  });
});

// --- Property 20 -------------------------------------------------------------

const valueArb = fc
  .integer({ min: 0, max: 999_999 })
  .map((n) => `${Math.floor(n / 1000)}.${String(n % 1000).padStart(3, "0")}`);
const periodOf = (k: number): string =>
  new Date(Date.UTC(2020, 0, 5) + k * 7 * 86_400_000).toISOString().slice(0, 10);
const pointsArb: fc.Arbitrary<Point[]> = fc
  .uniqueArray(fc.tuple(fc.integer({ min: 0, max: 300 }), valueArb), {
    minLength: 1,
    maxLength: 5,
    selector: (p) => p[0],
  })
  .map((pairs) => pairs.map(([k, value]) => ({ period: periodOf(k), value })));
const seriesSetArb = fc.array(pointsArb, { minLength: IDS.length, maxLength: IDS.length });
const minuteArb = fc.integer({ min: 0, max: 59 }).map((m) => `2026-11-02T10:${String(m).padStart(2, "0")}:00Z`);

describe("Property 20: the Fetch_Job stores what the source published, with full provenance", () => {
  it("every stored row equals the source value, provenance and download time", async () => {
    await fc.assert(
      fc.asyncProperty(seriesSetArb, minuteArb, async (perSeries, downloadedAt) => {
        const adapters: Record<string, SeriesAdapter> = {};
        IDS.forEach((id, i) => {
          adapters[id] = async () => fresh(id, perSeries[i] ?? [], downloadedAt);
        });
        const store = new MemoryStore();
        const { deps: d } = deps(store, adapters, { runStartedAt: RUN_AT(T1) });
        const result = await runFetchJob(d);
        expect(result.exitCode).toBe(0);

        IDS.forEach((id, i) => {
          const metric = CATALOGUE[i]!.metric;
          const expected = perSeries[i] ?? [];
          const stored = store.figures.filter((r) => r.metricId === id);
          expect(stored.map((r) => r.period)).toEqual(expected.map((p) => p.period));
          stored.forEach((row, j) => {
            expect(row).toEqual({
              metricId: id,
              kind: "official",
              value: expected[j]!.value,
              unit: metric.unit,
              region: metric.region,
              period: expected[j]!.period,
              source: metric.source,
              seriesId: metric.series_id,
              sourceUrl: URL_OK,
              retrievedAt: downloadedAt,
            });
          });
        });
      }),
      { numRuns: 100 },
    );
  });
});

// --- Property 21 -------------------------------------------------------------

describe("Property 21: re-running adds zero rows; a changed value adds one Revision_Row", () => {
  it("same results add nothing, a changed value adds one revision, and earlier rows never change", async () => {
    await fc.assert(
      fc.asyncProperty(seriesSetArb, fc.integer({ min: 0, max: IDS.length - 1 }), async (perSeries, changedIndex) => {
        const store = new MemoryStore();
        const adaptersFor = (sets: Point[][], at: string) => {
          const out: Record<string, SeriesAdapter> = {};
          IDS.forEach((id, i) => {
            out[id] = async () => fresh(id, sets[i] ?? [], at);
          });
          return out;
        };

        // A failed run first, to show it leaves the store's rows as they were.
        const failing: Record<string, SeriesAdapter> = {};
        for (const id of IDS) {
          failing[id] = async () => {
            throw new SourceError("eia", "network", { url: URL_OK });
          };
        }
        await runFetchJob(deps(store, failing, { runStartedAt: RUN_AT(T0) }).deps);

        // Run A: store the results.
        await runFetchJob(deps(store, adaptersFor(perSeries, T0), { runStartedAt: RUN_AT(T0) }).deps);
        const afterA = structuredClone(store.figures);

        // Run B: the same results at a later time add nothing.
        const runB = await runFetchJob(deps(store, adaptersFor(perSeries, T1), { runStartedAt: RUN_AT(T1) }).deps);
        expect(store.figures).toEqual(afterA);
        expect(runB.series.every((s) => s.outcome === "no_new_period")).toBe(true);

        // Run C: one series changes the value of its first period.
        const changedId = IDS[changedIndex]!;
        const changedSets = perSeries.map((points, i) =>
          i === changedIndex && points.length > 0
            ? points.map((p, j) => (j === 0 ? { period: p.period, value: p.value === "1.000" ? "2.000" : "1.000" } : p))
            : points,
        );
        const beforeC = structuredClone(store.figures);
        const runC = await runFetchJob(deps(store, adaptersFor(changedSets, T2), { runStartedAt: RUN_AT(T2) }).deps);
        const revisions = store.figures.slice(beforeC.length);
        expect(store.figures.slice(0, beforeC.length)).toEqual(beforeC);
        const changedSeries = runC.series.find((s) => s.metricId === changedId)!;
        if (perSeries[changedIndex]!.length > 0) {
          expect(revisions).toHaveLength(1);
          expect(revisions[0]!.metricId).toBe(changedId);
          expect(revisions[0]!.period).toBe(perSeries[changedIndex]![0]!.period);
          expect(changedSeries.added).toBe(1);
          expect(changedSeries.revisions).toBe(1);
        } else {
          expect(revisions).toHaveLength(0);
        }

        // Run D: the same changed value again adds zero rows.
        const beforeD = structuredClone(store.figures);
        await runFetchJob(deps(store, adaptersFor(changedSets, T3), { runStartedAt: RUN_AT(T3) }).deps);
        expect(store.figures).toEqual(beforeD);
      }),
      { numRuns: 100 },
    );
  });
});

// --- Property 22 -------------------------------------------------------------

type Kind =
  | "ok"
  | "no_new_period"
  | "network"
  | "timeout"
  | "http"
  | "parse"
  | "empty"
  | "malformed"
  | "db_write";

const KINDS: Kind[] = ["ok", "no_new_period", "network", "timeout", "http", "parse", "empty", "malformed", "db_write"];
const FAILING: Kind[] = ["network", "timeout", "http", "parse", "empty", "malformed", "db_write"];
const NEW_PERIOD = "2026-11-02";

describe("Property 22: exit status and isolation per series", () => {
  it("attempts every series once, stores only successful results, and exits 1 exactly when a series failed", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom(...KINDS), { minLength: IDS.length, maxLength: IDS.length }),
        async (kinds) => {
          const store = await seededStore();
          const beforeRuns = store.runs.length;
          const beforeFigures = structuredClone(store.figures);
          const beforeSuccess = new Map(IDS.map((id) => [id, store.lastSuccess(id)]));

          const attempts = new Map<string, number>();
          const adapters: Record<string, SeriesAdapter> = {};
          IDS.forEach((id, i) => {
            const kind = kinds[i] as Kind;
            adapters[id] = async () => {
              attempts.set(id, (attempts.get(id) ?? 0) + 1);
              switch (kind) {
                case "ok":
                  return fresh(id, [{ period: NEW_PERIOD, value: "1.111" }], T2);
                case "no_new_period":
                  return fresh(id, BASE, T2);
                case "network":
                  throw new SourceError("eia", "network", { url: URL_OK });
                case "timeout":
                  return new Promise<FreshSeries>(() => {});
                case "http":
                  throw new SourceError("eia", "http_status", { url: URL_OK, status: 500 });
                case "parse":
                  throw new SourceError("eia", "unreadable_file", { url: URL_OK });
                case "empty":
                  return fresh(id, [], T2);
                case "malformed":
                  return fresh(id, [{ period: NEW_PERIOD, value: "abc" }], T2);
                case "db_write":
                  return fresh(id, [{ period: NEW_PERIOD, value: "1.111" }], T2);
              }
            };
          });
          IDS.forEach((id, i) => {
            if (kinds[i] === "db_write") store.failWrites.add(id);
          });

          const runStart = RUN_AT(T2);
          const { deps: d } = deps(store, adapters, { runStartedAt: runStart, timeoutMs: 5 });
          const result = await runFetchJob(d);

          // Every series is attempted exactly once.
          for (const id of IDS) expect(attempts.get(id)).toBe(1);

          // No update or delete reaches the store.
          const ops = store.calls.map((c) => c.op);
          for (const op of ops) expect(ALLOWED_OPS.has(op)).toBe(true);

          // Failed series store nothing new. Other series keep every well-formed figure.
          IDS.forEach((id, i) => {
            const kind = kinds[i] as Kind;
            const before = beforeFigures.filter((r) => r.metricId === id);
            const now = store.figures.filter((r) => r.metricId === id);
            if (FAILING.includes(kind)) {
              expect(now).toEqual(before);
            } else if (kind === "ok") {
              expect(now.length).toBe(before.length + 1);
            } else {
              expect(now).toEqual(before);
            }
          });

          // Last_Success_Time: the run start for successes, unchanged for failures.
          IDS.forEach((id, i) => {
            const kind = kinds[i] as Kind;
            const success = !FAILING.includes(kind);
            expect(store.lastSuccess(id)).toBe(success ? runStart.getTime() : beforeSuccess.get(id));
          });

          // One run row per series in this run; a failed series records `failed`.
          const newRuns = store.runs.slice(beforeRuns);
          expect(newRuns).toHaveLength(IDS.length);
          IDS.forEach((id, i) => {
            const kind = kinds[i] as Kind;
            const run = newRuns.find((r) => r.metricId === id)!;
            expect(run.outcome === "failed").toBe(FAILING.includes(kind));
          });

          const anyFailed = kinds.some((k) => FAILING.includes(k as Kind));
          expect(result.exitCode).toBe(anyFailed ? 1 : 0);
        },
      ),
      { numRuns: 60 },
    );
  });
});
