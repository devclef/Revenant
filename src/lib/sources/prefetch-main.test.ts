/* eslint-disable @typescript-eslint/ban-ts-comment -- @ts-nocheck is needed here, see the next line */
// @ts-nocheck: the Docker builder stage does not copy scripts/prefetch-*, so the import below is unresolved there (R6.7). Vitest still runs this file.
// Tests for the fail-closed Prefetch_Script entry (spec 18, design.md section 3,
// tasks 2.2 and the coverage source scan). They drive `main(deps)` over an
// in-memory file store, so no disk and no network are touched.
//
// Each fail-closed finding kind gets one example: the entry prints the finding
// line, prints `prefetch failed: <kind>`, exits 1 and leaves both committed
// files byte-for-byte unchanged. One passing run writes both files and exits 0.
// The coverage needs come from the Persona_List, and a source scan checks that
// neither prefetch.ts nor the entry holds an ISO date literal.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PERSONAS } from "@/lib/personas";
import {
  PrefetchError,
  type CoverageNeed,
  type PrefetchErrorKind,
  type PrefetchFinding,
} from "@/lib/sources/prefetch";
import { BULLETIN_PAGE } from "@/lib/sources/oil-bulletin";
import type { FetchResult, Fetcher } from "@/lib/sources/types";

import {
  buildCoverage,
  main,
  STATUS_PATH,
  TARGET_PATH,
  type MainDeps,
} from "../../../scripts/prefetch-figures-main";

// --- Recorded excerpts, read from disk as bytes ------------------------------

const RECORDED_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "__recorded__",
);
const readExcerpt = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(join(RECORDED_DIR, name)));

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

const FIXED_NOW = new Date("2026-11-01T12:00:00Z");
const fixedNow = (): Date => FIXED_NOW;

// --- Global fetch guard (no network) -----------------------------------------

const realFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = async () => {
    throw new Error("network access is not allowed in the prefetch tests");
  };
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** A stub fetcher serving the recorded bytes; `gasolineStatus` forces a source failure. */
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

// --- In-memory entry dependencies --------------------------------------------

interface Capture {
  logs: string[];
  errors: string[];
  exitCode: number | null;
  writes: string[];
  renames: string[];
}

const newCapture = (): Capture => ({
  logs: [],
  errors: [],
  exitCode: null,
  writes: [],
  renames: [],
});

/**
 * Build {@link MainDeps} over `store`, a Map of path to text. A success writes
 * through a temp file and renames it over the target; a failure never reaches
 * either step, so the map keeps the seeded bytes.
 */
