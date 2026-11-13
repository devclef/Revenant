// Deterministic tests for the database-mode figures path after the #400 fix:
//   1. A genuinely invalid stored row (missing source_url, non-numeric value) is
//      skipped and logged as `figures_row_skipped metric_id=<id>` only.
//   2. A shape-step failure answers the bundled fallback with fallback: true
//      (the #362 behaviour), with last_success_at null.
//   3. last_success_at comes only from figure_fetch_runs (the success-time read),
//      never from a stored row's retrieved_at.
//
// Every value in this file is a fake test value, not a published figure. The
// source and series fields come from the real Catalogue so each row owns its
// series. No test touches a database or the network.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

import { bundledLatestFigure } from "@/lib/figures/bundled-latest";
import { CATALOGUE } from "@/lib/figures/catalogue";

import type { FigureReadStore, StoredFigureRow } from "./db-response";
import { respondFigures } from "./respond";

const GENERATED = new Date("2026-11-13T10:00:00Z");
const FAKE_SOURCE_URL = "https://test.invalid/fake-figure";
const FAKE_VALUE = "3.4120";
const PG_ROW_TIME = "2026-11-13 10:00:00+00";

interface FiguresBody {
  series: {
    metric: { id: string };
    figure: { value: string; retrieved_at: string } | null;
    fallback: boolean;
    last_success_at: string | null;
  }[];
  [key: string]: unknown;
}

/** One valid stored row per Catalogue series, with the series' own four fields. */
function validRows(): StoredFigureRow[] {
  return CATALOGUE.map((cat) => {
    const m = cat.metric;
    return {
      metric_id: m.id,
      kind: "official",
      value: FAKE_VALUE,
      unit: m.unit,
      region: m.region,
      period: "2026-10-05",
      source: m.source,
      series_id: m.series_id,
      source_url: FAKE_SOURCE_URL,
      retrieved_at: PG_ROW_TIME,
    };
  });
}

function storeWith(options: {
  rows?: readonly StoredFigureRow[];
  success?: ReadonlyMap<string, Date | string>;
}): FigureReadStore {
  return {
    latestFigures: async () => options.rows ?? [],
    lastSuccessTimes: async () => options.success ?? new Map(),
  };
}

async function runDb(
  store: FigureReadStore,
): Promise<{ status: number; headers: Headers; body: FiguresBody }> {
  const response = await respondFigures("db", {
    readStore: () => store,
    now: () => GENERATED,
  });
  const body = (await response.json()) as FiguresBody;
  return { status: response.status, headers: response.headers, body };
}

function entryFor(body: FiguresBody, metricId: string) {
  const entry = body.series.find((e) => e.metric.id === metricId);
  if (entry === undefined) throw new Error(`no series entry for ${metricId}`);
  return entry;
}

let errorSpy: MockInstance<typeof console.error>;

function loggedLines(): string[] {
  return errorSpy.mock.calls.map((call) => String(call[0]));
}

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("a genuinely invalid stored row is skipped", () => {
  it("skips a row with a missing source_url and logs only its metric ID", async () => {
    const rows = validRows();
    const target = CATALOGUE[0].metric.id;
    rows[0] = { ...rows[0], source_url: "" };

    const { status, body } = await runDb(storeWith({ rows }));

    expect(status).toBe(200);
    expect(loggedLines()).toEqual([`figures_row_skipped metric_id=${target}`]);
    // The skipped series has no stored figure, so it takes its bundled figure or null.
    const entry = entryFor(body, target);
    expect(entry.fallback).toBe(true);
    expect(entry.figure?.value).not.toBe(FAKE_VALUE);
    // The other series keep their valid stored figures.
    for (const cat of CATALOGUE.slice(1)) {
      const other = entryFor(body, cat.metric.id);
      expect(other.figure?.value).toBe(FAKE_VALUE);
      expect(other.fallback).toBe(false);
    }
  });

  it("skips a row whose value is not numeric and logs one line per metric", async () => {
    const rows = validRows();
    const target = CATALOGUE[1].metric.id;
    rows[1] = { ...rows[1], value: "not-a-number" };

    const { status, body } = await runDb(storeWith({ rows }));

    expect(status).toBe(200);
    expect(loggedLines()).toEqual([`figures_row_skipped metric_id=${target}`]);
    expect(entryFor(body, target).figure?.value).not.toBe("not-a-number");
  });

  it("logs no value, URL or connection string in the skip line", async () => {
    const rows = validRows();
    rows[0] = { ...rows[0], source_url: "", value: "SECRET-VALUE-123" };

    const { body } = await runDb(storeWith({ rows }));
    const serialised = JSON.stringify(body) + loggedLines().join("\n");

    expect(loggedLines()).toHaveLength(1);
    expect(loggedLines()[0]).toMatch(/^figures_row_skipped metric_id=\S+$/);
    expect(serialised).not.toContain("SECRET-VALUE-123");
  });
});

