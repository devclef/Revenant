// Property-based tests for the Prefetch_Script rules (spec 18-persona-dates,
// design.md section 3, tasks 2.3 to 2.7). Properties 1, 2 and 5 check the pure
// finders. Properties 3 and 4 drive `runPrefetch` over the committed
// Recorded_Excerpts through a stub Fetcher and a fixed clock, so no test touches
// the network (R2.6, R8.1). Each property runs 100 generated cases.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import fc from "fast-check";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { FigureV1 } from "@/lib/seal-format";

import { BULLETIN_PAGE } from "./oil-bulletin";
import {
  PrefetchError,
  findCoverageMisses,
  findProvenanceMismatches,
  findWeeklyGaps,
  runPrefetch,
  type CoverageNeed,
  type PrefetchOutcome,
  type ProvenanceField,
} from "./prefetch";
import type { FetchResult, Fetcher } from "./types";

// --- Recorded excerpts, read from disk as bytes ------------------------------

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

// --- Ids, URLs and clocks ----------------------------------------------------

const GASOLINE = "us-gasoline-regular";
const DIESEL = "us-diesel";
const PETROL = "eu-petrol-euro95";
const EU_DIESEL = "eu-diesel";
const PERSONA_IDS: readonly string[] = [GASOLINE, DIESEL, PETROL, EU_DIESEL];

const GASOLINE_SERIES = "EMM_EPMR_PTE_NUS_DPG";
const GASOLINE_URL = `https://www.eia.gov/dnav/pet/hist_xls/${GASOLINE_SERIES}w.xls`;
const DIESEL_URL = `https://www.eia.gov/dnav/pet/hist_xls/EMD_EPD2D_PTE_NUS_DPGw.xls`;
const RESOLVED_FILE_URL =
  "https://energy.ec.europa.eu/document/download/906e60ca-8b6a-44e7-8589-652854d2fd3f_en?filename=Weekly_Oil_Bulletin_Prices_History_maticni_4web.xlsx";

const FIXED_NOW = new Date("2026-11-01T12:00:00Z");
const LATER_NOW = new Date("2026-11-02T14:02:11Z");
const LATER_STAMP = "2026-11-02T14:02:11Z";
const fixedNow = (): Date => FIXED_NOW;
const laterNow = (): Date => LATER_NOW;

const DAY_MS = 86_400_000;
const EPOCH_MONDAY = Date.UTC(2024, 0, 1); // 1 January 2024 was a Monday.

/** The `YYYY-MM-DD` period `offset` days after the epoch Monday. */
function dayPeriod(offset: number): string {
  return new Date(EPOCH_MONDAY + offset * DAY_MS).toISOString().slice(0, 10);
}

/** The Monday `week` weeks after the epoch Monday. */
function weekPeriod(week: number): string {
  return dayPeriod(week * 7);
}