function memoryDeps(options: {
  store: Map<string, string>;
  capture: Capture;
  run?: MainDeps["run"];
  fetcher?: Fetcher;
  coverage?: readonly CoverageNeed[];
}): MainDeps {
  const { store, capture } = options;
  return {
    readFile: async (file) => {
      const text = store.get(file);
      if (text === undefined) throw new Error(`ENOENT: ${file}`);
      return text;
    },
    writeFile: async (file, text) => {
      capture.writes.push(file);
      store.set(file, text);
    },
    rename: async (from, to) => {
      capture.renames.push(to);
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
    fetcher: options.fetcher,
    run: options.run,
    coverage: options.coverage,
  };
}

/** The committed bytes both files hold before a run. */
const SEED_TARGET = '{"seed": true}\n';
const SEED_STATUS = '{"us-diesel": "2026-11-01T12:00:00Z"}\n';

function seededStore(): Map<string, string> {
  return new Map([
    [TARGET_PATH, SEED_TARGET],
    [STATUS_PATH, SEED_STATUS],
  ]);
}

/** Printed lines must never carry a URL or a secret. */
function expectNoUrlOrSecret(lines: readonly string[]): void {
  for (const line of lines) {
    expect(line).not.toMatch(/https?:\/\//);
    expect(line.toLowerCase()).not.toContain("api_key");
  }
}

// --- One failing example per finding kind -------------------------------------

describe("main — each fail-closed finding fails closed", () => {
  const stubCases: [PrefetchErrorKind, PrefetchFinding, string][] = [
    [
      "weekly_gap",
      {
        metricId: "us-gasoline-regular",
        before: "2024-11-04",
        after: "2024-11-18",
      },
      "weekly-gap us-gasoline-regular 2024-11-04 2024-11-18",
    ],
    [
      "opening_coverage",
      { metricId: "us-diesel", latest: null },
      "opening-coverage us-diesel latest none",
    ],
    [
      "provenance",
      { metricId: "us-diesel", period: "2024-11-04", field: "unit" },
      "provenance us-diesel 2024-11-04 unit",
    ],
  ];

  it.each(stubCases)(
    "%s: prints its finding line, prints the kind, exits 1, writes nothing",
    async (kind, finding, line) => {
      const store = seededStore();
      const before = new Map(store);
      const capture = newCapture();
      await main(
        memoryDeps({
          store,
          capture,
          run: async () => {
            throw new PrefetchError(kind, `${kind}: stub`, null, [finding]);
          },
        }),
      );

      expect(capture.exitCode).toBe(1);
      expect(capture.logs).toEqual([line]);
      expect(capture.errors).toEqual([`prefetch failed: ${kind}`]);
      expect(capture.writes).toEqual([]);
      expect(capture.renames).toEqual([]);
      expect(store).toEqual(before);
      expectNoUrlOrSecret([...capture.logs, ...capture.errors]);
    },
  );

  it("series_failed: a failed download prints its series line, exits 1, leaves both files unchanged", async () => {
    // No committed files: the all-or-nothing rule must also leave nothing behind.
    const store = new Map();
    const capture = newCapture();
    await main(
      memoryDeps({
        store,
        capture,
        fetcher: recordedFetcher({ gasolineStatus: 500 }),
      }),
    );

    expect(capture.exitCode).toBe(1);
    expect(capture.logs).toEqual([
      "series-failed us-gasoline-regular reason=source http_status",
    ]);
    expect(capture.errors).toEqual(["prefetch failed: series_failed"]);
    expect(capture.writes).toEqual([]);
    expect(store.size).toBe(0);
    expectNoUrlOrSecret([...capture.logs, ...capture.errors]);
  });
});

// --- One passing run ----------------------------------------------------------

describe("main — a passing run", () => {
  it("writes both files, prints the report and exits 0", async () => {
    // The recorded excerpts are sparse extracts, not weekly histories, so the
    // persona Weekly_Gap check would report gaps on them. This run passes no
    // coverage needs to isolate the write path; the persona needs are covered
    // by the coverage-from-Persona_List cases below and by the real run.
    const store = new Map();
    const capture = newCapture();
    await main(
      memoryDeps({
        store,
        capture,
        fetcher: recordedFetcher(),
        coverage: [],
      }),
    );

    expect(capture.exitCode).toBe(0);
    expect(capture.errors).toEqual([]);
    expect(store.has(TARGET_PATH)).toBe(true);
    expect(store.has(STATUS_PATH)).toBe(true);
    expect(capture.renames).toEqual([TARGET_PATH, STATUS_PATH]);
  });
});

// --- Coverage comes from the Persona_List ------------------------------------

describe("main — coverage from the Persona_List", () => {
  it("passes the persona coverage needs to the run", async () => {
    const received: unknown[] = [];
    const capture = newCapture();
    await main(
      memoryDeps({
        store: seededStore(),
        capture,
        run: async (_existing, deps) => {
          received.push(deps.coverage);
          throw new PrefetchError("series_failed", "stub", null, []);
        },
      }),
    );

    expect(received[0]).toEqual(buildCoverage(PERSONAS));
    expect(received[0]).toHaveLength(4);
  });

  it("builds each window from the date part of opens_at and the six days before it", () => {
    const personas = [
      {
        opens_at: "2024-11-05T00:00:00.000Z",
        metrics: [{ metric_id: "us-diesel" }],
      },
    ];
    expect(buildCoverage(personas)).toEqual([
      { metricId: "us-diesel", from: "2024-10-30", to: "2024-11-05" },
    ]);
  });
});

// --- Source scan: no ISO date literal in the prefetch code --------------------

describe("source scan — coverage holds no date literal", () => {
  const REPO_ROOT = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "..",
  );
  const SCANNED = [
    "src/lib/sources/prefetch.ts",
    "scripts/prefetch-figures-main.ts",
  ];
  const ISO_DATE = /\d{4}-\d{2}-\d{2}/;

  it.each(SCANNED)("%s holds no ISO date literal", (relative) => {
    const text = readFileSync(join(REPO_ROOT, relative), "utf8");
    expect(text).not.toMatch(ISO_DATE);
  });
});
