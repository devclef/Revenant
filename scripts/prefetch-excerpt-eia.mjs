// One-off writer for the EIA Recorded_Excerpts (04-real-figures, task 2).
//
// INFORMATIONAL ONLY. This is NOT part of the build, the test run or the image.
// Nothing imports it and no test runs it (R8.9); it is run by hand, once, by a
// developer with network access, to produce the two committed excerpts
// src/lib/sources/__recorded__/eia-gasoline.xls and eia-diesel.xls. `build`,
// `test`, `lint` and `typecheck` never call it. It is the only code here that
// reaches the real EIA host, and it reads a secret or logs nothing beyond the
// recording time and the read-back comparison result.
//
// What it does (design.md "Recorded excerpts", decision D4): for each EIA weekly
// series it downloads the real legacy `.xls` from the `hist_xls` URL, opens it
// with @e965/xlsx, keeps only the `Data 1` sheet (dropping `Contents`) and only
// header rows 1-3 plus the six listed data rows, preserving each kept cell's
// stored number (`v`), displayed text (`w`), number format (`z`) and type
// (`t`). EIA offers only legacy BIFF8 `.xls` files of 118-128 KB, which a hand
// edit cannot cut, so the excerpt is re-encoded by the @e965/xlsx writer from
// the real file with rows removed (D4), not sliced byte for byte. After writing
// each excerpt it reads it back and compares every kept cell's `t`, `v`, `w` and
// `z` with the original; if any differs it prints a diff and exits non-zero. It
// writes only the two excerpt files under __recorded__ and never the real file.
//
// Run: `node scripts/prefetch-excerpt-eia.mjs` from the worktree root.

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import * as XLSX from "@e965/xlsx";

/** The two EIA weekly retail-fuel-price series to excerpt. */
const SERIES = [
  { id: "EMM_EPMR_PTE_NUS_DPG", out: "eia-gasoline.xls" }, // U.S. regular gasoline
  { id: "EMD_EPD2D_PTE_NUS_DPG", out: "eia-diesel.xls" }, // U.S. No. 2 diesel
];

/** The sheet the data lives on; `Contents` is dropped from the excerpt. */
const DATA_SHEET = "Data 1";

/** The data-row dates kept in each excerpt, as `YYYY-MM-DD`. 2023-05-29 sits
 *  before Coverage_Start so the adapter tests can prove it is left out; the
 *  rest are the listed figure cells the example tests assert. */
const KEPT_DATES = [
  "2023-05-29",
  "2023-06-05",
  "2023-06-12",
  "2024-05-06",
  "2024-11-04",
  "2026-10-26",
];

/** 0-based worksheet rows kept unconditionally: rows 1, 2 and 3 (headers). */
const HEADER_ROWS = [0, 1, 2];

/** The largest an excerpt may be. */
const MAX_BYTES = 100_000;

/** The 1900 date-system epoch as a UTC instant (1899-12-30), matching
 *  src/lib/sources/serial-date.ts, so a kept date maps to the same serial the
 *  reader produces. */
const EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const recordedDir = resolve(root, "src/lib/sources/__recorded__");

/** The download URL for an EIA weekly series (the path EIA's own history page
 *  links). Mirrors eiaDownloadUrl in src/lib/sources/eia.ts. */
function downloadUrl(seriesId) {
  if (!/^[A-Z0-9_]+$/.test(seriesId)) {
    throw new Error(`series ID must match ^[A-Z0-9_]+$, got ${seriesId}`);
  }
  return `https://www.eia.gov/dnav/pet/hist_xls/${seriesId}w.xls`;
}

/** A `YYYY-MM-DD` date turned into its 1900-date-system serial, so a data row
 *  can be matched by the stored serial in column A. */
function dateToSerial(date) {
  const [year, month, day] = date.split("-").map((part) => Number(part));
  const ms = Date.UTC(year, month - 1, day);
  return Math.round((ms - EPOCH_MS) / MS_PER_DAY);
}

/** The set of kept date serials, for quick membership checks. */
const KEPT_SERIALS = new Set(KEPT_DATES.map(dateToSerial));

/** Read one cell from a worksheet at a 0-based row and column, or undefined. */
function cellAt(sheet, r, c) {
  return sheet[XLSX.utils.encode_cell({ r, c })];
}

/** The highest row index present in a worksheet, from its `!ref`. */
function lastRow(sheet) {
  const ref = sheet["!ref"];
  if (typeof ref !== "string" || ref.length === 0) {
    return -1;
  }
  return XLSX.utils.decode_range(ref).e.r;
}

/** The highest column index present in a worksheet, from its `!ref`. */
function lastCol(sheet) {
  const ref = sheet["!ref"];
  if (typeof ref !== "string" || ref.length === 0) {
    return -1;
  }
  return XLSX.utils.decode_range(ref).e.c;
}

/** Copy one cell, keeping only the fields the excerpt must preserve: type `t`,
 *  stored value `v`, displayed text `w` and number format `z`. */
function copyCell(cell) {
  const copy = { t: cell.t, v: cell.v };
  if (cell.w !== undefined) {
    copy.w = cell.w;
  }
  if (cell.z !== undefined) {
    copy.z = cell.z;
  }
  return copy;
}

