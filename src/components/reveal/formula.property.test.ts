// Feature: 14-write-desk, Property 12: The formula shows the inputs and the displayed result
//
// For any comparable then and now pair, with and without a display rescale,
// readableFormula(result, shown) is "({now} - {then}) / {then} x 100 = {percent}"
// when the percentage is defined, and "{now} - {then} = {difference}" otherwise.
// {now} and {then} are the full-precision values after the rescale, and
// {percent} and {difference} are exactly the strings ChangeLine displays.
//
// Validates R4.1, R5.4.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import type { FigureV1 } from "@/lib/seal-format";
import {
  computeChange,
  displayRescaleForUnit,
  formatChange,
  type DisplayRescale,
} from "@/lib/figures";

import { displayChangeResult, rescaledChangeInputs } from "./change-display";
import { differenceDigitsFor } from "./display-precision";
import { readableFormula } from "./formula";

const MICRO = 1_000_000n;

const UNITS = [
  { unit: "USD per gallon", region: "U.S. city average" },
  { unit: "EUR per 1,000 litres", region: "EU27, weighted average" },
  { unit: "index (2015 = 100)", region: "U.S. city average" },
] as const;

/** A decimal string with exactly `scale` fraction digits, from micro-units. */
function textOf(micro: bigint, scale: number): string {
  const q = micro / 10n ** BigInt(6 - scale);
  const whole = q / 10n ** BigInt(scale);
  if (scale === 0) return whole.toString();
  const frac = (q % 10n ** BigInt(scale)).toString().padStart(scale, "0");
  return `${whole}.${frac}`;
}

const pairArb = fc
  .record({
    base: fc.bigInt({ min: 0n, max: 500n * MICRO }),
    other: fc.bigInt({ min: 0n, max: 500n * MICRO }),
    useOther: fc.boolean(),
    scale: fc.constantFrom(0, 2, 3),
    unit: fc.constantFrom(...UNITS),
  })
  .map(({ base, other, useOther, scale, unit }) => {
    const now = useOther ? other : base;
    const figure = (value: string, period: string): FigureV1 =>
      ({
        kind: "official",
        metric_id: "formula-prop",
        value,
        unit: unit.unit,
        region: unit.region,
        period,
        source: "Test source",
        series_id: "TEST-SERIES",
        retrieved_at: "2026-10-30T14:02:11Z",
        source_url: "https://example.test/series",
      }) as FigureV1;
    return {
      then: figure(textOf(base, scale), "2024-09"),
      now: figure(textOf(now, scale), "2026-09"),
    };
  });

/**
 * The shown result and its display text, built the way FigureEntry builds them:
 * the display rescale applies to the inputs, then the difference is formatted.
 */
function shownFor(then: FigureV1, now: FigureV1) {
  const change = computeChange(then, now);
  if (!change.comparable) throw new Error("test setup: pair must be comparable");

  const display = displayRescaleForUnit(then.unit);
  const rescale: DisplayRescale | undefined =
    display === null
      ? undefined
      : {
          divisor: display.divisor as DisplayRescale["divisor"],
          unit: display.displayUnit,
        };
  const shownUnit = rescale === undefined ? then.unit : rescale.unit;
  const inputs =
    rescale === undefined
      ? undefined
      : rescaledChangeInputs(then.value, now.value, rescale, then.unit);
  const result =
    inputs === undefined ? change : displayChangeResult(change, inputs);
  const text = formatChange(result, then.region, {
    differenceDigits: differenceDigitsFor(
      shownUnit,
      result.then.value,
      result.now.value,
    ),
  });
  return { result, text };
}

describe("Property 12: the formula shows the inputs and the displayed result", () => {
  it("ends with the displayed percentage, or the displayed difference when there is none", () => {
    fc.assert(
      fc.property(pairArb, ({ then, now }) => {
        const { result, text } = shownFor(then, now);
        const formula = readableFormula(result, text);

        if (text.percent === null) {
          expect(formula).toBe(
            `${result.now.value} - ${result.then.value} = ${text.difference}`,
          );
        } else {
          expect(formula).toBe(
            `(${result.now.value} - ${result.then.value}) / ${result.then.value} x 100 = ${text.percent}`,
          );
        }
      }),
      { numRuns: 200 },
    );
  });

  it("uses the rescaled inputs and the displayed difference for a per-1,000-litre unit", () => {
    // Sealed per 1,000 litres: 1800.00 then, 1900.00 now. Shown per litre:
    // 1.8 then, 1.9 now, a difference of +0.10 at two digits.
    const then: FigureV1 = {
      kind: "official",
      metric_id: "eu",
      value: "1800.00",
      unit: "EUR per 1,000 litres",
      region: "EU27, weighted average",
      period: "2024-05",
      source: "European Commission",
      series_id: "EU-SERIES",
      retrieved_at: "2026-10-30T14:02:11Z",
      source_url: "https://example.test/series",
    } as FigureV1;
    const now: FigureV1 = { ...then, value: "1900.00", period: "2026-05" } as FigureV1;

    const { result, text } = shownFor(then, now);
    expect(readableFormula(result, text)).toBe(
      `(1.9 - 1.8) / 1.8 x 100 = ${text.percent}`,
    );
    expect(text.difference).toBe("+0.10");
  });
});
