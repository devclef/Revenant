// EIA adapter for the data-source pipeline (04-real-figures).
//
// Reads a U.S. EIA weekly retail-fuel-price workbook (legacy `.xls`, the
// `Data 1` sheet) and returns its in-window figures plus the gaps found, with
// full provenance handled by the caller. It finds the series by identity
// (`Sourcekey` and the series ID in the header), never by column position, and
// turns every value through the shared Decimal_Rule so the stored number keeps
// its full published precision (data-integrity.md).
//
// Dev-only module: no process.env, no console, and no import of @/lib/crypto,
// @/lib/db or @/lib/letter-store. Nothing outside src/lib/sources imports this
// folder (enforced by boundary.test.ts, R6.7). The spreadsheet parser
// (@e965/xlsx) is a devDependency and stays out of the Next.js build and the
// browser bundle.

import * as XLSX from "@e965/xlsx";

import { cellToDecimal, type Cell } from "./decimal-rule";
import { SourceError } from "./errors";
import { download, defaultFetcher } from "./fetcher";
import { serialToDate } from "./serial-date";
import type { AdapterDeps, SeriesResult, SourceFigure, SourceGap } from "./types";

/** The result of reading one EIA series end to end (fetch + parse). The parse
 *  step (`parseEiaWorkbook`) produces `result`; `fetchEiaSeries` (task 2) fills
 *  `downloadUrl` and `downloadedAt` from the download it ran. */
export interface EiaResult {
  seriesId: string;
  downloadUrl: string;
  /** UTC time the download finished, formatted `YYYY-MM-DDTHH:MM:SSZ`. */
  downloadedAt: string;
  result: SeriesResult;
}

/** The sheet an EIA workbook keeps its data on; the `Contents` sheet is ignored. */
const DATA_SHEET = "Data 1";

/** Cell A2 must hold exactly this key for the workbook to be an EIA series file. */
const SOURCEKEY_LABEL = "Sourcekey";

/** The title in B3 must end with this, naming the unit (R3.3). */
const UNIT_SUFFIX = "(Dollars per Gallon)";

/** The first period kept. Earlier rows are dropped (Coverage_Start, R3.7). */
const COVERAGE_START = "2023-06-01";

/** A valid EIA series ID: upper-case letters, digits and underscores only. */
const SERIES_ID_PATTERN = /^[A-Z0-9_]+$/;

/** 0-based row index of worksheet row 2 (the `Sourcekey` row). */
const ROW_SOURCEKEY = 1;
/** 0-based row index of worksheet row 3 (the unit/title row). */
const ROW_UNIT = 2;
/** 0-based row index of worksheet row 4 (the first data row). */
const FIRST_DATA_ROW = 3;

/** Column A (dates), as a 0-based index. */
const COL_A = 0;
/** Column B (values), as a 0-based index. */
const COL_B = 1;

/**
 * Build the download URL for an EIA weekly series.
 *
 * Returns `https://www.eia.gov/dnav/pet/hist_xls/<ID>w.xls`, the path EIA's own
 * history page links. `seriesId` must match `^[A-Z0-9_]+$`; anything else
 * throws, so a malformed ID can never be turned into a request.
 */
export function eiaDownloadUrl(seriesId: string): string {
  if (!SERIES_ID_PATTERN.test(seriesId)) {
    throw new Error(
      `eiaDownloadUrl: series ID must match ${SERIES_ID_PATTERN}, got ${JSON.stringify(seriesId)}`,
    );
  }
  return `https://www.eia.gov/dnav/pet/hist_xls/${seriesId}w.xls`;
}

/** Read a single cell from a worksheet by 0-based row and column, or undefined. */
function cellAt(sheet: XLSX.WorkSheet, r: number, c: number): XLSX.CellObject | undefined {
  const address = XLSX.utils.encode_cell({ r, c });
  return sheet[address] as XLSX.CellObject | undefined;
}

/** The trimmed display/string value of a cell, for identity and unit checks. A
 *  numeric cell contributes its displayed or stored text; an empty cell is "". */
function cellText(cell: XLSX.CellObject | undefined): string {
  if (cell === undefined) {
    return "";
  }
  if (typeof cell.w === "string") {
    return cell.w.trim();
  }
  if (cell.v === undefined || cell.v === null) {
    return "";
  }
  return String(cell.v).trim();
}

/** True when a cell is a numeric cell with a finite stored value. */
function isNumericCell(cell: XLSX.CellObject | undefined): boolean {
  return cell !== undefined && cell.t === "n" && typeof cell.v === "number" && Number.isFinite(cell.v);
}

/** True when a cell holds text (a string cell). */
function isTextCell(cell: XLSX.CellObject | undefined): boolean {
  return cell !== undefined && cell.t === "s";
}

/** The highest worksheet row index present, read from the sheet's `!ref`. */
function lastRowIndex(sheet: XLSX.WorkSheet): number {
  const ref = sheet["!ref"];
  if (typeof ref !== "string" || ref.length === 0) {
    return -1;
  }
  return XLSX.utils.decode_range(ref).e.r;
}

/** The raw text of a value cell for a `bad_cell` error detail: its display text
 *  if present, else `String(v)`; never more than the single offending value. */
function rawCellText(cell: XLSX.CellObject): string {
  if (typeof cell.w === "string") {
    return cell.w;
  }
  return String(cell.v);
}

