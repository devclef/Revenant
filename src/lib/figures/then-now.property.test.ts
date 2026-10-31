// Property tests for the then-and-now lookup (spec 02-demo-figures, Task 2).
//
// Properties 5-9 from design.md, each one fast-check test with { numRuns: 100 }.
// Generators build FIXTURE-sourced figure files (so they are valid fixture
// data), with rounded values and weekly Monday periods, then run them through
// loadFigureFile exactly as the demo loader does. No network, no database.
//
// Properties 1-2 (seal round trip) live in seal-roundtrip.property.test.ts.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import type { FigureV1, MetricDefinitionV1 } from "@/lib/seal-format";

import { thenAndNow } from "./then-now";
import { loadFigureFile } from "./load";
import { periodEnd } from "./periods";
import type { CatalogueSeries, FigureFile, LoadedFigures } from "./types";

// --- Generators --------------------------------------------------------------
//
// Every generated series and figure is FIXTURE-prefixed on source and series_id,
// so loadFigureFile accepts the file with fixture: true (R4/R7.6). Values are
// rounded (two-decimal strings) and periods are real Mondays in a bounded range,
// so loader rule 7 (period format / real date) always passes.

const FIXTURE_SOURCE = "FIXTURE weekly retail price (fake data)";

// A whole number of days (as ms) since the Unix epoch, for a Monday generator.
const DAY_MS = 86_400_000;
// 1970-01-05 is a Monday. Any Monday is this plus a multiple of 7 days.
const FIRST_MONDAY_MS = Date.UTC(1970, 0, 5);

function mondayIso(weeksFromEpoch: number): string {
  const ms = FIRST_MONDAY_MS + weeksFromEpoch * 7 * DAY_MS;
  return new Date(ms).toISOString().slice(0, 10);
}

// A real Monday "YYYY-MM-DD" within roughly 1980-2120 (weeks 520..7800).
const mondayArb: fc.Arbitrary<string> = fc
  .integer({ min: 520, max: 7800 })
  .map(mondayIso);

// A rounded, schema-valid value string like "3.41": 0-9999 dollars, 2 decimals.
const valueArb: fc.Arbitrary<string> = fc
  .tuple(fc.integer({ min: 0, max: 9999 }), fc.integer({ min: 0, max: 99 }))
  .map(([whole, cents]) => `${whole}.${cents < 10 ? "0" : ""}${cents}`);

// A single fixture metric id, e.g. "fixture-series-0".
function fixtureMetricId(n: number): string {
  return `fixture-series-${n}`;
}

function fixtureMetric(n: number): MetricDefinitionV1 {
  return {
    id: fixtureMetricId(n),
    display_name: `Fixture series ${n} (fixture)`,
    unit: "USD per gallon",
    region: "U.S.",
    source: FIXTURE_SOURCE,
    series_id: `FIXTURE-SERIES-${n}`,
  };
}

function fixtureFigure(
  metricId: string,
  seriesId: string,
  period: string,
  value: string,
): FigureV1 {
  return {
    kind: "official",
    metric_id: metricId,
    value,
    unit: "USD per gallon",
    region: "U.S.",
    period,
    source: FIXTURE_SOURCE,
    series_id: seriesId,
    retrieved_at: "2000-01-01T00:00:00Z",
    source_url: "https://example.invalid/fixture",
  };
}

// One series worth of figures: unique Monday periods, rounded values. Returns
// the catalogue-style series entry plus its figures (in no particular order).
interface GeneratedSeries {
  series: CatalogueSeries;
  figures: FigureV1[];
}

// Arbitrary for a single series with 0..8 figures on unique Monday periods.
function seriesArb(n: number): fc.Arbitrary<GeneratedSeries> {
  const metric = fixtureMetric(n);
  return fc
    .uniqueArray(mondayArb, { minLength: 0, maxLength: 8 })
    .chain((periods) =>
      fc
        .array(valueArb, { minLength: periods.length, maxLength: periods.length })
        .map((values) => {
          const figures = periods.map((period, i) =>
            fixtureFigure(metric.id, metric.series_id, period, values[i]),
          );
          return {
            series: { metric, period_type: "weekly" as const },
            figures,
          };
        }),
    );
}

// Arbitrary for a whole figure file: 1..4 fixture series, each with its own
// figures. metric_ids are unique by construction (fixture-series-0..k).
const fileArb: fc.Arbitrary<FigureFile> = fc
  .integer({ min: 1, max: 4 })
  .chain((count) =>
    fc
      .tuple(...Array.from({ length: count }, (_, i) => seriesArb(i)))
      .map((generated) => {
        const series = generated.map((g) => g.series);
        const figures = generated.flatMap((g) => g.figures);
        return {
          fixture: true,
          note: "generated fixture file for property tests",
          series,
          figures,
        } satisfies FigureFile;
      }),
  );

// The property files load against an empty catalogue, so the only series are the
// generated fixture ones. loadFigureFile accepts an empty catalogue.
const EMPTY_CATALOGUE: readonly CatalogueSeries[] = [];

function load(file: FigureFile): LoadedFigures {
  return loadFigureFile(file, EMPTY_CATALOGUE);
}

// All metric ids present in a loaded file.
function metricIds(data: LoadedFigures): string[] {
  return [...data.series.keys()];
}

// --- Properties --------------------------------------------------------------

