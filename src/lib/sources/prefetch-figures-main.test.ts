// Tests for the Prefetch_Script entry (spec 04-real-figures, task 5; design.md
// "Script entry"). They drive `main(deps)` with every dependency injected —
// read, write, rename, exists, exit, log, errorLog, the clock, and a stub
// `Fetcher` returning the recorded excerpts — so the whole entry runs with no
// disk and no network (R2.6, Testing Strategy, R8.1). One case opts into a real
// temp directory to prove the atomic temp-then-rename replace touches a real
// file and leaves it byte-identical when a run fails (R6.3, R7.8, R8.7).
//
// This file lives beside the sources module it supports, under
// src/lib/sources/, so it is both owned by the data-dev agent (agents.json)
// and collected by Vitest's `unit` project (the config scans `src/**`, not
// `scripts/**`). It is a pure unit test: it needs no database, so it stays in
// the parallel unit project rather than the serialised integration one.
//
// The entry prints only what the Report and the error already carry. Every
// printed line is matched against its fixed `formatReportLine` form (the single
// place the wording lives) in the entry's fixed order, and every captured line
// — stdout and stderr — is scanned for the banned direction words (rose, fell,
// improved, worsened, corrected, revised): the entry stays as neutral as the
// layers it drives (neutrality.md).
//
// Every expected figure value is the publisher's own byte from the recorded
// excerpts; where a shape the excerpts do not contain is needed (a backfill)
// a clearly-fake far-future period is injected, never a number presented as
// real (data-integrity.md).

