// Oil_Bulletin_Adapter for the data-source tools (04-real-figures).
//
// Reads the European Commission Weekly Oil Bulletin history workbook and
// returns the two EU27 weighted-average price series (Euro-super 95 and
// automotive diesel, both inclusive of duties and taxes) with full provenance.
// See design.md "Oil_Bulletin_Adapter" and data-integrity.md.
//
// Pure, side-effect-free module: it reads no process.env, logs nothing (no
// console.*), and imports no @/lib/crypto, @/lib/db or @/lib/letter-store. It
// is dev-only — nothing outside src/lib/sources imports it (enforced by
// boundary.test.ts, R6.7, R13.2).
//
// The Adapter never invents, estimates, interpolates or converts a figure. A
// period with no usable number is reported as a gap, never filled. Values stay
// in EUR per 1,000 litres exactly as published; display rounding lives in the
// figures layer, not here.

import * as XLSX from "@e965/xlsx";
import { SourceError } from "./errors";
import { download, defaultFetcher } from "./fetcher";
import { cellToDecimal, type Cell } from "./decimal-rule";
import { serialToDate } from "./serial-date";
import type {
  SourceFigure,
  SourceGap,
  SeriesResult,
  AdapterDeps,
  Fetcher,
} from "./types";

/**
 * One figure the Bulletin parser emits: a period and its decimal value, exactly
 * as {@link SourceFigure} defines. Each value column's figures are collected
 * ascending by period into a {@link SeriesResult}. Named here so tasks 2 and 3
 * share the vocabulary the parser produces.
 */
type BulletinFigure = SourceFigure;

/**
 * One period the Bulletin covers but did not publish a usable number for, as
 * {@link SourceGap} defines (`no_number` for an empty cell, `not_a_number` for
 * text). A gap is reported, never filled or estimated (data-integrity.md).
 */
type BulletinGap = SourceGap;

/**
 * The Weekly Oil Bulletin landing page. The Adapter downloads this page first
 * and finds the single history-workbook link on it, because the document's
 * UUID in the download URL can change when the Commission republishes it.
 */
export const BULLETIN_PAGE =
  "https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en";

/**
 * The exact `filename=` query value of the history workbook link. Exactly one
 * link on the page must carry it; zero or several matches is `link_not_found`.
 */
export const BULLETIN_FILE_NAME =
  "Weekly_Oil_Bulletin_Prices_History_maticni_4web.xlsx";

/**
 * The two header keys the Adapter reads, each the EU27 weighted average
 * inclusive of duties and taxes: `EU_price_with_tax_euro95` is Euro-super 95
 * and `EU_price_with_tax_diesel` is automotive diesel. Each key appears in
 * exactly one column of row 1, found by name and never by letter or position.
 */
export type BulletinKey =
  | "EU_price_with_tax_euro95"
  | "EU_price_with_tax_diesel";

/**
 * The two header keys in the order the Adapter scans and reports them. Each
 * appears in exactly one column of row 1; the array drives the by-name search
 * so neither key is ever located by column letter or position (R4.1).
 */
const BULLETIN_KEYS: readonly BulletinKey[] = [
  "EU_price_with_tax_euro95",
  "EU_price_with_tax_diesel",
] as const;

/** The only sheet the Adapter opens: the EU weighted-average price table. */
const BULLETIN_SHEET = "Prices with taxes";

/**
 * The row-3 label of the date column, found by its text so the date column is
 * never located by letter or position. The real file carries it in column A.
 */
const DATE_HEADER = "Date";

/**
 * The exact unit label each value column must carry in row 3. The Bulletin
 * publishes EU prices per 1,000 litres; anything else is `unit_mismatch`.
 */
const BULLETIN_UNIT = "1000 l";

/**
 * The marker column B must hold on every emitted (in-window) row: `EU_` means
 * the EU27 weighted average. A different marker is `bad_row_marker`. The whole
 * window (from Coverage_Start, after the 2020 membership change) is one
 * membership, so this never varies in the data this Adapter emits.
 */
