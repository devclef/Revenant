// One-off recorder for the Oil Bulletin test excerpts (04-real-figures, task 3).
//
// Run BY HAND once, with internet access, from the worktree root:
//
//     node scripts/prefetch-excerpt-bulletin.mjs
//
// Nothing imports this file and no test runs it (R8.9). It is a developer tool
// that produces the committed Recorded_Excerpts the Oil Bulletin tests read:
//
//   src/lib/sources/__recorded__/oil-bulletin-prices-with-taxes.xlsx  (+ .note.txt)
//   src/lib/sources/__recorded__/oil-bulletin-page.html               (+ .note.txt)
//
// It reads no secret, sets no header or credential, and calls only
// energy.ec.europa.eu (the Weekly Oil Bulletin page and the single history
// workbook linked from it). See design.md "Recorded excerpts".
//
// The workbook excerpt is a BYTE-LEVEL slice, never a re-encode: the real
// .xlsx is unzipped, rows and cells in the "Prices with taxes" sheet XML are
// deleted AS TEXT (leaving every kept <v> the publisher's bytes, unchanged),
// the other sheets and the comments / drawings / printer-settings parts are
// dropped from the package, and the result is zipped again. The parser reads
// the slice back to the same cells it read from the full file.
//
// Zip handling uses the system `unzip` and `zip` binaries through child_process
// rather than a new dependency: this tool is hand-run only, outside the app,
// the build and the test suite.

import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
  statSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RECORDED_DIR = resolve(ROOT, "src/lib/sources/__recorded__");

// --- What we fetch ---------------------------------------------------------

// The landing page and the exact history-file name, kept in step with
// oil-bulletin.ts. Only energy.ec.europa.eu is ever contacted.
const BULLETIN_PAGE =
  "https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en";
const BULLETIN_FILE_NAME =
  "Weekly_Oil_Bulletin_Prices_History_maticni_4web.xlsx";
const ALLOWED_HOST = "energy.ec.europa.eu";

// --- What the slice keeps --------------------------------------------------

// The only sheet kept. Everything else (sheets, comments, drawings, printer
// settings) is removed from the package.
const SHEET_NAME = "Prices with taxes";

// Header rows (1-3) and footer rows (1096 "Notes:" and 1097) kept by row
// number. Data rows are kept by DATE, not by row number, because the publisher
// adds a new week at the top each Monday and every row below shifts down.
const HEADER_ROWS = [1, 2, 3];
const FOOTER_ROWS = [1096, 1097];

// The data rows kept, chosen so the tests exercise the demo windows and today:
// three recent weeks, the two persona "then" weeks (2024-05-06, 2024-11-04),
// and the two weeks straddling Coverage_Start (2023-06-01): 2023-06-05 is the
// first in-window week, 2023-05-29 the last out-of-window one.
const DATA_DATES = [
  "2026-10-26",
  "2026-10-19",
  "2026-10-12",
  "2024-11-04",
  "2024-05-06",
  "2023-06-05",
  "2023-05-29",
];

// Only columns A-D are kept on every row. Columns E onward (other member
// states and aggregates) are dropped cell by cell.
const KEEP_COLUMNS = new Set(["A", "B", "C", "D"]);

const MAX_XLSX_BYTES = 100_000;

// The 1900 date system with the Lotus leap-year bug, matching serialToDate:
// serial 1 is 1899-12-31 and serial 61 is 1900-03-01. We only need the serial
// for the small set of DATA_DATES, so a direct day count is enough here.
function dateToSerial(iso) {
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  // Days from 1899-12-30 (serial 0) using a civil-date day count, then add the
  // single phantom day for 1900-02-29 that the 1900 system includes.
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  const jdn =
    d +
    Math.floor((153 * mm + 2) / 5) +
    365 * yy +
    Math.floor(yy / 4) -
    Math.floor(yy / 100) +
    Math.floor(yy / 400) -
    32045;
  const jdn18991230 = 2415019; // Julian day number of 1899-12-30.
  let serial = jdn - jdn18991230;
  if (serial >= 60) serial += 1; // Phantom 1900-02-29.
  return serial;
}

const DATA_SERIALS = new Set(DATA_DATES.map((d) => dateToSerial(d)));

// --- Small helpers ---------------------------------------------------------

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "buffer", ...opts });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    const stderr = r.stderr ? r.stderr.toString("utf8") : "";
    throw new Error(`${cmd} ${args.join(" ")} failed (${r.status}): ${stderr}`);
  }
  return r;
}

function hostOf(url) {
  return new URL(url).host;
}

