// Reproduction for issue #400: in database mode, stored rows for the four fuel
// series are skipped and the shape step throws TypeError, so the route answers
// from the fallback.
//
// Every value in this file is a fake test value, not a published figure. The
// source and series fields come from the real Catalogue so each row owns its
// series. No test touches a database or the network.
//
// Driver shapes. The store (src/app/api/figures/db-store.ts) reads `value::text`
// and the timestamptz columns. Two shapes are modelled:
//   - Date: what postgres.js 4.0.0 returns for timestamptz (OID 1184) by default.
//   - string: Postgres's own text form for timestamptz, "YYYY-MM-DD HH:MM:SS+00".
//     It is modelled because the reported production log implies the rows reach
//     the shape step with string timestamps. Whether the live driver really does
//     that is not confirmed: no database was reachable from this sandbox.
// The figures table has no nullable column (drizzle/0002_figures.sql, every
// column is NOT NULL), so no null-handling path is exercised here.
//
// The FigureReadStore type declares retrieved_at as Date. The string cases must
// break that type on purpose, so the one cast at DRIVER_BOUNDARY is the only place
// the test departs from the declared type.
//
// Tests marked it.fails assert the correct behaviour and fail while the bug
// exists, so the suite stays green on main. Plain tests pin the current output.

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { CATALOGUE } from "@/lib/figures/catalogue";

import type { FigureReadStore, StoredFigureRow } from "./db-response";
import { respondFigures } from "./respond";

const GENERATED = new Date("2026-11-13T10:00:00Z");
const FAKE_SOURCE_URL = "https://test.invalid/fake-figure";
const FAKE_VALUE = "3.4120";

type DriverShape = "Date" | "postgres-text";

/** The Postgres text form of a timestamptz, as a string driver would return it. */
const PG_ROW_TIME = "2026-11-13 10:00:00+00";
const PG_SUCCESS_TIME = "2026-11-13 09:00:00+00";

/** A row as the driver hands it over: retrieved_at is a Date or a Postgres text string. */
interface DriverRow extends Omit<StoredFigureRow, "retrieved_at"> {
  retrieved_at: Date | string;
}

/** One stored row per Catalogue series, shaped as the store's SELECT returns it. */
function driverRows(shape: DriverShape): DriverRow[] {
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
      retrieved_at: shape === "Date" ? new Date(PG_ROW_TIME) : PG_ROW_TIME,
    };
  });
}

/** Last successful run per metric, as lastSuccessTimes returns it. */
function driverSuccessTimes(shape: DriverShape): ReadonlyMap<string, Date | string> {
  return new Map(
    CATALOGUE.map((cat) => [
      cat.metric.id,
      shape === "Date" ? new Date(PG_SUCCESS_TIME) : PG_SUCCESS_TIME,
    ]),
  );
}

/**
 * DRIVER_BOUNDARY: the only cast in this file. The driver can hand back a string
 * where the declared type says Date, and this cast lets the test feed that shape.
 */
function storeFor(rowShape: DriverShape, successShape: DriverShape): FigureReadStore {
  return {
    latestFigures: async () =>
      driverRows(rowShape) as unknown as readonly StoredFigureRow[],
    lastSuccessTimes: async () =>
      driverSuccessTimes(successShape) as unknown as ReadonlyMap<string, Date>,
  };
}

async function runDb(store: FigureReadStore) {
  const response = await respondFigures("db", {
    readStore: () => store,
    now: () => GENERATED,
  });
  const body = (await response.json()) as {
    series: { metric: { id: string }; figure: { value: string } | null; fallback: boolean }[];
  };
  return { status: response.status, body };
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

describe("database rows with Date timestamps (the driver's default type)", () => {
  it("serves every stored row without skipping or fallback", async () => {
    const { status, body } = await runDb(storeFor("Date", "Date"));

    expect(status).toBe(200);
    expect(loggedLines()).toEqual([]);
    for (const entry of body.series) {
      expect(entry.figure?.value).toBe(FAKE_VALUE);
    }
  });
});

describe("database rows with postgres text timestamps (current behaviour, bug #400)", () => {
  it("logs one figures_row_skipped line per fuel series, then the shape TypeError", async () => {
    const { status } = await runDb(storeFor("postgres-text", "postgres-text"));

    expect(status).toBe(200);
    expect(loggedLines()).toEqual([
      "figures_row_skipped metric_id=us-gasoline-regular",
      "figures_row_skipped metric_id=us-diesel",
      "figures_row_skipped metric_id=eu-petrol-euro95",
      "figures_row_skipped metric_id=eu-diesel",
      "figures_unavailable step=shape error=TypeError",
    ]);
  });

  it.fails("should keep stored rows with text timestamps and log no skip", async () => {
    // Desired behaviour: the rows are valid, so nothing is skipped and the stored
    // figures are served. Fails while the bug exists.
    const { status, body } = await runDb(storeFor("postgres-text", "Date"));

    expect(status).toBe(200);
    expect(loggedLines()).toEqual([]);
    for (const entry of body.series) {
      expect(entry.figure?.value).toBe(FAKE_VALUE);
    }
  });

  it.fails("should answer the stored figures without the shape fallback", async () => {
    // Desired behaviour: no figures_unavailable line. Fails while the bug exists.
    await runDb(storeFor("postgres-text", "postgres-text"));

    expect(loggedLines().some((line) => line.startsWith("figures_unavailable"))).toBe(false);
  });
});

describe("shape TypeError with Date rows", () => {
  it("throws TypeError in the shape step when success times are text", async () => {
    const { status } = await runDb(storeFor("Date", "postgres-text"));

    expect(status).toBe(200);
    expect(loggedLines()).toEqual(["figures_unavailable step=shape error=TypeError"]);
  });
});