const BULLETIN_MARKER = "EU_";

/**
 * Column B, 0-based index 1. The marker's column is fixed by the file's layout
 * and is read by position only to check the row marker (R4.1 forbids locating a
 * *series* by position; the marker is not a series).
 */
const BULLETIN_MARKER_COLUMN = 1;

/** The first data row, worksheet row 4 (0-based row 3). Rows 1-3 are headers. */
const BULLETIN_FIRST_DATA_ROW = 3;

/**
 * Coverage_Start: the window begins on 2023-06-01. Rows with an earlier period
 * are not emitted (the EU27 2020 membership and the demo windows both sit
 * inside this window). String comparison of `YYYY-MM-DD` matches the figures
 * layer's own ordering.
 */
const COVERAGE_START = "2023-06-01";

/**
 * The result of one Oil Bulletin fetch: the page and workbook URLs, when the
 * workbook download finished (UTC), the column letter each header key was
 * found in (reported, never used to locate anything, R4.4), and the series.
 */
export interface BulletinResult {
  pageUrl: string;
  downloadUrl: string;
  /** UTC, `YYYY-MM-DDTHH:MM:SSZ`, taken when the workbook download finished. */
  downloadedAt: string;
  /** The column letter where each key was found in row 1 (R4.4). */
  columns: Record<BulletinKey, string>;
  series: Record<BulletinKey, SeriesResult>;
}

/**
 * Find the single history-workbook link on the Bulletin page.
 *
 * Parses every `href` in `pageHtml`, resolves each against `pageUrl`, and keeps
 * the ones whose `filename=` query value is exactly {@link BULLETIN_FILE_NAME}.
 * Returns that one absolute URL. Zero matches or more than one match throws a
 * `SourceError` of kind `link_not_found` naming the page URL.
 */
export function findBulletinLink(pageHtml: string, pageUrl: string): string {
  // Scan every href in the page, tolerating single quotes, double quotes and
  // unquoted attribute values. Nothing is fetched here; this is pure.
  const hrefPattern = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;

  const matches: string[] = [];
  for (
    let match = hrefPattern.exec(pageHtml);
    match !== null;
    match = hrefPattern.exec(pageHtml)
  ) {
    const raw = match[1] ?? match[2] ?? match[3];
    if (raw === undefined || raw === "") continue;

    // Resolve the href against the page URL. An href the URL constructor
    // cannot parse (relative to an invalid base, or malformed) is skipped
    // rather than treated as a match.
    let resolved: URL;
    try {
      resolved = new URL(decodeHtmlEntities(raw), pageUrl);
    } catch {
      continue;
    }

    // Keep links whose `filename=` query value is exactly the history
    // workbook's name. searchParams.get decodes percent-encoding, so an
    // encoded filename= value still compares equal.
    if (resolved.searchParams.get("filename") === BULLETIN_FILE_NAME) {
      matches.push(resolved.toString());
    }
  }

  // Exactly one link must carry the file name. Zero or several is a failure
  // naming the page URL (R4, design.md "Finding the Bulletin file").
  if (matches.length !== 1) {
    throw new SourceError("oil-bulletin", "link_not_found", { url: pageUrl });
  }

  return matches[0];
}

/**
 * Decode the handful of HTML entities that commonly appear inside an href in
 * served HTML, most importantly `&amp;` separating query parameters. Without
 * this, `?a=1&amp;filename=…` would hide the `filename` parameter from the URL
 * parser. Pure string work; no network, no DOM.
 */
function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x0*27;/gi, "'");
}

/**
 * Parse the Oil Bulletin history workbook bytes into the two EU series.
 *
 * Opens only the `Prices with taxes` sheet, finds each header key in row 1 by
 * name, checks the `1000 l` unit labels in row 3, reads data rows from row 4
 * (dates through {@link serialToDate}, values through {@link cellToDecimal},
 * column B must be `EU_` on emitted rows), and returns the figures ascending by
 * period with any gaps. See design.md "Oil_Bulletin_Adapter" for every case.
 */