async function fetchBytes(url) {
  if (hostOf(url) !== ALLOWED_HOST) {
    throw new Error(`refusing to fetch off-host URL: ${url}`);
  }
  const res = await fetch(url, { redirect: "follow", credentials: "omit" });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  if (hostOf(res.url) !== ALLOWED_HOST) {
    throw new Error(`redirected off-host: ${res.url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { bytes: buf, finalUrl: res.url };
}

function nowUtc() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

// The <v> value of column A in a <row> element's XML, as the publisher's text.
// Returns null when the row has no column-A numeric cell (header/footer rows).
function columnAValue(rowXml) {
  // Match the A<n> cell and capture its <v> text verbatim.
  const cell = rowXml.match(/<c\b[^>]*\br="A\d+"[^>]*>([\s\S]*?)<\/c>/);
  if (!cell) return null;
  const v = cell[1].match(/<v>([\s\S]*?)<\/v>/);
  return v ? v[1] : null;
}

function rowNumberOf(rowXml) {
  const m = rowXml.match(/<row\b[^>]*\br="(\d+)"/);
  return m ? Number(m[1]) : null;
}

// Drop every cell whose column letter is not in KEEP_COLUMNS, editing the row
// XML as text so kept cells (and their <v> bytes) are untouched.
function keepColumnsAD(rowXml) {
  return rowXml.replace(
    /<c\b[^>]*\br="([A-Z]+)\d+"[^>]*(?:\/>|>[\s\S]*?<\/c>)/g,
    (match, col) => (KEEP_COLUMNS.has(col) ? match : ""),
  );
}

// --- Workbook slicing ------------------------------------------------------

function sheetXmlPathForName(workDir, name) {
  const workbookXml = readFileSync(
    join(workDir, "xl", "workbook.xml"),
    "utf8",
  );
  const relsXml = readFileSync(
    join(workDir, "xl", "_rels", "workbook.xml.rels"),
    "utf8",
  );

  // sheet name -> r:id
  const sheetRe =
    /<sheet\b[^>]*\bname="([^"]*)"[^>]*\br:id="([^"]*)"[^>]*\/?>/g;
  let rid = null;
  for (let m = sheetRe.exec(workbookXml); m; m = sheetRe.exec(workbookXml)) {
    if (m[1] === name) {
      rid = m[2];
      break;
    }
  }
  if (!rid) throw new Error(`sheet "${name}" not found in workbook.xml`);

  // r:id -> target path (relative to xl/)
  const relRe = /<Relationship\b[^>]*\bId="([^"]*)"[^>]*\bTarget="([^"]*)"[^>]*\/?>/g;
  let target = null;
  for (let m = relRe.exec(relsXml); m; m = relRe.exec(relsXml)) {
    if (m[1] === rid) {
      target = m[2];
      break;
    }
  }
  if (!target) throw new Error(`relationship ${rid} not found in rels`);
  const clean = target.replace(/^\/?xl\//, "").replace(/^\.\//, "");
  return join(workDir, "xl", clean);
}

function sliceSheetXml(sheetPath) {
  const xml = readFileSync(sheetPath, "utf8");

  const sheetDataMatch = xml.match(/<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/);
  if (!sheetDataMatch) throw new Error("no <sheetData> in sheet XML");
  const sheetData = sheetDataMatch[1];

  const rowRe = /<row\b[\s\S]*?(?:\/>|<\/row>)/g;
  const kept = [];
  for (let m = rowRe.exec(sheetData); m; m = rowRe.exec(sheetData)) {
    const rowXml = m[0];
    const n = rowNumberOf(rowXml);
    const aValue = columnAValue(rowXml);
    const isHeader = n !== null && HEADER_ROWS.includes(n);
    const isFooter = n !== null && FOOTER_ROWS.includes(n);
    const isData =
      aValue !== null &&
      /^\d+(?:\.\d+)?$/.test(aValue) &&
      DATA_SERIALS.has(Math.trunc(Number(aValue)));
    if (isHeader || isFooter || isData) {
      kept.push(keepColumnsAD(rowXml));
    }
  }

  const foundSerials = new Set(
    kept
      .map((r) => columnAValue(r))
      .filter((v) => v !== null && /^\d+(?:\.\d+)?$/.test(v))
      .map((v) => Math.trunc(Number(v))),
  );
  for (const [iso, serial] of DATA_DATES.map((d) => [d, dateToSerial(d)])) {
    if (!foundSerials.has(serial)) {
      throw new Error(
        `data row for ${iso} (serial ${serial}) not found in the workbook`,
      );
    }
  }

  const newSheetData = `<sheetData>${kept.join("")}</sheetData>`;
  const newXml = xml.replace(
    /<sheetData\b[^>]*>[\s\S]*?<\/sheetData>/,
    newSheetData,
  );
  writeFileSync(sheetPath, newXml, "utf8");
}

// Remove every worksheet part except the kept one, and the comments, drawings
// and printerSettings parts, from the unpacked package.
function pruneParts(workDir, keptSheetPath) {
  const keptRel = relative(workDir, keptSheetPath).split("\\").join("/");

  function walk(dir, out) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p, out);
      else out.push(p);
    }
  }
  const all = [];
  walk(workDir, all);

  for (const p of all) {
    const rel = relative(workDir, p).split("\\").join("/");
    const isWorksheet = /^xl\/worksheets\/[^/]+\.xml$/.test(rel);
    const isOtherSheet = isWorksheet && rel !== keptRel;
    const isComment = /^xl\/(threadedComments|comments)/.test(rel);
    const isDrawing = /^xl\/drawings\//.test(rel);
    const isPrinter = /printerSettings\//.test(rel);
    const isSheetRels =
      /^xl\/worksheets\/_rels\//.test(rel) && !rel.includes(keptRel);
    if (isOtherSheet || isComment || isDrawing || isPrinter || isSheetRels) {
      rmSync(p, { force: true });
    }
  }

  // Drop <sheet> entries for removed sheets from workbook.xml so the package
  // stays consistent. Keep only the sheet whose name is SHEET_NAME.
  const wbPath = join(workDir, "xl", "workbook.xml");
  let wb = readFileSync(wbPath, "utf8");
  wb = wb.replace(/<sheets>([\s\S]*?)<\/sheets>/, (_all, inner) => {
    const kept = [];
    const sheetRe = /<sheet\b[^>]*\/?>/g;
    for (let m = sheetRe.exec(inner); m; m = sheetRe.exec(inner)) {
      const nameMatch = m[0].match(/\bname="([^"]*)"/);
      if (nameMatch && nameMatch[1] === SHEET_NAME) kept.push(m[0]);
    }
    return `<sheets>${kept.join("")}</sheets>`;
  });
  writeFileSync(wbPath, wb, "utf8");
}

function repackage(workDir, outPath) {
  if (existsSync(outPath)) rmSync(outPath, { force: true });
  // [Content_Types].xml must be the first entry and stored; zip handles order
  // by argument. We add it first, then the rest.
  run("zip", ["-X", "-q", outPath, "[Content_Types].xml"], { cwd: workDir });
  run("zip", ["-X", "-q", "-r", outPath, "."], { cwd: workDir });
}

// --- HTML slice ------------------------------------------------------------

// Keep the region of the page around the "Price developments" links so the
// history-file link and at least one other .xlsx link survive, letting the
// exactly-one-match rule be tested. Falls back to the whole page if the anchor
// text is not found (the parser only needs the hrefs present).
function slicePageHtml(html) {
  const needle = /price developments/i;
  const idx = html.search(needle);
  const window = 20_000;
  let slice;
  if (idx === -1) {
    slice = html;
  } else {
    const start = Math.max(0, idx - 4_000);
    const end = Math.min(html.length, idx + window);
    slice = html.slice(start, end);
  }

  // Confirm the slice still carries the history link and another .xlsx link.
  const hrefRe = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
  let historyLinks = 0;
  let otherXlsx = 0;
  for (let m = hrefRe.exec(slice); m; m = hrefRe.exec(slice)) {
    const raw = (m[1] ?? m[2] ?? m[3] ?? "").replace(/&amp;/gi, "&");
    if (raw.includes(`filename=${BULLETIN_FILE_NAME}`)) historyLinks += 1;
    else if (/\.xlsx(\?|$|["'&])/i.test(raw)) otherXlsx += 1;
  }
  if (historyLinks !== 1) {
    throw new Error(
      `HTML slice carries ${historyLinks} history links, expected exactly 1`,
    );
  }
  if (otherXlsx < 1) {
    throw new Error("HTML slice carries no other .xlsx link to test against");
  }
  return `<!-- Recorded excerpt of ${BULLETIN_PAGE} -->\n${slice}`;
}

// --- Note files ------------------------------------------------------------

function writeNote(artifactPath, downloadUrl, recordedAt, keeps, howMade) {
  const note =
    `${relative(ROOT, artifactPath)}\n` +
    `\n` +
    `Recorded excerpt of a real file. NOT for display: the numbers it carries\n` +
    `are a test fixture, must never be shown to a user or treated as a figure,\n` +
    `and are the publisher's bytes kept only so the parser can be tested.\n` +
    `\n` +
    `Source URL:   ${downloadUrl}\n` +
    `Recorded at:  ${recordedAt} (UTC)\n` +
    `Recorded by:  scripts/prefetch-excerpt-bulletin.mjs\n` +
    `\n` +
    `Keeps:\n${keeps}\n` +
    `\n` +
    `How it was made:\n${howMade}\n`;
  writeFileSync(`${artifactPath}.note.txt`, note, "utf8");
}

// --- Main ------------------------------------------------------------------

async function main() {
  mkdirSync(RECORDED_DIR, { recursive: true });
  const recordedAt = nowUtc();

  // 1. The landing page.
  console.log(`Fetching page: ${BULLETIN_PAGE}`);
  const page = await fetchBytes(BULLETIN_PAGE);
  const html = page.bytes.toString("utf8");

  // Find the single history-workbook link, the same rule the adapter uses.
  const hrefRe = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
  const matches = [];
  for (let m = hrefRe.exec(html); m; m = hrefRe.exec(html)) {
    const raw = (m[1] ?? m[2] ?? m[3] ?? "").replace(/&amp;/gi, "&");
    let url;
    try {
      url = new URL(raw, BULLETIN_PAGE);
    } catch {
      continue;
    }
    if (url.searchParams.get("filename") === BULLETIN_FILE_NAME) {
      matches.push(url.toString());
    }
  }
  if (matches.length !== 1) {
    throw new Error(
      `expected exactly one history-workbook link on the page, found ${matches.length}`,
    );
  }
  const workbookUrl = matches[0];

  // 2. The workbook.
  console.log(`Fetching workbook: ${workbookUrl}`);
  const workbook = await fetchBytes(workbookUrl);

  // 3. Byte-level slice of the .xlsx.
  const tmp = mkdtempSync(join(tmpdir(), "revenant-bulletin-"));
  const srcXlsx = join(tmp, "full.xlsx");
  const workDir = join(tmp, "unpacked");
  try {
    writeFileSync(srcXlsx, workbook.bytes);
    mkdirSync(workDir, { recursive: true });
    run("unzip", ["-o", "-q", srcXlsx, "-d", workDir]);

    const sheetPath = sheetXmlPathForName(workDir, SHEET_NAME);
    sliceSheetXml(sheetPath);
    pruneParts(workDir, sheetPath);

    const outXlsx = join(RECORDED_DIR, "oil-bulletin-prices-with-taxes.xlsx");
    repackage(workDir, outXlsx);

    const size = statSync(outXlsx).size;
    if (size > MAX_XLSX_BYTES) {
      throw new Error(
        `workbook excerpt is ${size} bytes, over the ${MAX_XLSX_BYTES} limit`,
      );
    }
    console.log(`Wrote ${relative(ROOT, outXlsx)} (${size} bytes)`);

    writeNote(
      outXlsx,
      workbookUrl,
      recordedAt,
      `  Sheet "${SHEET_NAME}" only; columns A-D only.\n` +
        `  Rows: header rows 1-3, footer rows 1096-1097, and the data rows for\n` +
        `  ${DATA_DATES.join(", ")}.\n` +
        `  All other sheets, comments, drawings and printer settings removed.`,
      `  The real .xlsx was unzipped; rows and cells in the sheet XML were\n` +
        `  deleted as text (every kept <v> is the publisher's bytes, unchanged);\n` +
        `  the other sheets and the comments/drawings/printerSettings parts were\n` +
        `  removed from the package; the result was zipped again.`,
    );

    // 4. HTML slice.
    const outHtml = join(RECORDED_DIR, "oil-bulletin-page.html");
    const slice = slicePageHtml(html);
    writeFileSync(outHtml, slice, "utf8");
    console.log(
      `Wrote ${relative(ROOT, outHtml)} (${Buffer.byteLength(slice)} bytes)`,
    );
    writeNote(
      outHtml,
      page.finalUrl,
      recordedAt,
      `  The text around the "Price developments" links, including the single\n` +
        `  history-file link (filename=${BULLETIN_FILE_NAME}) and at least one\n` +
        `  other .xlsx link, so the exactly-one-match rule is testable.`,
      `  The landing page HTML was fetched and a region around the\n` +
        `  "Price developments" anchor was sliced out verbatim.`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(`prefetch-excerpt-bulletin: ${err.message}`);
  process.exit(1);
});
