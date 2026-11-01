// Example tests for the Oil_Bulletin_Adapter (04-real-figures, R8.4, R8.5).
//
// These drive the real link-finder and parser over the committed
// Recorded_Excerpts (the page HTML and the `Prices with taxes` workbook slice),
// and over small synthetic workbooks built in memory with the test-support
// writer for the shapes the excerpt does not contain (gaps, a 1904 workbook,
// duplicate dates, a wrong unit label, text in a date or value cell, a missing
// or repeated header key, a missing sheet). No test touches the network: a
// global `fetch` guard fails any unstubbed request, and `fetchBulletin` is
// always given a stub `Fetcher` returning recorded or in-memory bytes and a
// fixed clock (R2.6, R8.1).
//
// The expected cell strings below are written by hand from the publisher's
// displayed numbers in the excerpt (R8.4); every value the parser returns is
// the publisher's own bytes, never computed here.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SourceError } from "./errors";
import {
  BULLETIN_FILE_NAME,
  BULLETIN_PAGE,
  fetchBulletin,
  findBulletinLink,
  parseBulletinWorkbook,
  type BulletinKey,
} from "./oil-bulletin";
import type { FetchResult, Fetcher } from "./types";
import {
  buildXlsx,
  emptyCell,
  numberCell,
  serialCell,
  textCell,
  type CellSpec,
  type WorkbookDescription,
} from "./test-support/workbook";

// --- Recorded excerpts -----------------------------------------------------

const RECORDED_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "__recorded__",
);

/** The committed `Prices with taxes` workbook slice, as the parser reads it. */
const EXCERPT_XLSX = new Uint8Array(
  readFileSync(join(RECORDED_DIR, "oil-bulletin-prices-with-taxes.xlsx")),
);

/** The committed Bulletin landing-page slice, for the link-finder. */
const EXCERPT_HTML = readFileSync(
  join(RECORDED_DIR, "oil-bulletin-page.html"),
  "utf8",
);

/** The absolute workbook URL the link-finder resolves from the excerpt page. */
const RESOLVED_FILE_URL =
  "https://energy.ec.europa.eu/document/download/906e60ca-8b6a-44e7-8589-652854d2fd3f_en?filename=Weekly_Oil_Bulletin_Prices_History_maticni_4web.xlsx";

/** A fixed UTC clock so `downloadedAt` is deterministic. */
const FIXED_NOW = new Date("2026-11-01T11:04:04Z");
const now = () => FIXED_NOW;

const EURO95: BulletinKey = "EU_price_with_tax_euro95";
const DIESEL: BulletinKey = "EU_price_with_tax_diesel";

// --- Global fetch guard (R8.1) ---------------------------------------------

