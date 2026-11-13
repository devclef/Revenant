// Reproduction for issue #400: in database mode, stored rows for the four fuel
// series are skipped and the shape step throws TypeError, so the route answers
// from the fallback.
//
// Every value in this file is a fake test value, not a published figure. The
// source and series fields come from the real Catalogue so the rows own their
// series. No test touches a database or the network.
//
// Driver types. postgres.js 4.0.0 (the pinned `postgres` package) parses
// timestamptz (OID 1184) into a Date, and the store reads `value::text` as a
// string. The "string" cases below model what the reported production log implies
// (the rows reach the shape step with string timestamps). Whether the live driver
// really returns strings is not confirmed here; no database was reachable from
// this sandbox.
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

type TimeType = "Date" | "string";

/** One stored row per Catalogue series, shaped as the store's SELECT returns it. */
function storedRows(retrievedAs: TimeType): StoredFigureRow[] {
  return CATALOGUE.map((cat) => {
    const m = cat.metric;
    const retrievedAt = "2026-11-13T10:00:00Z";
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
      retrieved_at:
        retrievedAs === "Date"
          ? new Date(retrievedAt)
          : (retrievedAt as unknown as Date),
    };
  });
}

/** Last successful run per metric, as lastSuccessTimes returns it. */
function successTimes(as: TimeType): ReadonlyMap<string, Date> {
  const at = "2026-11-13T09:00:00Z";
  return new Map(
    CATALOGUE.map((cat) => [
      cat.metric.id,
      as === "Date" ? new Date(at) : (at as unknown as Date),
    ]),
  );
}

function storeFor(
  rowTime: TimeType,
  successAt: TimeType,
): FigureReadStore {
  return {
    latestFigures: async () => storedRows(rowTime),
    lastSuccessTimes: async () => successTimes(successAt),
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

describe("database rows with string timestamps (current behaviour, bug #400)", () => {
  it("logs one figures_row_skipped line per fuel series, then the shape TypeError", async () => {
    const { status } = await runDb(storeFor("string", "string"));

    expect(status).toBe(200);
    expect(loggedLines()).toEqual([
      "figures_row_skipped metric_id=us-gasoline-regular",
      "figures_row_skipped metric_id=us-diesel",
      "figures_row_skipped metric_id=eu-petrol-euro95",
      "figures_row_skipped metric_id=eu-diesel",
      "figures_unavailable step=shape error=TypeError",
    ]);
  });

  it.fails("should keep stored rows with string timestamps and log no skip", async () => {
    // Desired behaviour: the rows are valid, so nothing is skipped and the
    // stored figures are served. Fails while the bug exists.
    const { status, body } = await runDb(storeFor("string", "Date"));

    expect(status).toBe(200);
    expect(loggedLines()).toEqual([]);
    for (const entry of body.series) {
      expect(entry.figure?.value).toBe(FAKE_VALUE);
    }
  });

  it.fails("should answer the stored figures without the shape fallback", async () => {
    // Desired behaviour: no figures_unavailable line. Fails while the bug exists.
    await runDb(storeFor("string", "string"));

    expect(loggedLines().some((line) => line.startsWith("figures_unavailable"))).toBe(false);
  });
});

describe("shape TypeError with Date rows", () => {
  it("throws TypeError in the shape step when success times are strings", async () => {
    const { status } = await runDb(storeFor("Date", "string"));

    expect(status).toBe(200);
    expect(loggedLines()).toEqual(["figures_unavailable step=shape error=TypeError"]);
  });
});
