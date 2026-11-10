// Property tests for invalid-row skipping in the database-mode figures shape
// (spec X1, issue #335, Property 3).
//
// For any mix of valid and invalid stored rows, shapeDbFiguresResponse must not
// throw, must skip every invalid row, must log each skipped metric once as
// `figures_row_skipped metric_id=<id>` with no value, and each series must get
// chooseFigure(stored, bundled): stored first, then bundled, then null.
//
// Every figure in this file is a fake test value, not a published number. No
// test touches a database or the network.

import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { bundledLatestFigure } from "@/lib/figures/bundled-latest";
import { CATALOGUE } from "@/lib/figures/catalogue";
import { chooseFigure } from "@/lib/figures/choose";
import type { CatalogueSeries } from "@/lib/figures/types";
import type { FigureV1 } from "@/lib/seal-format";

import {
  shapeDbFiguresResponse,
  toUtcSeconds,
  type DbFigureReads,
  type StoredFigureRow,
} from "./db-response";

const FAKE_SOURCE_URL = "https://test.invalid/fake-figure";
const GENERATED_AT = "2026-11-05T15:00:00Z";
const BASE_TIME = Date.UTC(2026, 7, 3);

type InvalidKind = "invalid-time" | "null-time" | "bad-value";

/** A valid stored row for one Catalogue series, using the series' own four fields. */
function validRow(seriesIdx: number, periodMonth: number, minute: number, value: string): StoredFigureRow {
  const m = CATALOGUE[seriesIdx].metric;
  return {
    metric_id: m.id,
    kind: "official",
    value,
    unit: m.unit,
    region: m.region,
    period: `2026-${String(periodMonth).padStart(2, "0")}`,
    source: m.source,
    series_id: m.series_id,
    source_url: FAKE_SOURCE_URL,
    retrieved_at: new Date(BASE_TIME + minute * 60_000),
  };
}

/** An invalid stored row for one Catalogue series. Only the named field is wrong. */
function invalidRow(seriesIdx: number, kind: InvalidKind): StoredFigureRow {
  const base = validRow(seriesIdx, 1, 0, "1.0000");
  switch (kind) {
    case "invalid-time":
      return { ...base, retrieved_at: new Date("not-a-date") };
    case "null-time":
      return { ...base, retrieved_at: null as unknown as Date };
    case "bad-value":
      return { ...base, value: "not-a-number" };
  }
}

interface ValidSpec {
  readonly kind: "valid";
  readonly seriesIdx: number;
  readonly periodMonth: number;
  readonly minute: number;
  readonly value: string;
}

interface InvalidSpec {
  readonly kind: "invalid";
  readonly seriesIdx: number;
  readonly invalidKind: InvalidKind;
}

const valueArb = fc
  .tuple(fc.nat({ max: 99999 }), fc.nat({ max: 9999 }))
  .map(([whole, frac]) => `${whole}.${String(frac).padStart(4, "0")}`);

const rowSpecArb: fc.Arbitrary<ValidSpec | InvalidSpec> = fc.oneof(
  fc.record({
    kind: fc.constant("valid" as const),
    seriesIdx: fc.nat({ max: CATALOGUE.length - 1 }),
    periodMonth: fc.integer({ min: 1, max: 12 }),
    minute: fc.nat({ max: 600 }),
    value: valueArb,
  }),
  fc.record({
    kind: fc.constant("invalid" as const),
    seriesIdx: fc.nat({ max: CATALOGUE.length - 1 }),
    invalidKind: fc.constantFrom<InvalidKind>("invalid-time", "null-time", "bad-value"),
  }),
);

/** The stored-row rules the database answer follows: a row is owned by a series when its four series fields match. */
function owns(cat: CatalogueSeries, row: StoredFigureRow): boolean {
  const m = cat.metric;
  return (
    row.source === m.source &&
    row.series_id === m.series_id &&
    row.unit === m.unit &&
    row.region === m.region
  );
}

/** Independent oracle: the latest valid row for one series. Greatest period, then newest retrieved_at, then later index. */
function latestValid(cat: CatalogueSeries, validRows: readonly StoredFigureRow[]): FigureV1 | null {
  let best: StoredFigureRow | null = null;
  for (const row of validRows) {
    if (!owns(cat, row)) continue;
    if (best === null || isNewer(row, best)) best = row;
  }
  if (best === null) return null;
  return {
    kind: "official",
    metric_id: best.metric_id,
    value: best.value,
    unit: best.unit,
    region: best.region,
    period: best.period,
    source: best.source,
    series_id: best.series_id,
    retrieved_at: toUtcSeconds(best.retrieved_at),
    source_url: best.source_url,
  };
}