// Replace the global `fetch` with one that fails the test the instant it is
// called, so a code path that forgot its stub Fetcher cannot reach the network.
const realFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = (async () => {
    throw new Error("network access is not allowed in tests");
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

// --- Stub fetchers ---------------------------------------------------------

/**
 * A stub Fetcher that serves the recorded page for the Bulletin page URL and
 * the recorded workbook for the resolved file URL, and records every URL asked
 * for. Any other URL throws, so a wrong request surfaces as a test failure.
 */
function recordedFetcher(): { fetcher: Fetcher; calledWith: string[] } {
  const calledWith: string[] = [];
  const fetcher: Fetcher = async (url: string): Promise<FetchResult> => {
    calledWith.push(url);
    if (url === BULLETIN_PAGE) {
      return {
        status: 200,
        url: BULLETIN_PAGE,
        body: new TextEncoder().encode(EXCERPT_HTML),
      };
    }
    if (url === RESOLVED_FILE_URL) {
      return { status: 200, url: RESOLVED_FILE_URL, body: EXCERPT_XLSX };
    }
    throw new Error(`unexpected URL requested: ${url}`);
  };
  return { fetcher, calledWith };
}

/**
 * A stub Fetcher that serves the given HTML for the page and the given workbook
 * bytes for the resolved file URL. Used to inject an in-memory workbook or a
 * damaged page into the full `fetchBulletin` flow.
 */
function fetcherWith(options: {
  html?: string;
  pageStatus?: number;
  fileBytes?: Uint8Array;
  fileStatus?: number;
  fileFinalUrl?: string;
}): Fetcher {
  const html = options.html ?? EXCERPT_HTML;
  return async (url: string): Promise<FetchResult> => {
    if (url === BULLETIN_PAGE) {
      return {
        status: options.pageStatus ?? 200,
        url: BULLETIN_PAGE,
        body: new TextEncoder().encode(html),
      };
    }
    if (url === RESOLVED_FILE_URL) {
      return {
        status: options.fileStatus ?? 200,
        url: options.fileFinalUrl ?? RESOLVED_FILE_URL,
        body: options.fileBytes ?? EXCERPT_XLSX,
      };
    }
    throw new Error(`unexpected URL requested: ${url}`);
  };
}

// --- Synthetic Bulletin workbook -------------------------------------------

// A clearly-fake Bulletin-shaped workbook, built in memory with the parser's
// own writer. Row 1 holds the header keys, row 3 the `Date`/unit labels, and
// rows 4+ hold `EU_` data rows. Every number here is invented in the test and
// never reaches a figure (data-integrity.md). Overrides let one test change a
// single part (a unit label, a value cell, the sheet name, the date system).

/** The `Euro-super 95` serial for an in-window Monday, and the diesel pair. */
const ROW_A = 46321; // 2026-10-26
const ROW_B = 46314; // 2026-10-19

interface SyntheticOptions {
  sheetName?: string;
  euro95Header?: string;
  dieselHeader?: string;
  euro95Unit?: string;
  dieselUnit?: string;
  date1904?: boolean;
  /** Replace the data rows entirely (each a full A..D CellSpec row). */
  dataRows?: CellSpec[][];
  /** Duplicate a second header-key column for one of the keys. */
  duplicateKey?: BulletinKey;
}

function syntheticWorkbook(options: SyntheticOptions = {}): Uint8Array {
  const euro95Header = options.euro95Header ?? EURO95;
  const dieselHeader = options.dieselHeader ?? DIESEL;
  const euro95Unit = options.euro95Unit ?? "1000 l";
  const dieselUnit = options.dieselUnit ?? "1000 l";

  const headerRow: CellSpec[] = [
    textCell("Consumer prices of petroleum products inclusive of duties and taxes"),
    textCell("CTR"),
    textCell(euro95Header),
    textCell(dieselHeader),
  ];
  if (options.duplicateKey !== undefined) {
    headerRow.push(textCell(options.duplicateKey));
  }

  const productRow: CellSpec[] = [
    emptyCell(),
    emptyCell(),
    textCell("Euro-super 95  (I)"),
    textCell("Gas oil automobile Automotive gas oil Dieselkraftstoff (I)"),
  ];
  const unitRow: CellSpec[] = [
    textCell("Date"),
    emptyCell(),
    textCell(euro95Unit),
    textCell(dieselUnit),
  ];

  const dataRows: CellSpec[][] = options.dataRows ?? [
    [serialCell(ROW_A, "dd/mm/yy"), textCell("EU_"), numberCell(1954.04), numberCell(2146.19)],
    [serialCell(ROW_B, "dd/mm/yy"), textCell("EU_"), numberCell(1991.33), numberCell(2138.68)],
  ];

  const description: WorkbookDescription = {
    sheets: [
      {
        name: options.sheetName ?? "Prices with taxes",
        rows: [headerRow, productRow, unitRow, ...dataRows],
      },
    ],
  };
  if (options.date1904 === true) {
    description.date1904 = true;
  }
  return buildXlsx(description);
}

/** Expect a thrown SourceError of the given kind. */
async function expectKind(
  run: () => Promise<unknown> | unknown,
  kind: string,
): Promise<SourceError> {
  try {
    await run();
  } catch (err) {
    expect(err).toBeInstanceOf(SourceError);
    expect((err as SourceError).kind).toBe(kind);
    return err as SourceError;
  }
  throw new Error(`expected a SourceError of kind "${kind}", none thrown`);
}

// ---------------------------------------------------------------------------

describe("findBulletinLink over the recorded page (R8.4)", () => {
  it("picks exactly one history-workbook link", () => {
    const link = findBulletinLink(EXCERPT_HTML, BULLETIN_PAGE);
    expect(link).toBe(RESOLVED_FILE_URL);
    expect(new URL(link).searchParams.get("filename")).toBe(BULLETIN_FILE_NAME);
  });

  it("is link_not_found when the page carries no matching link", () => {
    const html = `<a href="/document/download/x_en?filename=Other.xlsx">x</a>`;
    expect(() => findBulletinLink(html, BULLETIN_PAGE)).toThrowError(SourceError);
    try {
      findBulletinLink(html, BULLETIN_PAGE);
    } catch (err) {
      expect((err as SourceError).kind).toBe("link_not_found");
    }
  });

  it("is link_not_found when the page carries two matching links", () => {
    const one = `/document/download/a_en?filename=${BULLETIN_FILE_NAME}`;
    const two = `/document/download/b_en?filename=${BULLETIN_FILE_NAME}`;
    const html = `<a href="${one}">a</a><a href="${two}">b</a>`;
    try {
      findBulletinLink(html, BULLETIN_PAGE);
      throw new Error("expected link_not_found");
    } catch (err) {
      expect(err).toBeInstanceOf(SourceError);
      expect((err as SourceError).kind).toBe("link_not_found");
    }
  });
});

describe("fetchBulletin over the recorded excerpts (R8.4)", () => {
  it("returns the two EU series with the publisher's exact values", async () => {
    const { fetcher, calledWith } = recordedFetcher();

    const result = await fetchBulletin({ fetcher, now });

    // Both requests went through the stub, page first then workbook.
    expect(calledWith).toEqual([BULLETIN_PAGE, RESOLVED_FILE_URL]);
    expect(result.pageUrl).toBe(BULLETIN_PAGE);
    expect(result.downloadUrl).toBe(RESOLVED_FILE_URL);
    expect(result.downloadedAt).toBe("2026-11-01T11:04:04Z");

    // The header keys were found in columns C and D (reported, not used).
    expect(result.columns).toEqual({ [EURO95]: "C", [DIESEL]: "D" });

    // Euro-super 95: ascending by period, with the hand-written expected
    // decimal strings. The most recent cell stores 1954.0378712134029 and the
    // rule returns its shortest round-trip form.
    expect(result.series[EURO95].points).toEqual([
      { period: "2023-06-05", value: "1711.9476883475709" },
      { period: "2024-05-06", value: "1791.3149889844324" },
      { period: "2024-11-04", value: "1629.2663410422444" },
      { period: "2026-10-12", value: "2009.6736867623586" },
      { period: "2026-10-19", value: "1991.3323259570577" },
      { period: "2026-10-26", value: "1954.037871213403" },
    ]);
    expect(result.series[EURO95].gaps).toEqual([]);

    // Automotive diesel.
    expect(result.series[DIESEL].points).toEqual([
      { period: "2023-06-05", value: "1533.7807458860927" },
      { period: "2024-05-06", value: "1645.194212158339" },
      { period: "2024-11-04", value: "1524.580178432713" },
      { period: "2026-10-12", value: "2135.720907391608" },
      { period: "2026-10-19", value: "2138.6756134933908" },
      { period: "2026-10-26", value: "2146.185973890054" },
    ]);
    expect(result.series[DIESEL].gaps).toEqual([]);
  });

  it("leaves out 2023-05-29, which is before Coverage_Start", async () => {
    const { fetcher } = recordedFetcher();
    const result = await fetchBulletin({ fetcher, now });

    const periods = result.series[EURO95].points.map((p) => p.period);
    expect(periods).not.toContain("2023-05-29");
    expect(periods[0]).toBe("2023-06-05");
    // The excerpt has seven dated rows; one (2023-05-29) is out of window, so
    // six remain in each series.
    expect(result.series[EURO95].points).toHaveLength(6);
    expect(result.series[DIESEL].points).toHaveLength(6);
  });

  it("reports the euro95 2026-10-26 and diesel cells exactly", async () => {
    const { fetcher } = recordedFetcher();
    const result = await fetchBulletin({ fetcher, now });

    const euro = result.series[EURO95].points.find(
      (p) => p.period === "2026-10-26",
    );
    const diesel = result.series[DIESEL].points.find(
      (p) => p.period === "2026-10-26",
    );
    expect(euro?.value).toBe("1954.037871213403");
    expect(diesel?.value).toBe("2146.185973890054");
  });
});

describe("gaps are reported and left out (R8.4, Property 4 examples)", () => {
  // Build a baseline in memory, then damage one value cell: the damaged period
  // moves to `gaps` with the right reason, the other periods are unchanged, and
  // no value is borrowed from a neighbour.
  it("an empty value cell is a no_number gap", () => {
    const damaged = syntheticWorkbook({
      dataRows: [
        [serialCell(ROW_A, "dd/mm/yy"), textCell("EU_"), emptyCell(), numberCell(2146.19)],
        [serialCell(ROW_B, "dd/mm/yy"), textCell("EU_"), numberCell(1991.33), numberCell(2138.68)],
      ],
    });
    const { series } = parseBulletinWorkbook(damaged);

    expect(series[EURO95].gaps).toEqual([
      { period: "2026-10-26", reason: "no_number" },
    ]);
    expect(series[EURO95].points.map((p) => p.period)).toEqual(["2026-10-19"]);
    // The surviving euro95 point keeps its own value, not the diesel neighbour.
    expect(series[EURO95].points[0].value).toBe("1991.33");
    // Diesel is untouched.
    expect(series[DIESEL].gaps).toEqual([]);
    expect(series[DIESEL].points).toHaveLength(2);
  });

  it("a text value cell is a not_a_number gap", () => {
    const damaged = syntheticWorkbook({
      dataRows: [
        [serialCell(ROW_A, "dd/mm/yy"), textCell("EU_"), textCell("n/a"), numberCell(2146.19)],
        [serialCell(ROW_B, "dd/mm/yy"), textCell("EU_"), numberCell(1991.33), numberCell(2138.68)],
      ],
    });
    const { series } = parseBulletinWorkbook(damaged);

    expect(series[EURO95].gaps).toEqual([
      { period: "2026-10-26", reason: "not_a_number" },
    ]);
    expect(series[EURO95].points.map((p) => p.period)).toEqual(["2026-10-19"]);
    expect(series[DIESEL].gaps).toEqual([]);
  });
});

describe("failure examples (R8.5)", () => {
  it("missing sheet -> sheet_missing", async () => {
    const bytes = syntheticWorkbook({ sheetName: "Something else" });
    await expectKind(
      () => fetchBulletin({ fetcher: fetcherWith({ fileBytes: bytes }), now }),
      "sheet_missing",
    );
  });

  it("missing header key -> header_missing", async () => {
    const bytes = syntheticWorkbook({ euro95Header: "EU_price_with_tax_other" });
    await expectKind(() => parseBulletinWorkbook(bytes), "header_missing");
  });

  it("repeated header key -> header_duplicated", async () => {
    const bytes = syntheticWorkbook({ duplicateKey: EURO95 });
    await expectKind(() => parseBulletinWorkbook(bytes), "header_duplicated");
  });

  it("unit label '1000 m' -> unit_mismatch", async () => {
    const bytes = syntheticWorkbook({ euro95Unit: "1000 m" });
    const err = await expectKind(
      () => parseBulletinWorkbook(bytes),
      "unit_mismatch",
    );
    expect(err.detail.foundUnit).toBe("1000 m");
  });

  it("text in a date cell (with a numeric value cell) -> bad_date", async () => {
    const bytes = syntheticWorkbook({
      dataRows: [
        [textCell("not a date"), textCell("EU_"), numberCell(1954.04), numberCell(2146.19)],
      ],
    });
    await expectKind(() => parseBulletinWorkbook(bytes), "bad_date");
  });

  it("the same date twice -> duplicate_date", async () => {
    const bytes = syntheticWorkbook({
      dataRows: [
        [serialCell(ROW_A, "dd/mm/yy"), textCell("EU_"), numberCell(1954.04), numberCell(2146.19)],
        [serialCell(ROW_A, "dd/mm/yy"), textCell("EU_"), numberCell(1955.0), numberCell(2147.0)],
      ],
    });
    const err = await expectKind(
      () => parseBulletinWorkbook(bytes),
      "duplicate_date",
    );
    expect(err.detail.date).toBe("2026-10-26");
  });

  it("a 1904 date-system workbook -> date_system", async () => {
    const bytes = syntheticWorkbook({ date1904: true });
    await expectKind(() => parseBulletinWorkbook(bytes), "date_system");
  });

  it("column B not 'EU_' on an in-window row -> bad_row_marker", async () => {
    const bytes = syntheticWorkbook({
      dataRows: [
        [serialCell(ROW_A, "dd/mm/yy"), textCell("DE_"), numberCell(1954.04), numberCell(2146.19)],
      ],
    });
    const err = await expectKind(
      () => parseBulletinWorkbook(bytes),
      "bad_row_marker",
    );
    expect(err.detail.marker).toBe("DE_");
  });

  it("a page with zero matching links -> link_not_found", async () => {
    const html = `<a href="/document/download/x_en?filename=Nope.xlsx">x</a>`;
    await expectKind(
      () => fetchBulletin({ fetcher: fetcherWith({ html }), now }),
      "link_not_found",
    );
  });

  it("a page with two matching links -> link_not_found", async () => {
    const html =
      `<a href="/document/download/a_en?filename=${BULLETIN_FILE_NAME}">a</a>` +
      `<a href="/document/download/b_en?filename=${BULLETIN_FILE_NAME}">b</a>`;
    await expectKind(
      () => fetchBulletin({ fetcher: fetcherWith({ html }), now }),
      "link_not_found",
    );
  });

  it("a 403 page response -> auth_required", async () => {
    await expectKind(
      () => fetchBulletin({ fetcher: fetcherWith({ pageStatus: 403 }), now }),
      "auth_required",
    );
  });

  it("a 500 workbook response -> http_status", async () => {
    await expectKind(
      () => fetchBulletin({ fetcher: fetcherWith({ fileStatus: 500 }), now }),
      "http_status",
    );
  });

  it("a workbook that redirects to another host -> wrong_host", async () => {
    await expectKind(
      () =>
        fetchBulletin({
          fetcher: fetcherWith({ fileFinalUrl: "https://example.com/evil.xlsx" }),
          now,
        }),
      "wrong_host",
    );
  });
});