describe("a shape-step failure falls back to the bundled figures", () => {
  // A null row makes the shape step throw a TypeError when it reads
  // row.retrieved_at, with no mock needed. The read step succeeds, so the
  // failure is logged as step=shape.
  const nullRow = null as unknown as StoredFigureRow;

  it("answers 200 with fallback true for bundled series and no-store", async () => {
    const { status, headers, body } = await runDb(
      storeWith({ rows: [nullRow] }),
    );

    expect(status).toBe(200);
    expect(headers.get("Cache-Control")).toBe("no-store");
    const bundledIds = CATALOGUE.filter(
      (cat) => bundledLatestFigure(cat) !== null,
    ).map((cat) => cat.metric.id);
    expect(bundledIds.length).toBeGreaterThan(0);
    for (const id of bundledIds) {
      const entry = entryFor(body, id);
      expect(entry.fallback).toBe(true);
      expect(entry.figure).not.toBeNull();
    }
  });

  it("logs one line with the step and error name, and no message", async () => {
    await runDb(storeWith({ rows: [nullRow] }));

    expect(loggedLines()).toEqual([
      "figures_unavailable step=shape error=TypeError",
    ]);
  });

  it("answers last_success_at as null on the fallback", async () => {
    const { body } = await runDb(
      storeWith({
        rows: [nullRow],
        success: new Map([[CATALOGUE[0].metric.id, PG_ROW_TIME]]),
      }),
    );

    for (const entry of body.series) {
      expect(entry.last_success_at).toBeNull();
    }
  });
});

describe("last_success_at comes from figure_fetch_runs only", () => {
  it("takes last_success_at from the success time of its own metric", async () => {
    const target = CATALOGUE[0].metric.id;
    const { body } = await runDb(
      storeWith({
        rows: validRows(),
        success: new Map([[target, new Date("2026-11-13T09:00:00Z")]]),
      }),
    );

    expect(entryFor(body, target).last_success_at).toBe("2026-11-13T09:00:00Z");
    for (const cat of CATALOGUE.slice(1)) {
      expect(entryFor(body, cat.metric.id).last_success_at).toBeNull();
    }
  });

  it("accepts a Postgres text success time and returns it in UTC seconds", async () => {
    const target = CATALOGUE[0].metric.id;
    const { body } = await runDb(
      storeWith({
        rows: validRows(),
        success: new Map([[target, "2026-11-13 08:30:00+01"]]),
      }),
    );

    expect(entryFor(body, target).last_success_at).toBe("2026-11-13T07:30:00Z");
  });

  it("does not use a stored row's retrieved_at as last_success_at", async () => {
    const rows = validRows();
    const target = CATALOGUE[0].metric.id;
    rows[0] = { ...rows[0], retrieved_at: "2026-11-12 22:00:00+00" };

    const { body } = await runDb(storeWith({ rows, success: new Map() }));

    expect(entryFor(body, target).figure?.value).toBe(FAKE_VALUE);
    expect(entryFor(body, target).last_success_at).toBeNull();
  });

  it("leaves last_success_at null and logs the metric ID when the success time is invalid", async () => {
    const target = CATALOGUE[0].metric.id;
    const { status, body } = await runDb(
      storeWith({
        rows: validRows(),
        success: new Map([[target, "not-a-time"]]),
      }),
    );

    expect(status).toBe(200);
    expect(entryFor(body, target).last_success_at).toBeNull();
    expect(loggedLines()).toEqual([
      `figures_success_time_skipped metric_id=${target}`,
    ]);
  });
});
