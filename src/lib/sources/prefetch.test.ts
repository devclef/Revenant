// Example tests for the Prefetch_Script core (spec 04-real-figures, task 5).
//
// These drive `runPrefetch` end to end over a stub `Fetcher` that returns the
// committed Recorded_Excerpts (the two EIA `.xls` files, the Oil Bulletin page
// HTML and the `Prices with taxes` workbook slice, all read from disk with
// `node:fs`) and a fixed clock. No test touches the network: a global `fetch`
// guard fails the suite the instant any code path reaches the wire, and
// `runPrefetch` is always given a stub Fetcher and a fixed `now` (R2.6, R8.1).
//
// Every expected value here is the publisher's own byte, written by hand from
// the numbers the EIA and Oil Bulletin excerpts carry (the same values the
// adapter tests assert), never recomputed from the file. Where a shape the
// excerpts do not contain is needed — a revision, a gap, a backfill, a
// column-letter mismatch, a coverage failure, a file that fails loadFigureFile
// — a clearly-fake in-memory workbook built with the test-support writer is
// injected instead, so no invented number is ever presented as real
// (data-integrity.md).
//
// Every printed report line and every thrown error message is scanned for the
// banned direction words (rose, fell, improved, worsened, corrected, revised):
// the Prefetch_Script must stay as neutral as the layers it drives
// (neutrality.md).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CATALOGUE, FigureDataError, loadFigureFile } from "@/lib/figures";

import { SourceError } from "./errors";
import {
  BULLETIN_PAGE,
  BULLETIN_FILE_NAME,
  type BulletinKey,
} from "./oil-bulletin";
import { formatReportLine, type Report } from "./refresh";
import { PrefetchError, runPrefetch } from "./prefetch";
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

// --- Recorded excerpts, read from disk as bytes (R8.4) ---------------------

const RECORDED_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "__recorded__",
);

function readExcerpt(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(RECORDED_DIR, name)));
}

const GASOLINE_BYTES = readExcerpt("eia-gasoline.xls");
const DIESEL_BYTES = readExcerpt("eia-diesel.xls");
const BULLETIN_XLSX = new Uint8Array(
  readFileSync(join(RECORDED_DIR, "oil-bulletin-prices-with-taxes.xlsx")),
);
const BULLETIN_HTML = readFileSync(
  join(RECORDED_DIR, "oil-bulletin-page.html"),
  "utf8",
);

// --- Catalogue metric ids and series URLs ----------------------------------

const GASOLINE = "us-gasoline-regular";
const DIESEL = "us-diesel";
const PETROL = "eu-petrol-euro95";
const EU_DIESEL = "eu-diesel";

const GASOLINE_SERIES = "EMM_EPMR_PTE_NUS_DPG";
const DIESEL_SERIES = "EMD_EPD2D_PTE_NUS_DPG";

const GASOLINE_URL = `https://www.eia.gov/dnav/pet/hist_xls/${GASOLINE_SERIES}w.xls`;
const DIESEL_URL = `https://www.eia.gov/dnav/pet/hist_xls/${DIESEL_SERIES}w.xls`;

/** The absolute workbook URL the link-finder resolves from the excerpt page. */
const RESOLVED_FILE_URL =
  "https://energy.ec.europa.eu/document/download/906e60ca-8b6a-44e7-8589-652854d2fd3f_en?filename=Weekly_Oil_Bulletin_Prices_History_maticni_4web.xlsx";

const EURO95: BulletinKey = "EU_price_with_tax_euro95";
const EU_DIESEL_KEY: BulletinKey = "EU_price_with_tax_diesel";

/** A fixed UTC clock so retrieved_at / downloadedAt are deterministic. */
const FIXED_NOW = new Date("2026-11-01T12:00:00Z");
const FIXED_STAMP = "2026-11-01T12:00:00Z";
const fixedNow = (): Date => FIXED_NOW;

// --- Global fetch guard (R8.1) ---------------------------------------------

const realFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = (async () => {
    throw new Error("network access is not allowed in the prefetch tests");
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

// --- Banned direction words -------------------------------------------------

const BANNED_WORDS = [
  "rose",
  "fell",
  "improved",
  "worsened",
  "corrected",
  "revised",
] as const;

function assertNoBannedWords(text: string): void {
  const lower = text.toLowerCase();
  for (const word of BANNED_WORDS) {
    expect(lower).not.toContain(word);
  }
}

/** Format every line a report would print and scan them all for banned words. */
function assertReportNeutral(report: Report): void {
  for (const s of report.perSeries) {
    assertNoBannedWords(
      formatReportLine({
        kind: "added",
        metricId: s.metricId,
        added: s.added,
        first: s.first,
        last: s.last,
      }),
    );
  }
  for (const r of report.revisions) {
    assertNoBannedWords(formatReportLine({ kind: "revision", ...r }));
  }
  for (const g of report.gaps) {
    assertNoBannedWords(formatReportLine({ kind: "gap", ...g }));
  }
  for (const m of report.missingFromSource) {
    assertNoBannedWords(formatReportLine({ kind: "missing-from-source", ...m }));
  }
  for (const b of report.backfills) {
    assertNoBannedWords(formatReportLine({ kind: "backfill", ...b }));
  }
}

// --- Stub fetchers ----------------------------------------------------------

/**
 * A stub Fetcher that serves the recorded bytes for every URL `runPrefetch`
 * asks for: the two EIA workbooks, the Bulletin page, and the resolved Bulletin
 * workbook. The Bulletin workbook bytes can be overridden (to inject an
 * in-memory workbook), as can a per-URL status (to force an adapter failure).
 * Any other URL throws, so a wrong request surfaces as a test failure.
 */
function recordedFetcher(options: {
  bulletinBytes?: Uint8Array;
  gasolineStatus?: number;
  dieselStatus?: number;
} = {}): { fetcher: Fetcher; calledWith: string[] } {
  const calledWith: string[] = [];
  const bulletinBytes = options.bulletinBytes ?? BULLETIN_XLSX;

  const fetcher: Fetcher = async (url: string): Promise<FetchResult> => {
    calledWith.push(url);
    if (url === GASOLINE_URL) {
      return {
        status: options.gasolineStatus ?? 200,
        url,
        body: GASOLINE_BYTES,
      };
    }
    if (url === DIESEL_URL) {
      return { status: options.dieselStatus ?? 200, url, body: DIESEL_BYTES };
    }
    if (url === BULLETIN_PAGE) {
      return {
        status: 200,
        url: BULLETIN_PAGE,
        body: new TextEncoder().encode(BULLETIN_HTML),
      };
    }
    if (url === RESOLVED_FILE_URL) {
      return { status: 200, url: RESOLVED_FILE_URL, body: bulletinBytes };
    }
    throw new Error(`unexpected URL requested: ${url}`);
  };

  return { fetcher, calledWith };
}

// --- Synthetic Bulletin workbook (clearly fake) -----------------------------

// A clearly-fake Bulletin-shaped workbook, built with the parser's own writer.
// Row 1 holds the header keys, row 3 the Date/unit labels, rows 4+ the `EU_`
// data rows. Every number here is invented in the test and never reaches a
// figure (data-integrity.md). Overrides let one test move a header key to a
// different column (the column-letter mismatch), damage a value cell (a gap),
// or change the earliest period (the coverage failure).

interface SyntheticOptions {
  /** Put the euro95 key in column B so its found letter is not C. */
  euro95InColumnB?: boolean;
  /** Replace the data rows entirely (each a full A..D CellSpec row). */
  dataRows?: CellSpec[][];
}

/** The real in-window Mondays as 1900 date-system serials. */
const SERIAL_2023_06_05 = 45082;
const SERIAL_2023_06_12 = 45089;
const SERIAL_2024_05_06 = 45418;
const SERIAL_2024_11_04 = 45600;
const SERIAL_2026_10_19 = 46314;
const SERIAL_2026_10_26 = 46321;

/** A full six-week synthetic data set reaching back to Coverage_Start, so the
 *  coverage check passes. Values are clearly-fake round strings. */
function syntheticDataRows(): CellSpec[][] {
  const row = (serial: number, euro: number, diesel: number): CellSpec[] => [
    serialCell(serial, "dd/mm/yy"),
    textCell("EU_"),
    numberCell(euro),
    numberCell(diesel),
  ];
  return [
    row(SERIAL_2023_06_05, 1700.0, 1500.0),
    row(SERIAL_2023_06_12, 1710.0, 1510.0),
    row(SERIAL_2024_05_06, 1790.0, 1640.0),
    row(SERIAL_2024_11_04, 1620.0, 1520.0),
    row(SERIAL_2026_10_19, 1990.0, 2130.0),
    row(SERIAL_2026_10_26, 1950.0, 2140.0),
  ];
}

function syntheticBulletin(options: SyntheticOptions = {}): Uint8Array {
  // Header row: by default euro95 in column C, diesel in column D. When
  // euro95InColumnB is set, euro95 moves to column B and the marker-ish CTR
  // column is dropped, so the adapter finds euro95 in B (letter mismatch vs
  // the catalogue's declared C).
  const headerRow: CellSpec[] = options.euro95InColumnB
    ? [
        textCell(
          "Consumer prices of petroleum products inclusive of duties and taxes",
        ),
        textCell(EURO95),
        emptyCell(),
        textCell(EU_DIESEL_KEY),
      ]
    : [
        textCell(
          "Consumer prices of petroleum products inclusive of duties and taxes",
        ),
        textCell("CTR"),
        textCell(EURO95),
        textCell(EU_DIESEL_KEY),
      ];

  const productRow: CellSpec[] = options.euro95InColumnB
    ? [
        emptyCell(),
        textCell("Euro-super 95  (I)"),
        emptyCell(),
        textCell("Gas oil automobile Automotive gas oil Dieselkraftstoff (I)"),
      ]
    : [
        emptyCell(),
        emptyCell(),
        textCell("Euro-super 95  (I)"),
        textCell("Gas oil automobile Automotive gas oil Dieselkraftstoff (I)"),
      ];

  // Row 3: the `Date` label in column A, `1000 l` units under each value
  // column. When euro95 is in column B, the column-letter check runs and
  // fails before any data row is read, so the data rows below never matter in
  // that case — a single header-only layout still exercises the check.
  const unitRow: CellSpec[] = options.euro95InColumnB
    ? [textCell("Date"), textCell("1000 l"), emptyCell(), textCell("1000 l")]
    : [textCell("Date"), emptyCell(), textCell("1000 l"), textCell("1000 l")];

  const dataRows: CellSpec[][] = options.dataRows ?? syntheticDataRows();

  const description: WorkbookDescription = {
    sheets: [
      {
        name: "Prices with taxes",
        rows: [headerRow, productRow, unitRow, ...dataRows],
      },
    ],
  };
  return buildXlsx(description);
}

// --- Helpers ----------------------------------------------------------------

/** The count of figures added for a metric, read from a report's perSeries. */
function addedFor(report: Report, metricId: string): number {
  return report.perSeries.find((s) => s.metricId === metricId)?.added ?? 0;
}

/** Run runPrefetch and return the PrefetchError it threw, or fail. */
async function prefetchError(
  existingJson: unknown | null,
  deps: { fetcher: Fetcher; now: () => Date },
): Promise<PrefetchError> {
  try {
    await runPrefetch(existingJson, deps);
  } catch (error) {
    expect(error).toBeInstanceOf(PrefetchError);
    return error as PrefetchError;
  }
  throw new Error("runPrefetch was expected to throw a PrefetchError");
}

// ---------------------------------------------------------------------------
// First run from no existing file.
// ---------------------------------------------------------------------------

describe("runPrefetch — first run from no existing file (R8.4)", () => {
  it("adds every in-window period per series, stamps retrieved_at from the clock, and the text loads", async () => {
    const { fetcher, calledWith } = recordedFetcher();

    const { text, report } = await runPrefetch(null, { fetcher, now: fixedNow });

    // All four downloads went through the stub (two EIA, the Bulletin page,
    // then the resolved workbook), no network.
    expect(calledWith).toEqual([
      GASOLINE_URL,
      DIESEL_URL,
      BULLETIN_PAGE,
      RESOLVED_FILE_URL,
    ]);

    // The EIA excerpts keep five in-window dated rows (2023-06-05, 2023-06-12,
    // 2024-05-06, 2024-11-04, 2026-10-26; 2023-05-29 is before Coverage_Start
    // and dropped). The Bulletin excerpt keeps a sixth, 2026-10-12. So each EIA
    // series adds five on the first run and each EU series adds six.
    expect(addedFor(report, GASOLINE)).toBe(5);
    expect(addedFor(report, DIESEL)).toBe(5);
    expect(addedFor(report, PETROL)).toBe(6);
    expect(addedFor(report, EU_DIESEL)).toBe(6);
    expect(report.backfills).toHaveLength(0);

    // The returned text parses and loads against the live catalogue.
    const loaded = loadFigureFile(JSON.parse(text), CATALOGUE);
    expect(loaded.fixture).toBe(false);

    // Every added figure's retrieved_at is the fixed clock, to the second.
    for (const series of loaded.series.values()) {
      for (const fig of series.figures) {
        expect(fig.retrieved_at).toBe(FIXED_STAMP);
      }
    }

    // A known published value survives the round-trip exactly (R8.4): the
    // gasoline 2026-10-26 point is 4.269 as EIA displays it.
    const gasoline = loaded.series.get(GASOLINE);
    const point = gasoline?.figures.find((f) => f.period === "2026-10-26");
    expect(point?.value).toBe("4.269");

    assertReportNeutral(report);
    assertNoBannedWords(text);
  });
});

// ---------------------------------------------------------------------------
// A second run over the file the first wrote.
// ---------------------------------------------------------------------------

describe("runPrefetch — a second run over the written file", () => {
  it("is a no-op: byte-identical text and nothing added", async () => {
    const first = await runPrefetch(null, {
      fetcher: recordedFetcher().fetcher,
      now: fixedNow,
    });

    const second = await runPrefetch(JSON.parse(first.text), {
      fetcher: recordedFetcher().fetcher,
      now: fixedNow,
    });

    // The file is unchanged to the byte.
    expect(second.text).toBe(first.text);
    // Nothing was added, no backfill, no revision.
    expect(second.report.perSeries).toHaveLength(0);
    expect(second.report.revisions).toHaveLength(0);
    expect(second.report.backfills).toHaveLength(0);
    assertReportNeutral(second.report);
  });
});

// ---------------------------------------------------------------------------
// A source revision: a differing value is reported and the stored one kept.
// ---------------------------------------------------------------------------

describe("runPrefetch — a differing value is a revision and is kept", () => {
  it("reports the revision and carries the committed value through unchanged", async () => {
    const first = await runPrefetch(null, {
      fetcher: recordedFetcher().fetcher,
      now: fixedNow,
    });

    // Hand-edit one committed gasoline value so the next run sees the source
    // show a different number for a period already on file. The edit is a
    // clearly-fake string; only the comparison matters.
    const file = JSON.parse(first.text) as {
      figures: { metric_id: string; period: string; value: string }[];
    };
    const target = file.figures.find(
      (f) => f.metric_id === GASOLINE && f.period === "2026-10-26",
    );
    expect(target).toBeDefined();
    const committed = "9.999";
    (target as { value: string }).value = committed;

    const second = await runPrefetch(file, {
      fetcher: recordedFetcher().fetcher,
      now: fixedNow,
    });

    // The source value (4.269) differs from the edited committed value, so it
    // is reported as a revision and nothing is added for that period.
    expect(second.report.revisions).toContainEqual({
      metricId: GASOLINE,
      period: "2026-10-26",
      committed,
      source: "4.269",
    });

    // The written file keeps the committed value; the source value is not
    // substituted in.
    const loaded = loadFigureFile(JSON.parse(second.text), CATALOGUE);
    const point = loaded.series
      .get(GASOLINE)
      ?.figures.find((f) => f.period === "2026-10-26");
    expect(point?.value).toBe(committed);

    assertReportNeutral(second.report);
    assertNoBannedWords(second.text);
  });
});

// ---------------------------------------------------------------------------
// A source gap is reported.
// ---------------------------------------------------------------------------

describe("runPrefetch — a source gap is reported", () => {
  it("reports a period the source dropped as missing-from-source and keeps the committed figure", async () => {
    // First run from a synthetic Bulletin so a later run can drop one of its
    // weeks. Build a baseline over the six synthetic weeks for every series.
    const baseline = await runPrefetch(null, {
      fetcher: recordedFetcher({ bulletinBytes: syntheticBulletin() }).fetcher,
      now: fixedNow,
    });

    // Second run: the Bulletin now has an empty euro95 value cell at
    // 2026-10-26 (a gap), so that period is absent from the fresh points. The
    // committed figure stays; it is reported missing-from-source, not revised.
    const gapRows = syntheticDataRows();
    // 2026-10-26 is the last synthetic row; empty its euro95 (column C) cell.
    gapRows[gapRows.length - 1] = [
      serialCell(SERIAL_2026_10_26, "dd/mm/yy"),
      textCell("EU_"),
      emptyCell(),
      numberCell(2140.0),
    ];

    const second = await runPrefetch(JSON.parse(baseline.text), {
      fetcher: recordedFetcher({
        bulletinBytes: syntheticBulletin({ dataRows: gapRows }),
      }).fetcher,
      now: fixedNow,
    });

    expect(second.report.missingFromSource).toContainEqual({
      metricId: PETROL,
      period: "2026-10-26",
    });
    // The committed euro95 2026-10-26 figure is still present.
    const loaded = loadFigureFile(JSON.parse(second.text), CATALOGUE);
    const point = loaded.series
      .get(PETROL)
      ?.figures.find((f) => f.period === "2026-10-26");
    expect(point).toBeDefined();

    assertReportNeutral(second.report);
  });
});

// ---------------------------------------------------------------------------
// A backfill fails the run.
// ---------------------------------------------------------------------------

describe("runPrefetch — a backfill throws PrefetchError kind backfill", () => {
  it("fails the whole run and carries the merge report", async () => {
    // Produce a real first-run file, then rewrite it to hold, for gasoline, a
    // SINGLE figure at a period LATER than any the excerpt reaches. Every real
    // excerpt gasoline period (2023-06-05 … 2026-10-26) is then both new to the
    // file and earlier than that latest period — a backfill. The other series
    // keep their figures so only gasoline triggers the refusal.
    const baseline = await runPrefetch(null, {
      fetcher: recordedFetcher().fetcher,
      now: fixedNow,
    });
    const file = JSON.parse(baseline.text) as {
      figures: { metric_id: string; period: string }[];
    };
    // Take one real gasoline figure as a schema-valid template, move it to a
    // far-future Monday, and make it the only gasoline figure on file.
    const template = file.figures.find(
      (f) => f.metric_id === GASOLINE && f.period === "2026-10-26",
    );
    expect(template).toBeDefined();
    const future = { ...(template as object), period: "2027-01-04" };
    file.figures = [
      ...file.figures.filter((f) => f.metric_id !== GASOLINE),
      future as typeof file.figures[number],
    ];

    const error = await prefetchError(file, {
      fetcher: recordedFetcher().fetcher,
      now: fixedNow,
    });

    expect(error.kind).toBe("backfill");
    // The merge report is carried so the entry can still print what it found.
    expect(error.report).not.toBeNull();
    const report = error.report as Report;
    expect(report.backfills.length).toBeGreaterThan(0);
    // Every reported backfill is for gasoline, against the future latest.
    for (const b of report.backfills) {
      expect(b.metricId).toBe(GASOLINE);
      expect(b.latest).toBe("2027-01-04");
    }
    assertNoBannedWords(error.message);
    assertReportNeutral(report);
  });
});

// ---------------------------------------------------------------------------
// An adapter failure propagates a SourceError.
// ---------------------------------------------------------------------------

describe("runPrefetch — an adapter failure propagates SourceError", () => {
  it("a 500 on the gasoline download throws SourceError, not PrefetchError", async () => {
    const { fetcher } = recordedFetcher({ gasolineStatus: 500 });
    await expect(runPrefetch(null, { fetcher, now: fixedNow })).rejects.toThrow(
      SourceError,
    );
    try {
      await runPrefetch(null, { fetcher, now: fixedNow });
    } catch (error) {
      expect(error).toBeInstanceOf(SourceError);
      expect((error as SourceError).kind).toBe("http_status");
      expect((error as SourceError).publisher).toBe("eia");
      assertNoBannedWords((error as SourceError).message);
    }
  });
});

// ---------------------------------------------------------------------------
// A column-letter mismatch throws column_letter.
// ---------------------------------------------------------------------------

describe("runPrefetch — a column-letter mismatch throws column_letter", () => {
  it("fails before any merge when the source finds a Bulletin key in a different column than the catalogue declares", async () => {
    // The catalogue declares euro95 in column C. This synthetic workbook puts
    // it in column B, so the adapter reports B and the check fails.
    const { fetcher } = recordedFetcher({
      bulletinBytes: syntheticBulletin({ euro95InColumnB: true }),
    });

    const error = await prefetchError(null, { fetcher, now: fixedNow });

    expect(error.kind).toBe("column_letter");
    // No merge happened, so no report is carried.
    expect(error.report).toBeNull();
    assertNoBannedWords(error.message);
  });
});

// ---------------------------------------------------------------------------
// A coverage failure throws coverage.
// ---------------------------------------------------------------------------

describe("runPrefetch — a series that starts too late throws coverage", () => {
  it("fails when a series' earliest period is after the required coverage date", async () => {
    // A synthetic Bulletin whose earliest period is 2024-05-06, well after
    // 2023-06-07, so the EU series do not reach the coverage window.
    const lateRows: CellSpec[][] = [
      [
        serialCell(SERIAL_2024_05_06, "dd/mm/yy"),
        textCell("EU_"),
        numberCell(1790.0),
        numberCell(1640.0),
      ],
      [
        serialCell(SERIAL_2024_11_04, "dd/mm/yy"),
        textCell("EU_"),
        numberCell(1620.0),
        numberCell(1520.0),
      ],
      [
        serialCell(SERIAL_2026_10_19, "dd/mm/yy"),
        textCell("EU_"),
        numberCell(1990.0),
        numberCell(2130.0),
      ],
      [
        serialCell(SERIAL_2026_10_26, "dd/mm/yy"),
        textCell("EU_"),
        numberCell(1950.0),
        numberCell(2140.0),
      ],
    ];
    const { fetcher } = recordedFetcher({
      bulletinBytes: syntheticBulletin({ dataRows: lateRows }),
    });

    const error = await prefetchError(null, { fetcher, now: fixedNow });

    expect(error.kind).toBe("coverage");
    // The merge succeeded, so its report is carried for the entry to print.
    expect(error.report).not.toBeNull();
    assertNoBannedWords(error.message);
    assertReportNeutral(error.report as Report);
  });
});

// ---------------------------------------------------------------------------
// A committed file that fails loadFigureFile throws FigureDataError.
// ---------------------------------------------------------------------------

describe("runPrefetch — a bad committed file throws FigureDataError", () => {
  it("propagates the loader's FigureDataError unchanged when existingJson is malformed", async () => {
    // An object that is not a valid figure file (missing the `fixture` flag and
    // carrying an unknown key) fails loadFigureFile at the shape rule.
    const bad = { not: "a figure file" };

    await expect(
      runPrefetch(bad, { fetcher: recordedFetcher().fetcher, now: fixedNow }),
    ).rejects.toThrow(FigureDataError);

    try {
      await runPrefetch(bad, {
        fetcher: recordedFetcher().fetcher,
        now: fixedNow,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(FigureDataError);
      expect((error as FigureDataError).rule).toBe("shape");
      assertNoBannedWords((error as FigureDataError).message);
    }
  });
});

// `BULLETIN_FILE_NAME` is imported to assert the resolved URL carries the
// history-workbook file name, proving the stub serves the file the adapter's
// own link-finder resolves rather than a hand-made URL.
describe("recorded workbook URL identity", () => {
  it("the resolved Bulletin URL carries the history-workbook file name", () => {
    expect(new URL(RESOLVED_FILE_URL).searchParams.get("filename")).toBe(
      BULLETIN_FILE_NAME,
    );
  });
});