import {
  constants as fsConstants,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import {
  access,
  readFile as readFilePromise,
  writeFile as writeFilePromise,
  rename as renamePromise,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { formatReportLine, type Report } from "@/lib/sources/refresh";
import { runPrefetch } from "@/lib/sources/prefetch";
import { BULLETIN_PAGE } from "@/lib/sources/oil-bulletin";
import type { FetchResult, Fetcher } from "@/lib/sources/types";

import { main, type MainDeps } from "../../../scripts/prefetch-figures-main";

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
const BULLETIN_XLSX = readExcerpt("oil-bulletin-prices-with-taxes.xlsx");
const BULLETIN_HTML = readFileSync(
  join(RECORDED_DIR, "oil-bulletin-page.html"),
  "utf8",
);

const GASOLINE_SERIES = "EMM_EPMR_PTE_NUS_DPG";
const DIESEL_SERIES = "EMD_EPD2D_PTE_NUS_DPG";
const GASOLINE_URL = `https://www.eia.gov/dnav/pet/hist_xls/${GASOLINE_SERIES}w.xls`;
const DIESEL_URL = `https://www.eia.gov/dnav/pet/hist_xls/${DIESEL_SERIES}w.xls`;
const RESOLVED_FILE_URL =
  "https://energy.ec.europa.eu/document/download/906e60ca-8b6a-44e7-8589-652854d2fd3f_en?filename=Weekly_Oil_Bulletin_Prices_History_maticni_4web.xlsx";

const GASOLINE = "us-gasoline-regular";

// The relative path the entry refreshes (its own TARGET_PATH constant). The
// entry reads and writes this exact path and derives the temp path next to it,
// so these tests intercept both in memory without touching the committed file.
const TARGET = "src/lib/figures/real/fuel-figures.json";
const TEMP = "src/lib/figures/real/.fuel-figures.json.tmp";

/** A fixed UTC clock so retrieved_at / downloadedAt are deterministic. */
const FIXED_NOW = new Date("2026-11-01T12:00:00Z");
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

// --- Stub fetcher -----------------------------------------------------------

/**
 * A stub Fetcher that serves the recorded bytes for every URL the run asks
 * for. `gasolineStatus` forces an adapter failure; any other URL throws so a
 * wrong request surfaces as a test failure.
 */
function recordedFetcher(options: { gasolineStatus?: number } = {}): Fetcher {
  return async (url: string): Promise<FetchResult> => {
    if (url === GASOLINE_URL) {
      return {
        status: options.gasolineStatus ?? 200,
        url,
        body: GASOLINE_BYTES,
      };
    }
    if (url === DIESEL_URL) {
      return { status: 200, url, body: DIESEL_BYTES };
    }
    if (url === BULLETIN_PAGE) {
      return {
        status: 200,
        url: BULLETIN_PAGE,
        body: new TextEncoder().encode(BULLETIN_HTML),
      };
    }
    if (url === RESOLVED_FILE_URL) {
      return { status: 200, url: RESOLVED_FILE_URL, body: BULLETIN_XLSX };
    }
    throw new Error(`unexpected URL requested: ${url}`);
  };
}

// --- In-memory capture ------------------------------------------------------

/** Everything one run of `main` emitted and did, captured for assertions. */
interface Capture {
  logs: string[];
  errors: string[];
  exitCode: number | null;
  writes: { file: string; text: string }[];
  renames: { from: string; to: string }[];
}

function newCapture(): Capture {
  return { logs: [], errors: [], exitCode: null, writes: [], renames: [] };
}

/**
 * Build a {@link MainDeps} over an in-memory file store, with a stub fetcher
 * and the fixed clock threaded into `runPrefetch`. `initial` seeds the target
 * file (absent when omitted, so the first run passes null). Writes and renames
 * mutate `store`, so a success leaves it holding the new target bytes and a
 * failure leaves it exactly as seeded.
 */
function memoryDeps(options: {
  store: Map<string, string>;
  capture: Capture;
  fetcher: Fetcher;
  initial?: string;
}): MainDeps {
  const { store, capture, fetcher } = options;
  if (options.initial !== undefined) store.set(TARGET, options.initial);

  return {
    readFile: async (file) => {
      const text = store.get(file);
      if (text === undefined) throw new Error(`ENOENT: ${file}`);
      return text;
    },
    writeFile: async (file, text) => {
      capture.writes.push({ file, text });
      store.set(file, text);
    },
    rename: async (from, to) => {
      capture.renames.push({ from, to });
      const text = store.get(from);
      if (text === undefined) throw new Error(`ENOENT: ${from}`);
      store.set(to, text);
      store.delete(from);
    },
    exists: async (file) => store.has(file),
    exit: (code) => {
      capture.exitCode = code;
    },
    log: (line) => capture.logs.push(line),
    errorLog: (line) => capture.errors.push(line),
    now: fixedNow,
    fetcher,
  };
}

/** Every line `printReport` would emit for a report, in the entry's order. */
function expectedReportLines(report: Report): string[] {
  const lines: string[] = [];
  for (const s of report.perSeries) {
    lines.push(
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
    lines.push(formatReportLine({ kind: "revision", ...r }));
  }
  for (const b of report.backfills) {
    lines.push(formatReportLine({ kind: "backfill", ...b }));
  }
  for (const g of report.gaps) {
    lines.push(formatReportLine({ kind: "gap", ...g }));
  }
  for (const m of report.missingFromSource) {
    lines.push(formatReportLine({ kind: "missing-from-source", ...m }));
  }
  return lines;
}

// ---------------------------------------------------------------------------
// A first run from no file: one write, a temp-then-rename, exit 0.
// ---------------------------------------------------------------------------

describe("main — a first run from no file", () => {
  it("writes once to a temp file, renames it over the target, exits 0", async () => {
    const store = new Map<string, string>();
    const capture = newCapture();
    await main(memoryDeps({ store, capture, fetcher: recordedFetcher() }));

    // Exactly one write, to the temp path, then one rename of temp over target.
    expect(capture.writes).toHaveLength(1);
    expect(capture.writes[0].file).toBe(TEMP);
    expect(capture.renames).toEqual([{ from: TEMP, to: TARGET }]);

    // The target now holds exactly the bytes that were written to the temp.
    expect(store.get(TARGET)).toBe(capture.writes[0].text);

    // Exit 0, no error line.
    expect(capture.exitCode).toBe(0);
    expect(capture.errors).toHaveLength(0);
  });

  it("the printed Report lines match their fixed formatReportLine forms, in order", async () => {
    // The oracle: the same recorded fetcher and clock through runPrefetch.
    const { report } = await runPrefetch(null, {
      fetcher: recordedFetcher(),
      now: fixedNow,
    });

    const store = new Map<string, string>();
    const capture = newCapture();
    await main(memoryDeps({ store, capture, fetcher: recordedFetcher() }));

    // Every stdout line equals formatReportLine of the report, same order. The
    // first-run report has four `added` lines (gasoline, diesel, petrol,
    // eu-diesel, in catalogue order) and no revisions, gaps or missing lines.
    expect(capture.logs).toEqual(expectedReportLines(report));
    expect(capture.logs).toEqual([
      "added us-gasoline-regular 5 first 2023-06-05 last 2026-10-26",
      "added us-diesel 5 first 2023-06-05 last 2026-10-26",
      "added eu-petrol-euro95 6 first 2023-06-05 last 2026-10-26",
      "added eu-diesel 6 first 2023-06-05 last 2026-10-26",
    ]);

    for (const line of capture.logs) assertNoBannedWords(line);
    assertNoBannedWords(store.get(TARGET) as string);
  });
});

// ---------------------------------------------------------------------------
// A backfill: the backfill line prints, exit 1, and nothing is written.
// ---------------------------------------------------------------------------

/**
 * A committed figure file holding, for gasoline, a single figure at a period
 * later than any the excerpt reaches. Every real excerpt gasoline period is
 * then both new and earlier than that latest — a backfill, which fails the run.
 */
async function backfillSeededFile(): Promise<string> {
  const baseline = await runPrefetch(null, {
    fetcher: recordedFetcher(),
    now: fixedNow,
  });
  const file = JSON.parse(baseline.text) as {
    figures: { metric_id: string; period: string }[];
  };
  const template = file.figures.find(
    (f) => f.metric_id === GASOLINE && f.period === "2026-10-26",
  );
  if (template === undefined) throw new Error("expected a gasoline figure");
  const future = { ...(template as object), period: "2027-01-04" };
  file.figures = [
    ...file.figures.filter((f) => f.metric_id !== GASOLINE),
    future as (typeof file.figures)[number],
  ];
  return JSON.stringify(file);
}

describe("main — a backfill case", () => {
  it("prints the backfill line, exits 1, and never calls write", async () => {
    const seeded = await backfillSeededFile();
    const store = new Map<string, string>();
    const capture = newCapture();

    await main(
      memoryDeps({
        store,
        capture,
        fetcher: recordedFetcher(),
        initial: seeded,
      }),
    );

    // Exit 1, no write, no rename: the target is replaced only by a rename
    // after a full successful run, and this run failed before any write.
    expect(capture.exitCode).toBe(1);
    expect(capture.writes).toHaveLength(0);
    expect(capture.renames).toHaveLength(0);

    // The seeded target is untouched in the store.
    expect(store.get(TARGET)).toBe(seeded);

    // Exactly one `prefetch failed:` line on stderr.
    expect(capture.errors).toHaveLength(1);
    expect(capture.errors[0].startsWith("prefetch failed: ")).toBe(true);

    // At least one backfill line was printed to stdout before the failure, and
    // each matches the fixed `backfill <metricId> <period> latest <latest>`
    // form for gasoline against the far-future latest.
    const backfillLines = capture.logs.filter((l) => l.startsWith("backfill "));
    expect(backfillLines.length).toBeGreaterThan(0);
    for (const line of backfillLines) {
      expect(line).toBe(
        formatReportLine({
          kind: "backfill",
          metricId: GASOLINE,
          period: line.split(" ")[2],
          latest: "2027-01-04",
        }),
      );
    }

    for (const line of capture.logs) assertNoBannedWords(line);
    for (const line of capture.errors) assertNoBannedWords(line);
  });
});

// ---------------------------------------------------------------------------
// The same backfill case against a real temp directory and real fs functions.
// ---------------------------------------------------------------------------

describe("main — a backfill against a real file leaves its bytes identical", () => {
  it("runs with real read/write/rename over a temp dir and does not change the target", async () => {
    const dir = mkdtempSync(join(tmpdir(), "revenant-prefetch-"));
    try {
      const target = join(dir, "fuel-figures.json");
      const temp = join(dir, ".fuel-figures.json.tmp");
      const seeded = await backfillSeededFile();
      writeFileSync(target, seeded, "utf8");
      const before = readFileSync(target);

      const capture = newCapture();
      // Real fs functions, redirecting the entry's two fixed paths (its own
      // TARGET_PATH and the temp beside it) onto the temp-dir files, so the
      // atomic replace is exercised against a real disk.
      const redirect = (p: string): string =>
        p === TARGET ? target : p === TEMP ? temp : p;

      const deps: MainDeps = {
        readFile: (file) => readFilePromise(redirect(file), "utf8"),
        writeFile: (file, text) =>
          writeFilePromise(redirect(file), text, "utf8"),
        rename: (from, to) => renamePromise(redirect(from), redirect(to)),
        exists: async (file) => {
          try {
            await access(redirect(file), fsConstants.F_OK);
            return true;
          } catch {
            return false;
          }
        },
        exit: (code) => {
          capture.exitCode = code;
        },
        log: (line) => capture.logs.push(line),
        errorLog: (line) => capture.errors.push(line),
        now: fixedNow,
        fetcher: recordedFetcher(),
      };

      await main(deps);

      // The run failed on the backfill: exit 1 and the target file on disk is
      // byte-for-byte what it was before the run.
      expect(capture.exitCode).toBe(1);
      const after = readFileSync(target);
      expect(after.equals(before)).toBe(true);
      expect(capture.errors).toHaveLength(1);
      expect(capture.errors[0].startsWith("prefetch failed: ")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// An adapter failure: one `prefetch failed:` line, exit 1, file untouched.
// ---------------------------------------------------------------------------

describe("main — an adapter failure", () => {
  it("prints one `prefetch failed:` line, exits 1, and leaves the file untouched", async () => {
    const existing = JSON.stringify({
      fixture: false,
      note: "",
      series: [],
      figures: [],
    });
    const store = new Map<string, string>();
    const capture = newCapture();

    await main(
      memoryDeps({
        store,
        capture,
        fetcher: recordedFetcher({ gasolineStatus: 500 }),
        initial: existing,
      }),
    );

    // Exit 1, no write, no rename, and the seeded file is unchanged.
    expect(capture.exitCode).toBe(1);
    expect(capture.writes).toHaveLength(0);
    expect(capture.renames).toHaveLength(0);
    expect(store.get(TARGET)).toBe(existing);

    // Exactly one `prefetch failed:` line, and a SourceError carries no report
    // so nothing was printed to stdout before it.
    expect(capture.errors).toHaveLength(1);
    expect(capture.errors[0].startsWith("prefetch failed: ")).toBe(true);
    expect(capture.logs).toHaveLength(0);

    for (const line of capture.errors) assertNoBannedWords(line);
  });
});

// ---------------------------------------------------------------------------
// Every printed and error line, across all cases, is free of direction words.
// ---------------------------------------------------------------------------

describe("main — no printed or error line carries a banned direction word", () => {
  it("scans every stdout and stderr line of a success and a backfill run", async () => {
    // Success run.
    {
      const store = new Map<string, string>();
      const capture = newCapture();
      await main(memoryDeps({ store, capture, fetcher: recordedFetcher() }));
      for (const line of capture.logs) assertNoBannedWords(line);
      for (const line of capture.errors) assertNoBannedWords(line);
    }
    // Backfill run.
    {
      const seeded = await backfillSeededFile();
      const store = new Map<string, string>();
      const capture = newCapture();
      await main(
        memoryDeps({
          store,
          capture,
          fetcher: recordedFetcher(),
          initial: seeded,
        }),
      );
      for (const line of capture.logs) assertNoBannedWords(line);
      for (const line of capture.errors) assertNoBannedWords(line);
    }
  });
});
