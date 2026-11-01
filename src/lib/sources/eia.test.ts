// Example tests for the EIA adapter (04-real-figures, R8).
//
// Two kinds of input exercise the adapter:
//
//  - The committed recorded excerpts (`__recorded__/eia-gasoline.xls`,
//    `eia-diesel.xls`) are read from disk with `node:fs` and driven through
//    both `parseEiaWorkbook` (bytes in) and `fetchEiaSeries` (through a stub
//    Fetcher that hands back the same bytes). Their expected values are written
//    out by hand here from the numbers EIA displays, never re-derived from the
//    file (R8.4). The excerpts carry a row before Coverage_Start so the "left
//    out" rule can be proven on real data.
//
//  - Every failure shape and the in-memory gap case are built with the
//    clearly-fake `test-support/workbook.ts` writer, so no real figure is ever
//    invented for a test (data-integrity.md).
//
// A global `fetch` guard fails the suite the moment any code path touches the
// network (R8.1): the adapter must reach the wire only through an injected
// Fetcher, and these tests inject their own.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { fetchEiaSeries, parseEiaWorkbook, eiaDownloadUrl } from "./eia";
import { SourceError } from "./errors";
import type { FetchResult, Fetcher } from "./types";
import {
  buildXls,
  emptyCell,
  numberCell,
  serialCell,
  textCell,
  type CellSpec,
} from "./test-support/workbook";

// ---------------------------------------------------------------------------
// R8.1: fail hard if any code under test calls the global fetch.
// ---------------------------------------------------------------------------

const fetchGuard = vi.fn((): never => {
  throw new Error("global fetch must not be called from the EIA adapter tests");
});

