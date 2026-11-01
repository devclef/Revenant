// Clearly-fake workbook builder for the data-source adapter tests
// (04-real-figures).
//
// TEST SUPPORT ONLY. This module is imported by `*.test.ts` files alone: it
// builds synthetic `.xls` and `.xlsx` bytes so the Decimal_Rule, the date-serial
// conversion and (in tasks 2 and 3) the Adapters can be exercised over shapes
// the Recorded_Excerpts do not contain — empty value cells, text in a number
// slot, duplicate dates, the 1904 date system. Every number here is invented in
// the test that calls it and must NEVER reach the Real_File or any display
// (data-integrity.md: "Seed and test data must be clearly fake and must never
// reach production or a demo presented as real"). The boundary test allows this
// folder to import `@e965/xlsx` because nothing outside `*.test.ts` imports it.
//
// Pure runtime module: no process.env, no console, and no import of
// @/lib/crypto, @/lib/db or @/lib/letter-store (boundary.test.ts, R6.7).
//
// The parse side that reads these bytes uses `cellDates: false` (and, for the
// Bulletin sheet, `sheets: [...]`), so dates arrive as raw serials. The writer
// here therefore stores date serials as plain numeric cells (`t: "n"`) carrying
// a date number format, exactly as the real files do; it never writes a native
// date cell (`t: "d"`), which would make the reader hand back a `Date`.

import * as XLSX from "@e965/xlsx";

/** The two workbook formats the adapters read: legacy BIFF8 `.xls` and OOXML
 *  `.xlsx`. The real EIA files are `.xls`; the Oil Bulletin file is `.xlsx`. */
export type WorkbookFormat = "xls" | "xlsx";

/**
 * One cell in a described sheet. Mirrors the parser's own cell shape closely
 * enough for the Decimal_Rule and the Adapters:
 *
 * - `kind: "number"` — a numeric cell (`t: "n"`). `value` is the stored double;
 *   `format` is the cell's number format string (for example `"0.000"` for EIA
 *   or an accounting format for the Bulletin), which drives the `w` display text
 *   the reader produces.
 * - `kind: "serial"` — a numeric date serial cell: the same as a number cell but
 *   named for intent, carrying a date number format (default `"mmm dd, yyyy"`).
 * - `kind: "text"` — a string cell (`t: "s"`), used for headers, unit labels,
 *   footnotes and the "text where a number should be" gap case.
 * - `kind: "empty"` — no cell written at that address at all, which is how a
 *   truly blank value cell (the `no_number` gap) is represented.
 */
export type CellSpec =
  | { kind: "number"; value: number; format?: string }
  | { kind: "serial"; value: number; format?: string }
  | { kind: "text"; value: string }
  | { kind: "empty" };

/** A described sheet: its name and a dense grid of rows of cell specs. Row 0 is
 *  worksheet row 1; column 0 is column A. A short row leaves the missing
 *  trailing columns empty, and an `{ kind: "empty" }` leaves one cell blank. */
export interface SheetDescription {
  name: string;
  rows: CellSpec[][];
}

/** A described workbook: one or more sheets, in order. The first sheet is the
 *  active one. `date1904` writes the 1904 date system when true (the Bulletin
 *  adapter rejects such a workbook with `date_system`); it defaults to false. */
export interface WorkbookDescription {
  sheets: SheetDescription[];
  date1904?: boolean;
}

/** A number cell carrying a stored double and an optional number format. */
export function numberCell(value: number, format?: string): CellSpec {
  return format === undefined
    ? { kind: "number", value }
    : { kind: "number", value, format };
}

/** A date-serial cell: a numeric cell with a date number format, written the
 *  way the real files store dates (a serial, not a native date). */
export function serialCell(serial: number, format?: string): CellSpec {
  return format === undefined
    ? { kind: "serial", value: serial }
    : { kind: "serial", value: serial, format };
}

/** A text cell: headers, unit labels, footnotes, and text in a value slot. */
export function textCell(value: string): CellSpec {
  return { kind: "text", value };
}

/** A blank cell: no cell object is written at that address. */
export function emptyCell(): CellSpec {
  return { kind: "empty" };
}

/** The default number format for a serial cell, matching the EIA files. */
const DEFAULT_DATE_FORMAT = "mmm dd, yyyy";

/**
 * Turn one described sheet into a parser `WorkSheet`. Each non-empty cell is
 * written at its explicit A1 address so the stored type, value and number
 * format are exactly what the description asked for; the parser fills `w` from
 * the format on read. The sheet `!ref` is set to the bounding range so a reader
 * that scans by range sees every written cell.
 */
function describedSheet(sheet: SheetDescription): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  let maxRow = 0;
  let maxCol = 0;

  sheet.rows.forEach((row, r) => {
    row.forEach((spec, c) => {
      if (spec.kind === "empty") {
        return;
      }
      const address = XLSX.utils.encode_cell({ r, c });
      if (spec.kind === "text") {
        ws[address] = { t: "s", v: spec.value };
      } else {
        // number or serial: a numeric cell with an optional number format.
        const format =
          spec.format ??
          (spec.kind === "serial" ? DEFAULT_DATE_FORMAT : undefined);
        const cell: XLSX.CellObject = { t: "n", v: spec.value };
        if (format !== undefined) {
          cell.z = format;
        }
        ws[address] = cell;
      }
      if (r > maxRow) {
        maxRow = r;
      }
      if (c > maxCol) {
        maxCol = c;
      }
    });
  });

  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } });
  return ws;
}

/**
 * Build the bytes of a described workbook in the requested format.
 *
 * The result is a `Uint8Array` suitable for passing straight to an adapter's
 * `parse*Workbook(bytes)` function (or to `XLSX.read(bytes, { type: "buffer" })`
 * in a test). The writer is told to emit the cells' number formats so the reader
 * produces the same `w` display text the real files carry (`cellStyles`/format
 * round-trip). The 1904 date system is written when the description asks for it.
 */
export function buildWorkbook(
  description: WorkbookDescription,
  format: WorkbookFormat,
): Uint8Array {
  if (description.sheets.length === 0) {
    throw new Error("buildWorkbook: a workbook needs at least one sheet");
  }

  const wb = XLSX.utils.book_new();
  if (description.date1904) {
    wb.Workbook = { ...(wb.Workbook ?? {}), WBProps: { date1904: true } };
  }

  for (const sheet of description.sheets) {
    XLSX.utils.book_append_sheet(wb, describedSheet(sheet), sheet.name);
  }

  const out: unknown = XLSX.write(wb, {
    type: "buffer",
    bookType: format,
    // Keep the number formats so the reader regenerates each cell's `w`.
    cellStyles: true,
  });

  // `write` with `type: "buffer"` returns a Node Buffer; normalise to a plain
  // Uint8Array so callers never depend on Buffer being present.
  return new Uint8Array(out as ArrayBufferLike);
}

/** Build legacy `.xls` (BIFF8) bytes from a described workbook. */
export function buildXls(description: WorkbookDescription): Uint8Array {
  return buildWorkbook(description, "xls");
}

/** Build OOXML `.xlsx` bytes from a described workbook. */
export function buildXlsx(description: WorkbookDescription): Uint8Array {
  return buildWorkbook(description, "xlsx");
}