/**
 * Build an excerpt worksheet from the real `Data 1` sheet: keep header rows
 * 1-3 and only the data rows whose column-A serial is in KEPT_SERIALS, at their
 * original row positions, so the reader sees a sparse sheet exactly like the
 * real one with rows removed. Returns the new worksheet and the list of kept
 * 0-based row indices (for the read-back comparison).
 */
function buildExcerptSheet(sheet) {
  const cols = lastCol(sheet);
  const rows = lastRow(sheet);
  const keptRows = [];

  for (let r = 0; r <= rows; r += 1) {
    let keep = HEADER_ROWS.includes(r);
    if (!keep) {
      const aCell = cellAt(sheet, r, 0);
      if (aCell && aCell.t === "n" && KEPT_SERIALS.has(aCell.v)) {
        keep = true;
      }
    }
    if (keep) {
      keptRows.push(r);
    }
  }

  const out = {};
  let maxRow = 0;
  let maxCol = 0;
  for (const r of keptRows) {
    for (let c = 0; c <= cols; c += 1) {
      const cell = cellAt(sheet, r, c);
      if (cell === undefined) {
        continue;
      }
      out[XLSX.utils.encode_cell({ r, c })] = copyCell(cell);
      if (r > maxRow) {
        maxRow = r;
      }
      if (c > maxCol) {
        maxCol = c;
      }
    }
  }
  out["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } });
  return { sheet: out, keptRows, cols };
}

/**
 * Compare every kept cell of `original` against `readback` on `t`, `v`, `w` and
 * `z`. Returns a list of human-readable difference lines; an empty list means
 * every kept cell round-tripped unchanged.
 */
function diffCells(original, readback, keptRows, cols) {
  const diffs = [];
  for (const r of keptRows) {
    for (let c = 0; c <= cols; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const a = original[addr];
      const b = readback[addr];
      if (a === undefined && b === undefined) {
        continue;
      }
      if (a === undefined || b === undefined) {
        diffs.push(`${addr}: present on one side only (original=${a !== undefined}, readback=${b !== undefined})`);
        continue;
      }
      for (const field of ["t", "v", "w", "z"]) {
        if (a[field] !== b[field]) {
          diffs.push(`${addr}.${field}: original=${JSON.stringify(a[field])} readback=${JSON.stringify(b[field])}`);
        }
      }
    }
  }
  return diffs;
}

/** Download one URL as raw bytes, following redirects. */
async function fetchBytes(url) {
  const response = await fetch(url, { redirect: "follow", credentials: "omit" });
  if (!response.ok) {
    throw new Error(`download failed: ${url} -> HTTP ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

async function main() {
  mkdirSync(recordedDir, { recursive: true });

  for (const series of SERIES) {
    const url = downloadUrl(series.id);
    console.log(`\n${series.id}: downloading ${url}`);
    const bytes = await fetchBytes(url);
    const recordedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    console.log(`${series.id}: downloaded ${bytes.byteLength} bytes, recorded at ${recordedAt} (UTC)`);

    // Open with cellDates: false so dates stay raw serials, and cellNF: true so
    // each cell keeps its number format (z) and displayed text (w).
    const workbook = XLSX.read(bytes, { type: "buffer", cellDates: false, cellNF: true });
    const dataSheet = workbook.Sheets[DATA_SHEET];
    if (dataSheet === undefined) {
      throw new Error(`${series.id}: sheet ${JSON.stringify(DATA_SHEET)} not found`);
    }

    const { sheet: excerptSheet, keptRows, cols } = buildExcerptSheet(dataSheet);

    // A fresh workbook with only the Data 1 sheet (Contents is dropped).
    const outWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(outWb, excerptSheet, DATA_SHEET);

    const outBytes = new Uint8Array(
      XLSX.write(outWb, { type: "buffer", bookType: "xls", cellStyles: true }),
    );
    if (outBytes.byteLength > MAX_BYTES) {
      throw new Error(
        `${series.id}: excerpt is ${outBytes.byteLength} bytes, over the ${MAX_BYTES}-byte limit`,
      );
    }

    // Read the excerpt back and compare every kept cell with the original.
    const readback = XLSX.read(outBytes, { type: "buffer", cellDates: false, cellNF: true });
    const readbackSheet = readback.Sheets[DATA_SHEET];
    if (readbackSheet === undefined) {
      throw new Error(`${series.id}: read-back is missing the ${JSON.stringify(DATA_SHEET)} sheet`);
    }
    const diffs = diffCells(excerptSheet, readbackSheet, keptRows, cols);
    if (diffs.length > 0) {
      console.error(`${series.id}: read-back comparison FAILED, ${diffs.length} differing cell(s):`);
      for (const line of diffs) {
        console.error(`  ${line}`);
      }
      process.exit(1);
    }

    const outPath = resolve(recordedDir, series.out);
    writeFileSync(outPath, outBytes);
    console.log(
      `${series.id}: wrote ${series.out} (${outBytes.byteLength} bytes), ` +
        `${keptRows.length} rows kept, read-back comparison PASSED`,
    );
  }

  console.log("\nAll EIA excerpts written and verified.");
}

main().catch((error) => {
  console.error(`prefetch-excerpt-eia failed: ${error.message}`);
  process.exit(1);
});