/** `period` moved by `days` (negative goes back in time). */
function shiftDays(period: string, days: number): string {
  return new Date(Date.parse(period) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

// --- Global fetch guard -------------------------------------------------------

const realFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = (async () => {
    throw new Error("network access is not allowed in the prefetch tests");
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

// --- Stub fetcher -------------------------------------------------------------

/**
 * Serves the recorded bytes for each URL `runPrefetch` requests. `gasolineStatus`
 * forces the EIA gasoline download to fail. Any other URL throws, so a wrong
 * request fails the test.
 */
function recordedFetcher(gasolineStatus = 200): Fetcher {
  return async (url: string): Promise<FetchResult> => {
    if (url === GASOLINE_URL) {
      return { status: gasolineStatus, url, body: GASOLINE_BYTES };
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

// --- Helpers ------------------------------------------------------------------

/** A clearly fake official figure for the finder tests (only the fields the finders read matter). */
function figure(
  metricId: string,
  period: string,
  over: Partial<Record<ProvenanceField, string>> = {},
): FigureV1 {
  return {
    kind: "official",
    metric_id: metricId,
    value: "1.000",
    unit: "USD per gallon",
    region: "U.S. city average",
    period,
    source: "U.S. EIA",
    series_id: GASOLINE_SERIES,
    retrieved_at: "2026-11-01T12:00:00Z",
    source_url: "https://www.eia.gov/",
    ...over,
  } as FigureV1;
}

/** The figures held in a committed figure file's text. */
function figuresOf(text: string): FigureV1[] {
  return (JSON.parse(text) as { figures: FigureV1[] }).figures;
}

/** The latest of a list of `YYYY-MM-DD` periods. */
function latestOf(periods: readonly string[]): string {
  return periods.reduce((max, p) => (p > max ? p : max));
}

/** Runs a prefetch and returns either its outcome or the error it threw. */
async function settle(
  run: Promise<PrefetchOutcome>,
): Promise<{ outcome: PrefetchOutcome } | { error: unknown }> {
  try {
    return { outcome: await run };
  } catch (error: unknown) {
    return { error };
  }
}

/** Asserts `result` is a PrefetchError of `kind` and returns it. */
function expectPrefetchError(
  result: { outcome: PrefetchOutcome } | { error: unknown },
  kind: PrefetchError["kind"],
): PrefetchError {
  expect(result).toHaveProperty("error");
  const error = (result as { error: unknown }).error;
  expect(error).toBeInstanceOf(PrefetchError);
  expect((error as PrefetchError).kind).toBe(kind);
  return error as PrefetchError;
}

// --- Property 1 ----------------------------------------------------------------

// Feature: 18-persona-dates, Property 1: Weekly gaps are found exactly
// **Validates: Requirements 2.2**
describe("Property 1: Weekly gaps are found exactly", () => {
  it("reports exactly the neighbouring pairs not 7 days apart, and nothing for a gap-free run", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 60 }), { maxLength: 30 }),
        fc.array(fc.integer({ min: 0, max: 60 }), { maxLength: 6 }),
        (weeks, duplicates) => {
          // Duplicated periods are kept as extra entries next to their original.
          const kept = [
            ...weeks,
            ...duplicates.filter((w) => weeks.includes(w)),
          ].sort((a, b) => a - b);
          const figures = kept.map((w) => figure(GASOLINE, weekPeriod(w)));

          // Neighbours in the sorted list are 7 days apart exactly when their
          // week indexes differ by 1. A duplicate differs by 0 and is a gap.
          const expected: {
            metricId: string;
            before: string;
            after: string;
          }[] = [];
          for (let i = 1; i < kept.length; i++) {
            if (kept[i] - kept[i - 1] !== 1) {
              expected.push({
                metricId: GASOLINE,
                before: weekPeriod(kept[i - 1]),
                after: weekPeriod(kept[i]),
              });
            }
          }

          expect(findWeeklyGaps(figures, [GASOLINE])).toEqual(expected);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("reports nothing for a gap-free run of Mondays", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 60 }), (count) => {
        const figures = Array.from({ length: count }, (_, w) =>
          figure(GASOLINE, weekPeriod(w)),
        );
        expect(findWeeklyGaps(figures, [GASOLINE])).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });
});

// --- Property 2 ----------------------------------------------------------------

// Feature: 18-persona-dates, Property 2: Coverage is met exactly when a period falls in the window
// **Validates: Requirements 2.1, 2.3**
describe("Property 2: Coverage is met exactly when a period falls in the window", () => {
  it("reports a miss, with the latest period or null, iff no period lies in [from, to]", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 400 }), { maxLength: 20 }),
        fc.array(fc.integer({ min: 0, max: 400 }), { maxLength: 10 }),
        fc.integer({ min: 0, max: 400 }),
        fc.integer({ min: 0, max: 400 }),
        (days, otherDays, a, b) => {
          const from = dayPeriod(Math.min(a, b));
          const to = dayPeriod(Math.max(a, b));
          const periods = days.map(dayPeriod);
          // Figures of another series must not count towards this need.
          const others = otherDays.map((d) => figure(DIESEL, dayPeriod(d)));
          const figures = [
            ...periods.map((p) => figure(GASOLINE, p)),
            ...others,
          ];

          const need: CoverageNeed = { metricId: GASOLINE, from, to };
          const misses = findCoverageMisses(figures, [need]);

          const covered = periods.some((p) => p >= from && p <= to);
          if (covered) {
            expect(misses).toEqual([]);
          } else {
            expect(misses).toEqual([
              {
                metricId: GASOLINE,
                latest: periods.length === 0 ? null : latestOf(periods),
              },
            ]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Property 3 ----------------------------------------------------------------

// Feature: 18-persona-dates, Property 3: The Prefetch_Script writes nothing unless every check passes
// **Validates: Requirements 2.2, 2.3, 2.9, 2.10**
describe("Property 3: The Prefetch_Script writes nothing unless every check passes", () => {
  let baseline: PrefetchOutcome;

  beforeAll(async () => {
    // The committed excerpts with no coverage needs: every check passes.
    baseline = await runPrefetch(null, {
      fetcher: recordedFetcher(),
      now: fixedNow,
    });
  });

  /** One need per persona series. A covered need's window ends on its latest period. */
  function needsFor(covered: readonly boolean[]): CoverageNeed[] {
    const figures = figuresOf(baseline.text);
    return PERSONA_IDS.map((metricId, i) => {
      if (covered[i]) {
        const latest = latestOf(
          figures.filter((f) => f.metric_id === metricId).map((f) => f.period),
        );
        return { metricId, from: shiftDays(latest, -6), to: latest };
      }
      return { metricId, from: "2090-01-01", to: "2090-01-07" };
    });
  }

  it("returns text only when no finding is reported, otherwise throws the first failing kind with its findings", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        fc.array(fc.boolean(), { minLength: 4, maxLength: 4 }),
        async (failGasoline, covered) => {
          const needs = needsFor(covered);
          const result = await settle(
            runPrefetch(null, {
              fetcher: recordedFetcher(failGasoline ? 500 : 200),
              now: fixedNow,
              coverage: needs,
            }),
          );

          // The same figures the run merges, checked by the pure finders. Check
          // order (spec 18): a failed download, then weekly gaps, then coverage misses.
          const figures = figuresOf(baseline.text);
          const gaps = findWeeklyGaps(figures, PERSONA_IDS);
          const misses = findCoverageMisses(figures, needs);

          if (failGasoline) {
            expectPrefetchError(result, "series_failed");
          } else if (gaps.length > 0) {
            expect(expectPrefetchError(result, "weekly_gap").findings).toEqual(
              gaps,
            );
          } else if (misses.length > 0) {
            expect(
              expectPrefetchError(result, "opening_coverage").findings,
            ).toEqual(misses);
          } else {
            // Every check passes: the same text as the unchecked baseline run.
            expect(result).toHaveProperty("outcome");
            expect((result as { outcome: PrefetchOutcome }).outcome.text).toBe(
              baseline.text,
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  }, 120_000);
});

// --- Property 4 ----------------------------------------------------------------

// Feature: 18-persona-dates, Property 4: The refetch only appends
// **Validates: Requirements 2.4, 2.5, 2.6**
describe("Property 4: The refetch only appends", () => {
  let baseline: PrefetchOutcome;

  beforeAll(async () => {
    baseline = await runPrefetch(null, {
      fetcher: recordedFetcher(),
      now: fixedNow,
    });
  });

  it("keeps committed values and retrieved_at, adds missing periods from the fresh download, and does not apply a differing committed value", async () => {
    const baselineFigures = figuresOf(baseline.text);
    const baseFile = JSON.parse(baseline.text) as Record<string, unknown>;
    const keyOf = (f: FigureV1): string =>
      `${f.metric_id}|${f.period}|${f.kind}`;
    const baselineByKey = new Map(baselineFigures.map((f) => [keyOf(f), f]));

    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.nat({ max: 40 }), { minLength: 4, maxLength: 4 }),
        fc.nat(),
        async (drops, tamperAt) => {
          // Drop the latest periods of each series from the committed file, but keep at least one.
          const keptKeys = new Set<string>();
          PERSONA_IDS.forEach((metricId, i) => {
            const periods = baselineFigures
              .filter((f) => f.metric_id === metricId)
              .map((f) => f.period)
              .sort();
            const keep =
              periods.length - Math.min(drops[i], periods.length - 1);
            for (const p of periods.slice(0, keep)) {
              keptKeys.add(`${metricId}|${p}|official`);
            }
          });
          const committed = baselineFigures.filter((f) =>
            keptKeys.has(keyOf(f)),
          );

          // Tamper with one committed value. The fresh download must not replace it.
          const tamperIndex = tamperAt % committed.length;
          const tampered = committed[tamperIndex];
          const existingFigures = committed.map((f, i) =>
            i === tamperIndex ? { ...f, value: "999.999" } : f,
          );

          const out = await runPrefetch(
            { ...baseFile, figures: existingFigures },
            { fetcher: recordedFetcher(), now: laterNow },
          );
          const outFigures = figuresOf(out.text);
          // A row is identified by its period and its own retrieved_at, so a
          // row written by this run would be told apart from the committed row.
          const rowKey = (f: FigureV1): string =>
            `${keyOf(f)}|${f.retrieved_at}`;
          const outByRow = new Map(outFigures.map((f) => [rowKey(f), f]));

          // Every committed row is still there, with its value and retrieved_at.
          // The tampered value is kept, so the fresh download did not replace it.
          for (const f of existingFigures) {
            const got = outByRow.get(rowKey(f));
            expect(got).toBeDefined();
            expect(got?.value).toBe(f.value);
          }
          expect(existingFigures[tamperIndex].value).toBe("999.999");

          // Each dropped period is appended from the fresh download, with the
          // source's value and this run's retrieved_at.
          for (const f of baselineFigures) {
            if (keptKeys.has(keyOf(f))) continue;
            const got = outByRow.get(`${keyOf(f)}|${LATER_STAMP}`);
            expect(got?.value).toBe(baselineByKey.get(keyOf(f))?.value);
          }

          // The differing committed value is reported once as a revision and
          // adds no row: no figure carries this run's retrieved_at for it.
          expect(out.report.revisions).toHaveLength(1);
          expect(
            outByRow.get(`${keyOf(tampered)}|${LATER_STAMP}`),
          ).toBeUndefined();

          // Output rows: the baseline rows, with no Revision_Row added.
          expect(outFigures).toHaveLength(baselineFigures.length);
        },
      ),
      { numRuns: 100 },
    );
  }, 120_000);
});

// --- Property 5 ----------------------------------------------------------------

// Feature: 18-persona-dates, Property 5: Provenance mismatches are found
// **Validates: Requirements 2.10**
describe("Property 5: Provenance mismatches are found", () => {
  const FIELDS: readonly ProvenanceField[] = [
    "unit",
    "region",
    "source",
    "series_id",
  ];

  it("reports the series, period and field iff the added figure differs from its series", () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 4, maxLength: 4 }),
        fc.boolean(),
        (differs, withEarlier) => {
          const changed = (
            field: ProvenanceField,
          ): Partial<Record<ProvenanceField, string>> => ({
            [field]: `CHANGED ${field}`,
          });
          // The series reference is its latest figure. An earlier figure with
          // other provenance must not be the reference.
          const existing: FigureV1[] = [];
          if (withEarlier) {
            existing.push(
              figure(GASOLINE, "2026-10-12", { unit: "EARLIER UNIT" }),
            );
          }
          existing.push(figure(GASOLINE, "2026-10-19"));

          const overrides: Partial<Record<ProvenanceField, string>> = {};
          FIELDS.forEach((field, i) => {
            if (differs[i]) Object.assign(overrides, changed(field));
          });
          const added = figure(GASOLINE, "2026-10-26", overrides);

          const expected = FIELDS.filter((_, i) => differs[i]).map((field) => ({
            metricId: GASOLINE,
            period: "2026-10-26",
            field,
          }));
          expect(findProvenanceMismatches(existing, [added])).toEqual(expected);

          // A metric with no committed figures has nothing to differ from.
          expect(
            findProvenanceMismatches(existing, [
              figure(DIESEL, "2026-10-26", { unit: "CHANGED unit" }),
            ]),
          ).toEqual([]);
        },
      ),
      { numRuns: 100 },
    );
  });
});