beforeAll(() => {
  vi.stubGlobal("fetch", fetchGuard);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Recorded excerpts, read straight from disk as bytes (R8.4).
// ---------------------------------------------------------------------------

const GASOLINE_SERIES = "EMM_EPMR_PTE_NUS_DPG";
const DIESEL_SERIES = "EMD_EPD2D_PTE_NUS_DPG";

/** Read a committed excerpt into a Uint8Array, resolved relative to this file
 *  so the test does not depend on the process working directory. */
function readExcerpt(name: string): Uint8Array {
  const path = fileURLToPath(new URL(`./__recorded__/${name}`, import.meta.url));
  return new Uint8Array(readFileSync(path));
}

const gasolineBytes = readExcerpt("eia-gasoline.xls");
const dieselBytes = readExcerpt("eia-diesel.xls");

/** The decimal string of the point at `period`, or undefined if none. */
function valueAt(
  points: ReadonlyArray<{ period: string; value: string }>,
  period: string,
): string | undefined {
  return points.find((p) => p.period === period)?.value;
}

// ---------------------------------------------------------------------------
// A stub Fetcher that returns fixed bytes, so no test touches the network.
// ---------------------------------------------------------------------------

/** Build a stub Fetcher that returns `body` on a 200 with the requested URL as
 *  the final URL, and records every URL it was asked for. */
function bytesFetcher(body: Uint8Array): { fetcher: Fetcher; calledWith: string[] } {
  const calledWith: string[] = [];
  const fetcher: Fetcher = async (url: string): Promise<FetchResult> => {
    calledWith.push(url);
    return { status: 200, url, body };
  };
  return { fetcher, calledWith };
}

/** Build a stub Fetcher that returns a given status with a tiny non-empty
 *  body, for the HTTP-status failure cases. */
function statusFetcher(status: number): Fetcher {
  return async (url: string): Promise<FetchResult> => ({
    status,
    url,
    body: new Uint8Array([1]),
  });
}

/** A fixed clock, so `downloadedAt` is deterministic in the assertions. */
const FIXED_NOW = new Date("2026-11-01T09:30:05.123Z");
const fixedNow = (): Date => FIXED_NOW;

// ---------------------------------------------------------------------------
// In-memory EIA-shaped workbooks (test-support/workbook.ts), for the failure
// and gap shapes the excerpts do not contain. Every number here is invented in
// the test and clearly fake.
// ---------------------------------------------------------------------------

const UNIT_TITLE =
  "Weekly U.S. Regular All Formulations Retail Gasoline Prices  (Dollars per Gallon)";

/** 2023-06-05 and 2023-06-12 as 1900 date-system serials (both at or after
 *  Coverage_Start 2023-06-01, so they reach the value/duplicate logic). */
const SERIAL_2023_06_05 = 45_082;
const SERIAL_2023_06_12 = 45_089;

/**
 * Build one EIA-shaped `.xls` from header fields and data rows. Row 1 is the
 * "Back to Contents" row, row 2 is `Sourcekey`/series ID, row 3 is the unit
 * title in column B, then the data rows follow.
 */
function buildEiaXls(options: {
  sheetName?: string;
  sourcekeyLabel?: string;
  seriesId?: string;
  unitTitle?: string;
  dataRows?: CellSpec[][];
}): Uint8Array {
  const {
    sheetName = "Data 1",
    sourcekeyLabel = "Sourcekey",
    seriesId = GASOLINE_SERIES,
    unitTitle = UNIT_TITLE,
    dataRows = [],
  } = options;

  return buildXls({
    sheets: [
      {
        name: sheetName,
        rows: [
          [textCell("Back to Contents"), textCell(`Data 1: ${unitTitle}`)],
          [textCell(sourcekeyLabel), textCell(seriesId)],
          [textCell("Date"), textCell(unitTitle)],
          ...dataRows,
        ],
      },
    ],
  });
}

describe("eiaDownloadUrl", () => {
  it("builds the EIA weekly history URL for a valid series ID", () => {
    expect(eiaDownloadUrl(GASOLINE_SERIES)).toBe(
      `https://www.eia.gov/dnav/pet/hist_xls/${GASOLINE_SERIES}w.xls`,
    );
  });

  it("throws for a malformed series ID", () => {
    expect(() => eiaDownloadUrl("bad id!")).toThrow();
  });
});

describe("parseEiaWorkbook on the recorded excerpts (R8.4)", () => {
  it("reads the gasoline excerpt's in-window points with the published values", () => {
    const { points, gaps } = parseEiaWorkbook(gasolineBytes, GASOLINE_SERIES);

    expect(valueAt(points, "2024-05-06")).toBe("3.643");
    expect(valueAt(points, "2024-11-04")).toBe("3.069");
    expect(valueAt(points, "2026-10-26")).toBe("4.269");
    expect(gaps).toEqual([]);
  });

  it("reads the diesel excerpt's in-window points with the published values", () => {
    const { points } = parseEiaWorkbook(dieselBytes, DIESEL_SERIES);

    expect(valueAt(points, "2024-05-06")).toBe("3.894");
    expect(valueAt(points, "2026-10-26")).toBe("6.352");
  });

  it("leaves out 2023-05-29 (before Coverage_Start) on both excerpts", () => {
    const gasoline = parseEiaWorkbook(gasolineBytes, GASOLINE_SERIES);
    const diesel = parseEiaWorkbook(dieselBytes, DIESEL_SERIES);

    expect(valueAt(gasoline.points, "2023-05-29")).toBeUndefined();
    expect(valueAt(diesel.points, "2023-05-29")).toBeUndefined();
    // The first row before the cut is 2023-06-05, which IS kept.
    expect(valueAt(gasoline.points, "2023-06-05")).toBe("3.541");
  });

  it("returns points ascending by period", () => {
    const { points } = parseEiaWorkbook(gasolineBytes, GASOLINE_SERIES);
    const periods = points.map((p) => p.period);
    const sorted = [...periods].sort();
    expect(periods).toEqual(sorted);
  });
});

describe("parseEiaWorkbook gap handling (R8.4)", () => {
  it("reports an empty value cell as a no_number gap and leaves it out of points", () => {
    const bytes = buildEiaXls({
      dataRows: [
        [serialCell(SERIAL_2023_06_05), numberCell(3.541, "0.000")],
        // 2023-06-12 has an empty value cell.
        [serialCell(SERIAL_2023_06_12), emptyCell()],
      ],
    });

    const { points, gaps } = parseEiaWorkbook(bytes, GASOLINE_SERIES);

    expect(valueAt(points, "2023-06-12")).toBeUndefined();
    expect(gaps).toContainEqual({ period: "2023-06-12", reason: "no_number" });
    expect(valueAt(points, "2023-06-05")).toBe("3.541");
  });

  it("reports a text value cell as a not_a_number gap and leaves it out of points", () => {
    const bytes = buildEiaXls({
      dataRows: [
        [serialCell(SERIAL_2023_06_05), numberCell(3.541, "0.000")],
        // 2023-06-12 holds text where a number should be.
        [serialCell(SERIAL_2023_06_12), textCell("NA")],
      ],
    });

    const { points, gaps } = parseEiaWorkbook(bytes, GASOLINE_SERIES);

    expect(valueAt(points, "2023-06-12")).toBeUndefined();
    expect(gaps).toContainEqual({ period: "2023-06-12", reason: "not_a_number" });
  });
});

describe("parseEiaWorkbook failure cases (R8.5)", () => {
  /** Run the parse and return the SourceError it threw, failing if it did not. */
  function parseError(bytes: Uint8Array, seriesId: string): SourceError {
    try {
      parseEiaWorkbook(bytes, seriesId);
    } catch (error) {
      expect(error).toBeInstanceOf(SourceError);
      return error as SourceError;
    }
    throw new Error("parseEiaWorkbook was expected to throw");
  }

  it("a wrong Sourcekey series ID is series_mismatch", () => {
    const bytes = buildEiaXls({ seriesId: "SOME_OTHER_SERIES" });
    const error = parseError(bytes, GASOLINE_SERIES);
    expect(error.kind).toBe("series_mismatch");
    expect(error.publisher).toBe("eia");
  });

  it("a missing Sourcekey label is series_mismatch", () => {
    const bytes = buildEiaXls({ sourcekeyLabel: "NotSourcekey" });
    expect(parseError(bytes, GASOLINE_SERIES).kind).toBe("series_mismatch");
  });

  it("a unit title that does not name the unit is unit_mismatch", () => {
    const bytes = buildEiaXls({
      unitTitle: "Weekly U.S. Regular All Formulations Retail Gasoline Prices",
    });
    expect(parseError(bytes, GASOLINE_SERIES).kind).toBe("unit_mismatch");
  });

  it("a missing `Data 1` sheet is sheet_missing", () => {
    const bytes = buildEiaXls({ sheetName: "Contents" });
    expect(parseError(bytes, GASOLINE_SERIES).kind).toBe("sheet_missing");
  });

  it("a text date cell with a numeric value is bad_date", () => {
    const bytes = buildEiaXls({
      dataRows: [
        // Column A holds text where a date serial should be; column B is a number.
        [textCell("Jun 05, 2023"), numberCell(3.541, "0.000")],
      ],
    });
    expect(parseError(bytes, GASOLINE_SERIES).kind).toBe("bad_date");
  });

  it("an out-of-range date serial is bad_date", () => {
    const bytes = buildEiaXls({
      dataRows: [
        // Serial 1 is below the accepted range; serialToDate throws -> bad_date.
        [serialCell(1), numberCell(3.541, "0.000")],
      ],
    });
    expect(parseError(bytes, GASOLINE_SERIES).kind).toBe("bad_date");
  });

  it("the same date twice is duplicate_date", () => {
    const bytes = buildEiaXls({
      dataRows: [
        [serialCell(SERIAL_2023_06_05), numberCell(3.541, "0.000")],
        [serialCell(SERIAL_2023_06_05), numberCell(3.595, "0.000")],
      ],
    });
    expect(parseError(bytes, GASOLINE_SERIES).kind).toBe("duplicate_date");
  });
});

describe("fetchEiaSeries through a stub Fetcher (R8.4)", () => {
  it("fetches and parses the gasoline excerpt, recording the URL and a UTC stamp", async () => {
    const { fetcher, calledWith } = bytesFetcher(gasolineBytes);

    const result = await fetchEiaSeries(GASOLINE_SERIES, { fetcher, now: fixedNow });

    expect(result.seriesId).toBe(GASOLINE_SERIES);
    expect(result.downloadUrl).toBe(
      `https://www.eia.gov/dnav/pet/hist_xls/${GASOLINE_SERIES}w.xls`,
    );
    expect(calledWith).toEqual([result.downloadUrl]);
    expect(valueAt(result.result.points, "2024-05-06")).toBe("3.643");
    expect(valueAt(result.result.points, "2026-10-26")).toBe("4.269");
    // The global fetch guard was never tripped.
    expect(fetchGuard).not.toHaveBeenCalled();
  });

  it("formats downloadedAt as YYYY-MM-DDTHH:MM:SSZ from the injected clock", async () => {
    const { fetcher } = bytesFetcher(gasolineBytes);

    const result = await fetchEiaSeries(GASOLINE_SERIES, { fetcher, now: fixedNow });

    expect(result.downloadedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    // Seconds precision, no milliseconds, UTC.
    expect(result.downloadedAt).toBe("2026-11-01T09:30:05Z");
  });

  it("maps a 401 to auth_required", async () => {
    try {
      await fetchEiaSeries(GASOLINE_SERIES, { fetcher: statusFetcher(401), now: fixedNow });
      expect.unreachable("fetchEiaSeries should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(SourceError);
      expect((error as SourceError).kind).toBe("auth_required");
    }
  });

  it("maps a 403 to auth_required", async () => {
    try {
      await fetchEiaSeries(GASOLINE_SERIES, { fetcher: statusFetcher(403), now: fixedNow });
      expect.unreachable("fetchEiaSeries should have thrown");
    } catch (error) {
      expect((error as SourceError).kind).toBe("auth_required");
    }
  });

  it("maps a 500 to http_status", async () => {
    try {
      await fetchEiaSeries(GASOLINE_SERIES, { fetcher: statusFetcher(500), now: fixedNow });
      expect.unreachable("fetchEiaSeries should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(SourceError);
      expect((error as SourceError).kind).toBe("http_status");
    }
  });
});