export function parseBulletinWorkbook(bytes: Uint8Array): {
  columns: Record<BulletinKey, string>;
  series: Record<BulletinKey, SeriesResult>;
} {
  // 1. Open only the `Prices with taxes` sheet. `cellDates: false` keeps dates
  //    as raw serials (serialToDate reads them). Any failure opening the bytes
  //    is `unreadable_file`; we never leak the parser's own error message.
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, {
      type: "buffer",
      sheets: [BULLETIN_SHEET],
      cellDates: false,
    });
  } catch {
    throw new SourceError("oil-bulletin", "unreadable_file", {});
  }

  const sheet = workbook.Sheets[BULLETIN_SHEET];
  if (sheet === undefined) {
    throw new SourceError("oil-bulletin", "sheet_missing", {
      sheet: BULLETIN_SHEET,
    });
  }

  // Reject the 1904 date system: serialToDate assumes the 1900 epoch, so a
  // 1904 workbook would silently shift every date (R4; `date_system`).
  if (workbook.Workbook?.WBProps?.date1904 === true) {
    throw new SourceError("oil-bulletin", "date_system", {});
  }

  // The sheet's bounding range tells us how many rows and columns to scan. A
  // sheet with no `!ref` has no data; treat it as having no header keys.
  const ref = typeof sheet["!ref"] === "string" ? sheet["!ref"] : undefined;
  if (ref === undefined) {
    throw new SourceError("oil-bulletin", "header_missing", {
      headerKey: BULLETIN_KEYS[0],
    });
  }
  const range = XLSX.utils.decode_range(ref);

  /** Read the cell at a 0-based row/column, or undefined if blank. */
  const cellAt = (r: number, c: number): XLSX.CellObject | undefined => {
    const address = XLSX.utils.encode_cell({ r, c });
    return sheet[address] as XLSX.CellObject | undefined;
  };

  /** The trimmed display/string text of a cell, "" when blank or non-text. */
  const textAt = (r: number, c: number): string => {
    const cell = cellAt(r, c);
    if (cell === undefined) return "";
    // Prefer the formatted text `w`; fall back to a string value `v`.
    if (typeof cell.w === "string") return cell.w.trim();
    if (cell.t === "s" && typeof cell.v === "string") return cell.v.trim();
    return "";
  };

  // 2. Find each header key in row 1 (0-based row 0) by name, never by letter
  //    or position (R4.1). A key in no column is `header_missing`; a key in two
  //    or more columns is `header_duplicated`. The column index is kept only to
  //    report the letter (R4.4) and to read that column's unit label and data.
  const keyColumn: Record<BulletinKey, number> = {
    EU_price_with_tax_euro95: -1,
    EU_price_with_tax_diesel: -1,
  };

  for (const key of BULLETIN_KEYS) {
    let found = -1;
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      if (textAt(0, c) === key) {
        if (found !== -1) {
          throw new SourceError("oil-bulletin", "header_duplicated", {
            headerKey: key,
          });
        }
        found = c;
      }
    }
    if (found === -1) {
      throw new SourceError("oil-bulletin", "header_missing", {
        headerKey: key,
      });
    }
    keyColumn[key] = found;
  }

  // The date column is the row-3 (0-based row 2) cell whose text is `Date`,
  // found by content, not by position. None present is `header_missing`.
  let dateColumn = -1;
  for (let c = range.s.c; c <= range.e.c; c += 1) {
    if (textAt(2, c) === DATE_HEADER) {
      dateColumn = c;
      break;
    }
  }
  if (dateColumn === -1) {
    throw new SourceError("oil-bulletin", "header_missing", {
      headerKey: DATE_HEADER,
    });
  }

  // 3. The unit label of each value column is its row-3 (0-based row 2) text.
  //    It must equal exactly `1000 l`, else `unit_mismatch` naming what we saw.
  for (const key of BULLETIN_KEYS) {
    const foundUnit = textAt(2, keyColumn[key]);
    if (foundUnit !== BULLETIN_UNIT) {
      throw new SourceError("oil-bulletin", "unit_mismatch", {
        headerKey: key,
        foundUnit,
      });
    }
  }

  // Per-key figure and gap collections, plus a per-key seen-period set so a
  // period appearing twice in one column is `duplicate_date`.
  const pointsByKey: Record<BulletinKey, BulletinFigure[]> = {
    EU_price_with_tax_euro95: [],
    EU_price_with_tax_diesel: [],
  };
  const gapsByKey: Record<BulletinKey, BulletinGap[]> = {
    EU_price_with_tax_euro95: [],
    EU_price_with_tax_diesel: [],
  };
  const seenByKey: Record<BulletinKey, Set<string>> = {
    EU_price_with_tax_euro95: new Set<string>(),
    EU_price_with_tax_diesel: new Set<string>(),
  };

  // 4. Data rows run from worksheet row 4 (0-based row 3) down. A numeric date
  //    cell is a data row; a non-numeric date cell where a value cell IS a
  //    number is `bad_date`; otherwise the row is a footnote and is skipped.
  for (let r = BULLETIN_FIRST_DATA_ROW; r <= range.e.r; r += 1) {
    const oneBasedRow = r + 1;
    const dateCell = cellAt(r, dateColumn);
    const dateIsNumber =
      dateCell !== undefined &&
      dateCell.t === "n" &&
      typeof dateCell.v === "number";

    if (!dateIsNumber) {
      // Not a data row unless a value cell is numeric, which would make a
      // missing/invalid date a genuine `bad_date` rather than a footnote.
      const anyValueNumeric = BULLETIN_KEYS.some((key) => {
        const vc = cellAt(r, keyColumn[key]);
        return vc !== undefined && vc.t === "n" && typeof vc.v === "number";
      });
      if (anyValueNumeric) {
        throw new SourceError("oil-bulletin", "bad_date", { row: oneBasedRow });
      }
      continue;
    }

    // Convert the serial. A RangeError becomes `bad_date` naming the 1-based row.
    let period: string;
    try {
      period = serialToDate(dateCell.v as number);
    } catch {
      throw new SourceError("oil-bulletin", "bad_date", { row: oneBasedRow });
    }

    // Rows before Coverage_Start are not emitted (the window begins 2023-06-01).
    if (period < COVERAGE_START) {
      continue;
    }

    // 5. In-window rows must carry the `EU_` marker in column B (the EU27
    //    weighted average). Anything else is `bad_row_marker` naming the row.
    const marker = textAt(r, BULLETIN_MARKER_COLUMN);
    if (marker !== BULLETIN_MARKER) {
      throw new SourceError("oil-bulletin", "bad_row_marker", {
        row: oneBasedRow,
        marker,
      });
    }

    for (const key of BULLETIN_KEYS) {
      // A period seen twice in the same column is `duplicate_date`.
      if (seenByKey[key].has(period)) {
        throw new SourceError("oil-bulletin", "duplicate_date", {
          date: period,
        });
      }
      seenByKey[key].add(period);

      const valueCell = cellAt(r, keyColumn[key]);
      if (valueCell === undefined || valueCell.t === "z") {
        // Empty value cell: a gap, never filled (data-integrity.md).
        gapsByKey[key].push({ period, reason: "no_number" });
        continue;
      }
      if (valueCell.t !== "n") {
        // A text (or other non-numeric) cell: a `not_a_number` gap.
        gapsByKey[key].push({ period, reason: "not_a_number" });
        continue;
      }
      // A numeric cell: the Decimal_Rule gives the published value, unchanged
      // (EUR per 1,000 litres). A failure is `bad_cell` naming series, period
      // and the single offending raw value — never any other cell contents.
      try {
        const value = cellToDecimal(valueCell as Cell);
        pointsByKey[key].push({ period, value });
      } catch {
        throw new SourceError("oil-bulletin", "bad_cell", {
          expectedSeriesId: key,
          date: period,
          cellValue:
            typeof valueCell.w === "string"
              ? valueCell.w.trim()
              : String(valueCell.v),
        });
      }
    }
  }

  // 6. Sort each column's points ascending by period (the file is newest-first,
  //    so this reverses it), and report the found column letters (R4.4).
  const series: Record<BulletinKey, SeriesResult> = {
    EU_price_with_tax_euro95: {
      points: sortByPeriod(pointsByKey.EU_price_with_tax_euro95),
      gaps: gapsByKey.EU_price_with_tax_euro95,
    },
    EU_price_with_tax_diesel: {
      points: sortByPeriod(pointsByKey.EU_price_with_tax_diesel),
      gaps: gapsByKey.EU_price_with_tax_diesel,
    },
  };

  const columns: Record<BulletinKey, string> = {
    EU_price_with_tax_euro95: XLSX.utils.encode_col(
      keyColumn.EU_price_with_tax_euro95,
    ),
    EU_price_with_tax_diesel: XLSX.utils.encode_col(
      keyColumn.EU_price_with_tax_diesel,
    ),
  };

  return { columns, series };
}