/** True when row `a` beats row `b`: greater period, then newer retrieved_at. Equal keys keep the earlier row. */
function isNewer(a: StoredFigureRow, b: StoredFigureRow): boolean {
  if (a.period !== b.period) return a.period > b.period;
  return a.retrieved_at.getTime() > b.retrieved_at.getTime();
}

/** Builds the rows and the reads a mixed spec array stands for. */
function buildReads(specs: readonly (ValidSpec | InvalidSpec)[]): {
  reads: DbFigureReads;
  validRows: StoredFigureRow[];
  invalidMetricIds: string[];
} {
  const rows: StoredFigureRow[] = [];
  const validRows: StoredFigureRow[] = [];
  const invalidMetricIds: string[] = [];
  for (const spec of specs) {
    if (spec.kind === "valid") {
      const row = validRow(spec.seriesIdx, spec.periodMonth, spec.minute, spec.value);
      rows.push(row);
      validRows.push(row);
    } else {
      rows.push(invalidRow(spec.seriesIdx, spec.invalidKind));
      invalidMetricIds.push(CATALOGUE[spec.seriesIdx].metric.id);
    }
  }
  return { reads: { rows, successTimes: new Map() }, validRows, invalidMetricIds };
}

/** The log lines the shape step should write: one per distinct invalid metric, in first-occurrence order. */
function expectedSkipLines(invalidMetricIds: readonly string[]): string[] {
  return [...new Set(invalidMetricIds)].map((id) => `figures_row_skipped metric_id=${id}`);
}

const figureArb: fc.Arbitrary<FigureV1> = fc.record({
  kind: fc.constant("official" as const),
  metric_id: fc.string({ minLength: 1, maxLength: 20 }),
  value: valueArb,
  unit: fc.string({ minLength: 1, maxLength: 20 }),
  region: fc.string({ minLength: 1, maxLength: 20 }),
  period: fc.constant("2026-01"),
  source: fc.string({ minLength: 1, maxLength: 20 }),
  series_id: fc.string({ minLength: 1, maxLength: 20 }),
  retrieved_at: fc.constant("2026-01-02T03:04:05Z"),
  source_url: fc.constant(FAKE_SOURCE_URL),
}) as fc.Arbitrary<FigureV1>;

describe("Property 3: invalid stored rows are skipped and logged once per metric", () => {
  let errorSpy: MockInstance<(...data: unknown[]) => void>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("never throws, skips every invalid row, and logs each skipped metric once with no value", () => {
    fc.assert(
      fc.property(fc.array(rowSpecArb, { maxLength: 60 }), (specs) => {
        errorSpy.mockClear();
        const { reads, validRows, invalidMetricIds } = buildReads(specs);

        const body = shapeDbFiguresResponse(reads, CATALOGUE, GENERATED_AT);

        // Each series gets the latest valid row, or the bundled figure, or null.
        // Invalid rows never reach a series, so they can never be its answer.
        CATALOGUE.forEach((cat, i) => {
          const entry = body.series[i];
          expect(entry.metric.id).toBe(cat.metric.id);
          const stored = latestValid(cat, validRows);
          const bundled = bundledLatestFigure(cat);
          // Written out here, not via chooseFigure, so this check does not reuse the code under test.
          const expectedFigure = stored ?? bundled;
          const expectedFallback = stored === null && bundled !== null;
          expect(entry.figure).toEqual(expectedFigure);
          expect(entry.fallback).toBe(expectedFallback);
        });

        // One log line per distinct metric with an invalid row, and no value in it.
        const lines = errorSpy.mock.calls.map((args: unknown[]) => String(args[0]));
        expect(lines).toEqual(expectedSkipLines(invalidMetricIds));
        for (const line of lines) {
          expect(line).toMatch(/^figures_row_skipped metric_id=\S+$/);
          expect(line).not.toMatch(/not-a-number|not-a-date|\d+\.\d{4}/);
        }
      }),
    );
  });

  it("chooseFigure returns the stored figure first, then the bundled one, then null", () => {
    fc.assert(
      fc.property(
        fc.option(figureArb, { nil: null }),
        fc.option(figureArb, { nil: null }),
        (stored, bundled) => {
          const chosen = chooseFigure(stored, bundled);
          if (stored !== null) {
            expect(chosen).toEqual({ figure: stored, fallback: false });
          } else if (bundled !== null) {
            expect(chosen).toEqual({ figure: bundled, fallback: true });
          } else {
            expect(chosen).toEqual({ figure: null, fallback: false });
          }
        },
      ),
    );
  });
});