describe("thenAndNow properties", () => {
  // Feature: 02-demo-figures, Property 5: "Then" is the latest figure at or before the date
  it("Property 5: then is the latest figure with period end <= date, else none_at_or_before_date", () => {
    fc.assert(
      fc.property(fileArb, mondayArb, (file, date) => {
        const data = load(file);
        for (const metricId of metricIds(data)) {
          const series = data.series.get(metricId)!;
          // Empty series yield no_figures for both results; that gap case is
          // Property 9. Property 5 is about the then-selection within a series
          // that has figures.
          if (series.figures.length === 0) continue;
          const { then } = thenAndNow(metricId, date, data);

          const ends = series.figures.map((f) => periodEnd(f.period, "weekly"));
          const atOrBefore = ends.filter((e) => e <= date);

          if (atOrBefore.length === 0) {
            expect(then.found).toBe(false);
            if (!then.found) {
              expect(then.reason).toBe("none_at_or_before_date");
            }
          } else {
            expect(then.found).toBe(true);
            if (then.found) {
              const thenEnd = periodEnd(then.figure.period, "weekly");
              // then's end is at or before the date,
              expect(thenEnd <= date).toBe(true);
              // and no figure lies in (thenEnd, date].
              for (const e of ends) {
                expect(e > thenEnd && e <= date).toBe(false);
              }
            }
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: 02-demo-figures, Property 6: "Now" is the latest figure overall
  it("Property 6: now is always found and is the series maximum period end, whatever the date", () => {
    fc.assert(
      fc.property(fileArb, mondayArb, (file, date) => {
        const data = load(file);
        for (const metricId of metricIds(data)) {
          const series = data.series.get(metricId)!;
          const { now } = thenAndNow(metricId, date, data);

          if (series.figures.length === 0) {
            // No figures: now is no_figures, handled by Property 9.
            expect(now.found).toBe(false);
            continue;
          }

          expect(now.found).toBe(true);
          if (now.found) {
            const nowEnd = periodEnd(now.figure.period, "weekly");
            const maxEnd = series.figures
              .map((f) => periodEnd(f.period, "weekly"))
              .reduce((a, b) => (a >= b ? a : b));
            expect(nowEnd).toBe(maxEnd);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: 02-demo-figures, Property 7: Returned figures are the loaded objects
  it("Property 7: every returned figure is === a loaded element, with the right metric and value", () => {
    fc.assert(
      fc.property(fileArb, mondayArb, (file, date) => {
        const data = load(file);
        for (const metricId of metricIds(data)) {
          const series = data.series.get(metricId)!;
          const { then, now } = thenAndNow(metricId, date, data);

          for (const r of [then, now]) {
            if (r.found) {
              // Reference-equal to an element actually held in the series.
              expect(series.figures.includes(r.figure)).toBe(true);
              // Belongs to this metric id.
              expect(r.figure.metric_id).toBe(metricId);
              // Its value string equals the string in the input JSON for that
              // exact figure (same reference, so trivially the loaded string).
              const match = series.figures.find((f) => f === r.figure)!;
              expect(r.figure.value).toBe(match.value);
            }
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: 02-demo-figures, Property 8: File order never changes a result
  it("Property 8: shuffling the figures array never changes then/now period or value", () => {
    // Generate a file together with a full-length shuffle of its figures, so a
    // single property compares the two loads. shuffledSubarray with min/max
    // equal to the length yields a permutation of the same elements.
    const fileAndShuffleArb = fileArb.chain((file) =>
      fc
        .shuffledSubarray(file.figures, {
          minLength: file.figures.length,
          maxLength: file.figures.length,
        })
        .map((shuffled) => ({ file, shuffled })),
    );

    fc.assert(
      fc.property(fileAndShuffleArb, mondayArb, ({ file, shuffled }, date) => {
        const data = load(file);
        const shuffledData = load({ ...file, figures: shuffled });

        for (const metricId of metricIds(data)) {
          const a = thenAndNow(metricId, date, data);
          const b = thenAndNow(metricId, date, shuffledData);

          for (const key of ["then", "now"] as const) {
            const ra = a[key];
            const rb = b[key];
            expect(rb.found).toBe(ra.found);
            if (ra.found && rb.found) {
              expect(rb.figure.period).toBe(ra.figure.period);
              expect(rb.figure.value).toBe(ra.figure.value);
            }
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: 02-demo-figures, Property 9: Gaps are reported, not filled
  it("Property 9: unknown => unknown_series, empty => no_figures, early date => then none/now found", () => {
    fc.assert(
      fc.property(fileArb, (file) => {
        const data = load(file);

        // (a) Unknown metric id: both unknown_series, no figure returned.
        const unknown = thenAndNow("fixture-series-does-not-exist", "2024-11-04", data);
        expect(unknown.then.found).toBe(false);
        expect(unknown.now.found).toBe(false);
        if (!unknown.then.found) expect(unknown.then.reason).toBe("unknown_series");
        if (!unknown.now.found) expect(unknown.now.reason).toBe("unknown_series");

        for (const metricId of metricIds(data)) {
          const series = data.series.get(metricId)!;

          if (series.figures.length === 0) {
            // (b) Empty series: both no_figures.
            const r = thenAndNow(metricId, "2024-11-04", data);
            expect(r.then.found).toBe(false);
            expect(r.now.found).toBe(false);
            if (!r.then.found) expect(r.then.reason).toBe("no_figures");
            if (!r.now.found) expect(r.now.reason).toBe("no_figures");
            continue;
          }

          // (c) A date strictly before every period end: then is
          //     none_at_or_before_date, now is still found.
          const ends = series.figures.map((f) => periodEnd(f.period, "weekly"));
          const minEnd = ends.reduce((a, b) => (a <= b ? a : b));
          // One day before the earliest period end is still a real date and is
          // before every end.
          const beforeMs = Date.parse(`${minEnd}T00:00:00Z`) - DAY_MS;
          const before = new Date(beforeMs).toISOString().slice(0, 10);

          const r = thenAndNow(metricId, before, data);
          expect(r.then.found).toBe(false);
          if (!r.then.found) expect(r.then.reason).toBe("none_at_or_before_date");
          expect(r.now.found).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
