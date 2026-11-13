// Regression tests for issue #400: in database mode, stored rows for the fuel
// series were skipped and the shape step threw TypeError, so the route answered
// from the fallback even though the rows were valid.
//
// Every value in this file is a fake test value, not a published figure. The
// source and series fields come from the real Catalogue so each row owns its
// series. No test touches a database or the network.
//
// Driver shapes. The store (src/app/api/figures/db-store.ts) reads `value::text`
// and the timestamptz columns. Two shapes are modelled:
//   - Date: what postgres.js 4.0.0 returns for timestamptz (OID 1184) by default.
//   - string: Postgres's own text form for timestamptz, "YYYY-MM-DD HH:MM:SS+00".
//     Whether the live driver returns this form is not confirmed: no database was
//     reachable from the sandbox that wrote these tests. The shape step accepts
//     both, so the test covers either.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

import { CATALOGUE } from "@/lib/figures/catalogue";

import type {
  DriverTimestamp,
  FigureReadStore,
  StoredFigureRow,
} from "./db-response";
import { respondFigures } from "./respond";

const GENERATED = new Date("2026-11-13T10:00:00Z");
const FAKE_SOURCE_URL = "https://test.invalid/fake-figure";
const FAKE_VALUE = "3.4120";

type DriverShape = "Date" | "postgres-text";

/** The Postgres text form of a timestamptz, as a string driver would return it. */
const PG_ROW_TIME = "2026-11-13 10:00:00+00";
const PG_SUCCESS_TIME = "2026-11-13 09:00:00+00";

/** One stored row per Catalogue series, shaped as the store's SELECT returns it. */
function driverRows(shape: DriverShape): StoredFigureRow[] {
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
function driverSuccessTimes(
  shape: DriverShape,
): ReadonlyMap<string, DriverTimestamp> {
  return new Map(
    CATALOGUE.map((cat) => [
      cat.metric.id,
      shape === "Date" ? new Date(PG_SUCCESS_TIME) : PG_SUCCESS_TIME,
    ]),
  );
}

function storeFor(
  rowShape: DriverShape,
  successShape: DriverShape,
): FigureReadStore {
  return {
    latestFigures: async () => driverRows(rowShape),
    lastSuccessTimes: async () => driverSuccessTimes(successShape),
  };
}

interface FiguresBody {
  series: {
    metric: { id: string };
    figure: { value: string } | null;
    fallback: boolean;
  }[];
  last_success_at?: unknown;
  [key: string]: unknown;
}

async function runDb(
  store: FigureReadStore,
): Promise<{ status: number; body: FiguresBody }> {
  const response = await respondFigures("db", {
    readStore: () => store,
    now: () => GENERATED,
  });
  const body = (await response.json()) as FiguresBody;
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

describe("database rows with postgres text timestamps (regression for #400)", () => {
  it("keeps stored rows with text timestamps and logs no skip", async () => {
    const { status, body } = await runDb(storeFor("postgres-text", "Date"));

    expect(status).toBe(200);
    expect(loggedLines()).toEqual([]);
    for (const entry of body.series) {
      expect(entry.figure?.value).toBe(FAKE_VALUE);
    }
  });

  it("answers the stored figures without the shape fallback", async () => {
    await runDb(storeFor("postgres-text", "postgres-text"));

    expect(
      loggedLines().some((line) => line.startsWith("figures_unavailable")),
    ).toBe(false);
  });

  it("answers the same body for text timestamps as for Date timestamps", async () => {
    const fromDate = await runDb(storeFor("Date", "Date"));
    const fromText = await runDb(storeFor("postgres-text", "postgres-text"));

    expect(fromText.status).toBe(200);
    expect(fromText.body).toEqual(fromDate.body);
  });
});

describe("success times as text with Date rows", () => {
  it("serves the stored figures and logs no shape error", async () => {
    const { status, body } = await runDb(storeFor("Date", "postgres-text"));

    expect(status).toBe(200);
    expect(loggedLines()).toEqual([]);
    for (const entry of body.series) {
      expect(entry.figure?.value).toBe(FAKE_VALUE);
    }
  });
});
