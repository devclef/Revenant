// Property 8 (spec 04-real-figures, R9): the merged set keeps every figure and
// every lookup from both inputs. fast-check, 100 runs per property.
//
// Inputs are built from real-format catalogue weekly series (fixture: false)
// and FIXTURE-labelled series (fixture: true), so no invented real figures.
// A shared catalogue ID is generated with figures on at most one side, which is
// the only shared case the merge allows. No network, no database.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import type { FigureV1 } from "@/lib/seal-format";

import { CATALOGUE } from "./catalogue";
import { loadFigureFile } from "./load";
import { mergeLoadedFigures } from "./merge";
import type { CatalogueSeries, FigureFile, LoadedFigures } from "./types";

// --- Generators --------------------------------------------------------------

const DAY_MS = 86_400_000;
// 1970-01-05 is a Monday; any Monday is this plus a multiple of 7 days.
const FIRST_MONDAY_MS = Date.UTC(1970, 0, 5);

function mondayIso(weeksFromEpoch: number): string {
  return new Date(FIRST_MONDAY_MS + weeksFromEpoch * 7 * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

// Up to 12 distinct weeks, so no duplicate period within a series.
const weeksArb = fc.uniqueArray(fc.integer({ min: 520, max: 7800 }), {
  maxLength: 12,
});

type OfficialFigure = Extract<FigureV1, { kind: "official" }>;

function official(
  metric: CatalogueSeries["metric"],
  weeks: number,
  value: string,
): OfficialFigure {
  return {
    kind: "official",
    metric_id: metric.id,
    value,
    unit: metric.unit,
    region: metric.region,
    period: mondayIso(weeks),
    source: metric.source,
    series_id: metric.series_id,
    retrieved_at: "2026-10-30T14:02:11Z",
    source_url: "https://example.invalid/fixture",
  };
}

// FIXTURE-labelled series in the real source format (value strings, Mondays).
const FIXTURE_SERIES: CatalogueSeries = {
  metric: {
    id: "fixture-property-weekly",
    display_name: "Fixture property series (fixture)",
    unit: "FIXTURE unit",
    region: "FIXTURE region",
    source: "FIXTURE source weekly",
    series_id: "FIXTURE-PROPERTY-WEEKLY",
  },
  period_type: "weekly",
};

function fixtureFigure(weeks: number, value: string): OfficialFigure {
  return official(FIXTURE_SERIES.metric, weeks, value);
}

const valueArb = fc
  .tuple(fc.integer({ min: 0, max: 9999 }), fc.integer({ min: 0, max: 999 }))
  .map(([whole, frac]) => `${whole}.${String(frac).padStart(3, "0")}`);

// A real set: the catalogue metric at index `catIndex` gets `weeks` figures
// (or none). Every catalogue series is present in the loaded result.
function realSet(catIndex: number, weeks: number[], values: string[]): LoadedFigures {
  const metric = CATALOGUE[catIndex].metric;
  const figures = weeks.map((w, i) => official(metric, w, values[i % values.length]));
  const file: FigureFile = { fixture: false, series: [], figures };
  return loadFigureFile(file, CATALOGUE);
}

// A fixture set: its own FIXTURE series with `weeks` figures.
function fixtureSet(weeks: number[], values: string[]): LoadedFigures {
  const figures = weeks.map((w, i) => fixtureFigure(w, values[i % values.length]));
  const file: FigureFile = {
    fixture: true,
    note: "FIXTURE data for the merge property test, not real figures",
    series: [FIXTURE_SERIES],
    figures,
  };
  return loadFigureFile(file, CATALOGUE);
}

// Total figures held across a LoadedFigures.
function totalFigures(set: LoadedFigures): number {
  let n = 0;
  for (const series of set.series.values()) n += series.figures.length;
  return n;
}

// --- Property 8 --------------------------------------------------------------

describe("Property 8: merged set keeps every figure and lookup from both inputs", () => {
  it("keeps every lookup ID from both inputs, with the same series objects", () => {
    fc.assert(
      fc.property(
        weeksArb,
        weeksArb,
        fc.array(valueArb, { minLength: 1, maxLength: 4 }),
        fc.constantFrom(-1, 0, 1, 2), // -1: no shared ID, else shared catalogue index
        (weeksA, weeksB, values, shared) => {
          // Side a: catalogue series 0 with figures, and the fixture set in b.
          const a = realSet(0, weeksA, values);
          const b = fixtureSet(weeksB, values);
          // Shared ID: catalogue series `shared` appears in b with no figures
          // on the side that already has figures in a.
          const withShared =
            shared >= 0 ? mergeLoadedFigures(a, realSet(shared, [], values)) : a;

          const merged = mergeLoadedFigures(withShared, b);

          for (const [id, series] of withShared.series) {
            expect(merged.series.get(id)).toBe(
              // a's series is kept whenever a holds figures or neither does.
              series,
            );
          }
          for (const [id, series] of b.series) {
            expect(merged.series.has(id)).toBe(true);
            if (!withShared.series.has(id)) {
              expect(merged.series.get(id)).toBe(series);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("keeps every figure from both inputs, and no figure is added or dropped", () => {
    fc.assert(
      fc.property(
        weeksArb,
        weeksArb,
        fc.array(valueArb, { minLength: 1, maxLength: 4 }),
        (weeksA, weeksB, values) => {
          const a = realSet(0, weeksA, values);
          const b = fixtureSet(weeksB, values);

          const merged = mergeLoadedFigures(a, b);

          expect(totalFigures(merged)).toBe(totalFigures(a) + totalFigures(b));
          for (const set of [a, b]) {
            for (const [id, series] of set.series) {
              const mergedSeries = merged.series.get(id);
              // Shared IDs take the side with figures, so check containment
              // rather than equality with this side's (possibly empty) list.
              for (const fig of series.figures) {
                expect(mergedSeries?.figures).toContain(fig);
              }
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("keeps a shared ID's figures from whichever side holds them", () => {
    fc.assert(
      fc.property(
        weeksArb,
        fc.boolean(),
        fc.array(valueArb, { minLength: 1, maxLength: 4 }),
        (weeks, figuresOnA, values) => {
          const withFigures = realSet(0, weeks, values);
          const empty = realSet(0, [], values);
          const a = figuresOnA ? withFigures : empty;
          const b = figuresOnA ? empty : withFigures;

          const merged = mergeLoadedFigures(a, b);
          const got = merged.series.get(CATALOGUE[0].metric.id);

          expect(got?.figures.length).toBe(weeks.length);
          expect(got?.figures).toEqual(withFigures.series.get(CATALOGUE[0].metric.id)?.figures);
        },
      ),
      { numRuns: 100 },
    );
  });
});
