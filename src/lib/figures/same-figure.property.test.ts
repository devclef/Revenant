// Property tests for isSameFigure (spec 03-persona-demo, issue #383).
//
// Same_Figure must be exact, symmetric and reflexive. These use fast-check
// (already a project dependency) over a wide space of decimal values and
// periods, so the checks do not rest on a handful of worked examples.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import type { FigureV1 } from "@/lib/seal-format";

import { isSameFigure } from "./same-figure";

// A fixed official figure used by the single-case checks.
function baseOfficial(): FigureV1 {
  return {
    kind: "official",
    metric_id: "us-gasoline",
    value: "3.40",
    unit: "USD per gallon",
    region: "U.S. city average",
    period: "2024-09",
    source: "U.S. EIA",
    series_id: "EMM_EPMR_PTE_NUS_DPG",
    retrieved_at: "2026-10-30T14:02:11Z",
    source_url: "https://www.eia.gov/series",
  } as FigureV1;
}

// A decimal string that parseDecimal accepts: ^-?[0-9]+(\.[0-9]+)?$, kept
// well under the 40-char cap. Fraction digits may be absent, so "3" and
// "3.0" both occur.
const digit = fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9");
const valueArb: fc.Arbitrary<string> = fc
  .record({
    negative: fc.boolean(),
    intDigits: fc.string({ unit: digit, minLength: 1, maxLength: 20 }),
    fracDigits: fc.string({ unit: digit, minLength: 0, maxLength: 12 }),
  })
  .map(({ negative, intDigits, fracDigits }) => {
    const body =
      fracDigits.length === 0 ? intDigits : `${intDigits}.${fracDigits}`;
    return negative ? `-${body}` : body;
  });

// A YYYY-MM period in the range the figures model accepts.
const periodArb: fc.Arbitrary<string> = fc
  .record({
    year: fc.integer({ min: 2000, max: 2030 }),
    month: fc.integer({ min: 1, max: 12 }),
  })
  .map(({ year, month }) => `${year}-${String(month).padStart(2, "0")}`);

// An official figure. Source, series, unit and region are fixed so that only
// value and period vary between generated figures.
const figureArb: fc.Arbitrary<FigureV1> = fc
  .record({ value: valueArb, period: periodArb })
  .map(
    ({ value, period }) =>
      ({
        kind: "official",
        metric_id: "us-gasoline",
        value,
        unit: "USD per gallon",
        region: "U.S. city average",
        period,
        source: "U.S. EIA",
        series_id: "EMM_EPMR_PTE_NUS_DPG",
        retrieved_at: "2026-10-30T14:02:11Z",
        source_url: "https://www.eia.gov/series",
      }) as FigureV1,
  );

describe("isSameFigure properties", () => {
  it("is reflexive: a figure is the same figure as itself", () => {
    fc.assert(
      fc.property(figureArb, (figure) => {
        expect(isSameFigure(figure, figure)).toBe(true);
      }),
    );
  });

  it("is symmetric: isSameFigure(a, b) equals isSameFigure(b, a)", () => {
    fc.assert(
      fc.property(figureArb, figureArb, (a, b) => {
        expect(isSameFigure(a, b)).toBe(isSameFigure(b, a));
      }),
    );
  });

  it("treats 3.40 and 3.4 as equal in both orders", () => {
    const a = { ...baseOfficial(), value: "3.40" };
    const b = { ...baseOfficial(), value: "3.4" };
    expect(isSameFigure(a, b)).toBe(true);
    expect(isSameFigure(b, a)).toBe(true);
  });
});
