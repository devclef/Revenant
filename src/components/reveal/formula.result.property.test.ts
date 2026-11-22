// Feature: 16-remember-first, Property 4: The formula's result matches the change
//
// For any comparable pair, the formula ends with the displayed percent when the
// then value is not zero, and with the displayed difference when it is. The
// displayed percent is the full-precision percent rounded half away from zero to
// one decimal, with the sign of the percent.
//
// Validates requirements 8.3, 8.5.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  computeChange,
  formatChange,
  parseDecimal,
  roundDecimal,
  type Decimal,
} from "@/lib/figures";
import type { FigureV1 } from "@/lib/seal-format";

import { readableFormula } from "./formula";

const REGION = "U.S. city average";
const UNIT = "USD per gallon";

// Integers in thousandths: 0.000 to 99.999, so every percent is under 10,000%.
const unitsArb = fc.integer({ min: 0, max: 99_999 });

function textOf(n: number): string {
  const whole = Math.floor(n / 1000);
  const frac = String(n % 1000).padStart(3, "0");
  return `${whole}.${frac}`;
}

function figure(value: string, period: string): FigureV1 {
  return {
    kind: "official",
    metric_id: "us-gasoline-regular",
    value,
    unit: UNIT,
    region: REGION,
    period,
    source: "U.S. EIA",
    series_id: "EMM_EPMR_PTE_NUS_DPG",
    retrieved_at: "2026-10-30T14:02:11Z",
    source_url: "https://example.test/series",
  } as FigureV1;
}

/** The percent at one decimal, from the full-precision ratio, as the reader reads it. */
function expectedPercent(percentValue: string): string {
  const negative = percentValue.charCodeAt(0) === 0x2d;
  const magnitude = negative ? percentValue.slice(1) : percentValue;
  const rounded: Decimal = roundDecimal(parseDecimal(magnitude), 1);
  // Scale 1 after rounding: write the tenths as "whole.tenth".
  const tenths =
    rounded.scale === 1
      ? rounded.int
      : rounded.int * 10n ** BigInt(1 - rounded.scale);
  const sign = percentValue === "0" ? "" : negative ? "\u2212" : "+";
  return `${sign}${tenths / 10n}.${tenths % 10n}%`;
}

describe("Property 4: the formula's result matches the change", () => {
  it("ends with the displayed percent, or the displayed difference for a zero then value", () => {
    fc.assert(
      fc.property(unitsArb, unitsArb, (a, b) => {
        const then = figure(textOf(a), "2024-09");
        const now = figure(textOf(b), "2026-09");
        const result = computeChange(then, now);
        if (!result.comparable) throw new Error("test setup: must be comparable");
        const shown = formatChange(result, REGION);

        const formula = readableFormula(result, shown);
        if (a === 0) {
          expect(shown.percent).toBeNull();
          expect(formula.endsWith(` = ${shown.difference}`)).toBe(true);
          return;
        }
        expect(formula.endsWith(` = ${shown.percent}`)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("shows the percent of the full-precision ratio rounded to one decimal", () => {
    fc.assert(
      fc.property(unitsArb, unitsArb, (a, b) => {
        fc.pre(a > 0);
        const then = figure(textOf(a), "2024-09");
        const now = figure(textOf(b), "2026-09");
        const result = computeChange(then, now);
        if (!result.comparable || result.percent === null) {
          throw new Error("test setup: pair must have a percent");
        }
        const shown = formatChange(result, REGION);
        expect(shown.percent).not.toBeNull();
        expect(shown.percent?.replace(/,/g, "")).toBe(
          expectedPercent(result.percent.value),
        );
      }),
      { numRuns: 200 },
    );
  });
});
