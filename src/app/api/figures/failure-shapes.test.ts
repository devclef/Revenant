// Harness tests for the failure-shape fixtures (spec X1, issue #335).
//
// Each fixture runs through GET from route.ts in db mode. The read store is
// swapped for the fixture's store, so no database or network is touched. Every
// test checks the status, the body, the Cache-Control header and the log lines,
// and that no connection string reaches the log or the body.
//
// The invalid-row tests check that a bad stored row is skipped and logged once as
// figures_row_skipped (step 3).
//
// The fixtures are fake. Their figures are not published numbers.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bundledLatestFigure } from "@/lib/figures/bundled-latest";
import { CATALOGUE } from "@/lib/figures/catalogue";
import { parseFiguresResponse } from "@/lib/figures/now";

import type { FigureReadStore, StoredFigureRow } from "./db-response";
import {
  CONNECTION_CLOSED_STORE,
  INVALID_RETRIEVED_AT_ROW,
  NULL_RETRIEVED_AT_ROW,
  OUTSIDE_CATALOGUE_ROW,
  STATEMENT_TIMEOUT_STORE,
} from "./fixtures.test-data";
import { GET } from "./route";

// The route reads the store through getFigureReadStore. The mock hands it the
// store the current test set, so GET runs unchanged.
const { state } = vi.hoisted(() => ({
  state: { store: undefined as FigureReadStore | undefined },
}));

vi.mock("./db-store", () => ({
  getFigureReadStore: () => {
    if (state.store === undefined) throw new Error("test store not set");
    return state.store;
  },
}));

const SECRET_URL = "postgres://user:secret@host/db";
const CACHE_CONTROL = "public, max-age=600, stale-while-revalidate=3600";

/** A read store that returns the given rows and no success times. */
function rowsStore(rows: readonly StoredFigureRow[]): FigureReadStore {
  return {
    latestFigures: async () => rows,
    lastSuccessTimes: async () => new Map(),
  };
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("FIGURES_SOURCE", "db");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  state.store = undefined;
});

function loggedLines(): string[] {
  return errorSpy.mock.calls.map((args: unknown[]) => String(args[0]));
}

/** The log and the body must never carry the connection string or its credentials. */
function expectNoSecret(text: string): void {
  expect(text).not.toContain(SECRET_URL);
  expect(text).not.toContain("secret");
  expect(text).not.toMatch(/postgres:\/\//);
}

describe("failure shape: store rejects with a Postgres statement timeout", () => {
  it("answers 500 with a neutral body and no-store, and logs one read-step line", async () => {
    state.store = STATEMENT_TIMEOUT_STORE;

    const response = await GET();
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(JSON.parse(text)).toEqual({ error: "figures_unavailable" });
    expect(loggedLines()).toEqual([
      "figures_unavailable step=read error=PostgresError code=57014",
    ]);
    expectNoSecret(loggedLines().join("\n"));
    expectNoSecret(text);
  });
});

describe("failure shape: store rejects with a closed connection", () => {
  it("answers 500 with a neutral body and no-store, and logs one read-step line with no connection string", async () => {
    state.store = CONNECTION_CLOSED_STORE;

    const response = await GET();
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(JSON.parse(text)).toEqual({ error: "figures_unavailable" });
    expect(loggedLines()).toEqual([
      "figures_unavailable step=read error=Error code=CONNECTION_CLOSED",
    ]);
    expectNoSecret(loggedLines().join("\n"));
    expectNoSecret(text);
  });
});

describe("failure shape: stored row with an invalid retrieved_at ", () => {
  it("answers 200, skips the row, and logs one figures_row_skipped line for it", async () => {
    state.store = rowsStore([INVALID_RETRIEVED_AT_ROW]);

    const response = await GET();
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(CACHE_CONTROL);
    const parsed = parseFiguresResponse(JSON.parse(text));
    expect(parsed.ok).toBe(true);
    expect(text).not.toContain(INVALID_RETRIEVED_AT_ROW.metric_id);
    expect(loggedLines()).toEqual([
      "figures_row_skipped metric_id=fixture-metric-invalid-time",
    ]);
    expectNoSecret(loggedLines().join("\n"));
  });
});

describe("failure shape: stored row with a null retrieved_at ", () => {
  it("answers 200, skips the row, and logs one figures_row_skipped line for it", async () => {
    state.store = rowsStore([NULL_RETRIEVED_AT_ROW]);

    const response = await GET();
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(CACHE_CONTROL);
    const parsed = parseFiguresResponse(JSON.parse(text));
    expect(parsed.ok).toBe(true);
    expect(text).not.toContain(NULL_RETRIEVED_AT_ROW.metric_id);
    expect(loggedLines()).toEqual([
      "figures_row_skipped metric_id=fixture-metric-null-time",
    ]);
    expectNoSecret(loggedLines().join("\n"));
  });
});

describe("failure shape: stored row for a series outside the Catalogue", () => {
  // A success path: the route logs only on failure, so this shape writes zero
  // log lines by design. The "one line" rule covers the failure shapes above.
  it("answers 200 with the bundled figures, leaves the row out, and writes no log line", async () => {
    state.store = rowsStore([OUTSIDE_CATALOGUE_ROW]);

    const response = await GET();
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(CACHE_CONTROL);
    const parsed = parseFiguresResponse(JSON.parse(text));
    if (!parsed.ok) throw new Error("body rejected by parseFiguresResponse");

    expect(text).not.toContain(OUTSIDE_CATALOGUE_ROW.metric_id);
    expect(parsed.value.series.map((s) => s.metric.id)).toEqual(
      CATALOGUE.map((c) => c.metric.id),
    );
    for (const entry of parsed.value.series) {
      const cat = CATALOGUE.find((c) => c.metric.id === entry.metric.id);
      if (cat === undefined) throw new Error("unknown metric in test");
      const bundled = bundledLatestFigure(cat);
      expect(entry.figure, entry.metric.id).toEqual(bundled);
      expect(entry.fallback, entry.metric.id).toBe(bundled !== null);
    }
    expect(loggedLines()).toEqual([]);
  });
});