/**
 * Parse the bytes of an EIA weekly workbook into a {@link SeriesResult}.
 *
 * Pure: it reads only `bytes` and `seriesId` and touches no I/O. It opens the
 * bytes with `cellDates: false` so dates arrive as raw serials, checks the
 * series identity and unit by the header cells, then reads the data rows:
 *
 * - A numeric cell in column A is a data row; `serialToDate` gives its period
 *   (an out-of-range serial becomes `bad_date` with the row number).
 * - A non-numeric column A with a numeric column B is also `bad_date`.
 * - Any other row (blank, or a removed row in a recorded excerpt) is skipped.
 * - Rows whose period is before Coverage_Start (2023-06-01) are dropped.
 * - For the rest: an empty column B is a `no_number` gap, a text column B is a
 *   `not_a_number` gap, and a numeric column B goes through the Decimal_Rule
 *   (a failure there is `bad_cell`, naming the series, period and raw value).
 *
 * Points come back ascending by period; a period seen twice is `duplicate_date`.
 */
export function parseEiaWorkbook(bytes: Uint8Array, seriesId: string): SeriesResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, { type: "buffer", cellDates: false });
  } catch {
    // The library message may carry file internals we do not want surfaced.
    throw new SourceError("eia", "unreadable_file");
  }

  const sheet = workbook.Sheets[DATA_SHEET];
  if (sheet === undefined) {
    throw new SourceError("eia", "sheet_missing", { sheet: DATA_SHEET });
  }

  // Series identity (R3.2): A2 = "Sourcekey", B2 = the requested series ID.
  const sourcekeyLabel = cellText(cellAt(sheet, ROW_SOURCEKEY, COL_A));
  const foundSeriesId = cellText(cellAt(sheet, ROW_SOURCEKEY, COL_B));
  if (sourcekeyLabel !== SOURCEKEY_LABEL || foundSeriesId !== seriesId) {
    throw new SourceError("eia", "series_mismatch", {
      expectedSeriesId: seriesId,
      foundSeriesId: foundSeriesId === "" ? "none" : foundSeriesId,
    });
  }

  // Unit (R3.3): B3 title must end with "(Dollars per Gallon)".
  const unitTitle = cellText(cellAt(sheet, ROW_UNIT, COL_B));
  if (!unitTitle.endsWith(UNIT_SUFFIX)) {
    throw new SourceError("eia", "unit_mismatch", { foundUnit: unitTitle });
  }

  const points: SourceFigure[] = [];
  const gaps: SourceGap[] = [];
  const seenPeriods = new Set<string>();

  const lastRow = lastRowIndex(sheet);
  for (let r = FIRST_DATA_ROW; r <= lastRow; r += 1) {
    const rowNumber = r + 1; // 1-based worksheet row, for error detail.
    const aCell = cellAt(sheet, r, COL_A);
    const bCell = cellAt(sheet, r, COL_B);

    if (!isNumericCell(aCell)) {
      // A is not a date serial. If B still holds a number, the row is malformed.
      if (isNumericCell(bCell)) {
        throw new SourceError("eia", "bad_date", { row: rowNumber });
      }
      // Otherwise it is a blank or removed row (recorded excerpts drop rows).
      continue;
    }

    let period: string;
    try {
      period = serialToDate((aCell as XLSX.CellObject).v as number);
    } catch {
      throw new SourceError("eia", "bad_date", { row: rowNumber });
    }

    // Drop everything before Coverage_Start (R3.7).
    if (period < COVERAGE_START) {
      continue;
    }

    if (seenPeriods.has(period)) {
      throw new SourceError("eia", "duplicate_date", { date: period });
    }
    seenPeriods.add(period);

    if (bCell === undefined || bCell.v === undefined || bCell.v === null) {
      // Empty value cell: a reported gap, never filled.
      gaps.push({ period, reason: "no_number" });
      continue;
    }

    if (isTextCell(bCell)) {
      gaps.push({ period, reason: "not_a_number" });
      continue;
    }

    let value: string;
    try {
      value = cellToDecimal(bCell as Cell);
    } catch {
      throw new SourceError("eia", "bad_cell", {
        expectedSeriesId: seriesId,
        date: period,
        cellValue: rawCellText(bCell),
      });
    }
    points.push({ period, value });
  }

  points.sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));

  return { points, gaps };
}

/**
 * Format a `Date` as `YYYY-MM-DDTHH:MM:SSZ` in UTC, with no milliseconds.
 *
 * This is the stamp recorded as `downloadedAt` (the UTC time a download
 * finished). It reads only the UTC fields of `date`, so the machine's local
 * timezone never leaks into the value.
 */
function formatUtcSeconds(date: Date): string {
  const pad = (n: number, width = 2): string => String(n).padStart(width, "0");
  const year = pad(date.getUTCFullYear(), 4);
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
}

/**
 * Fetch and parse one EIA weekly series end to end.
 *
 * Builds the download URL with {@link eiaDownloadUrl}, downloads it through the
 * shared {@link download} (which refuses any host but `www.eia.gov`), records
 * the UTC time the download finished, and parses the bytes with
 * {@link parseEiaWorkbook}. Tests inject `deps.fetcher` with recorded bytes and
 * `deps.now` with a fixed clock, so the real network and wall clock are never
 * touched in the suite (R2.6).
 *
 * Reads no environment variable, logs nothing, and reaches no host other than
 * the one `eiaDownloadUrl` produces.
 */
export async function fetchEiaSeries(
  seriesId: string,
  deps?: AdapterDeps,
): Promise<EiaResult> {
  const fetcher = deps?.fetcher ?? defaultFetcher;
  const now = deps?.now ?? ((): Date => new Date());

  const downloadUrl = eiaDownloadUrl(seriesId);
  const fetched = await download(fetcher, downloadUrl, "eia");
  const downloadedAt = formatUtcSeconds(now());
  const result = parseEiaWorkbook(fetched.body, seriesId);

  return { seriesId, downloadUrl, downloadedAt, result };
}

// `AdapterDeps` is part of this module's public surface for task 2's
// `fetchEiaSeries`; re-exported here so callers take it from the adapter.
export type { AdapterDeps };