/**
 * Return a new array of figures sorted ascending by `period` (string order of
 * `YYYY-MM-DD`, the same order the figures layer uses). The input is never
 * mutated. Periods are already de-duplicated per column by the caller.
 */
function sortByPeriod(points: readonly BulletinFigure[]): BulletinFigure[] {
  return [...points].sort((a, b) => (a.period < b.period ? -1 : 1));
}

/**
 * Download the Bulletin page, find the history-workbook link, download it, and
 * parse it into the two EU series with full provenance.
 *
 * `deps.fetcher` defaults to {@link defaultFetcher} (the real downloader) and
 * `deps.now` to `Date.now` via `new Date()`; tests pass a `Fetcher` returning
 * recorded bytes and a fixed clock so no network is touched (R2.6). Both
 * requests go through {@link download}, so only the hosts in
 * {@link ALLOWED_HOSTS} are reachable.
 */
export async function fetchBulletin(
  deps?: AdapterDeps,
): Promise<BulletinResult> {
  const fetcher: Fetcher = deps?.fetcher ?? defaultFetcher;
  const now = deps?.now ?? (() => new Date());

  // Request 1: the landing page. `download` enforces ALLOWED_HOSTS before and
  // after redirects, so no host other than energy.ec.europa.eu is reachable.
  const page = await download(fetcher, BULLETIN_PAGE, "oil-bulletin");
  const html = new TextDecoder("utf-8").decode(page.body);

  // Find the single history-workbook link on the page. Zero or several
  // matches throws `link_not_found` (findBulletinLink's own contract).
  const fileUrl = findBulletinLink(html, BULLETIN_PAGE);

  // Request 2: the workbook itself. `download` re-checks the host, so a link
  // resolving off-host is refused with `wrong_host` rather than followed.
  const workbook = await download(fetcher, fileUrl, "oil-bulletin");

  // The moment the workbook download finished, as UTC with second precision
  // and no milliseconds (YYYY-MM-DDTHH:MM:SSZ). The injected clock makes this
  // deterministic in tests.
  const downloadedAt = now().toISOString().replace(/\.\d{3}Z$/, "Z");

  // Parse the bytes into the two EU series with their found column letters.
  const { columns, series } = parseBulletinWorkbook(workbook.body);

  return {
    pageUrl: BULLETIN_PAGE,
    downloadUrl: fileUrl,
    downloadedAt,
    columns,
    series,
  };
}
