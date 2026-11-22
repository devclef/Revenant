// Feature: 14-write-desk, Property 11: The displayed change has the shown precision and the exact sign
//
// For any two canonical decimal strings then and now, in a unit of the catalogue
// or a unit with no Display_Precision, the difference text has as many fraction
// digits as the then and now values printed by displayFigureValue. Its sign is
// "+" when the exact difference is positive, "−" (U+2212) when negative, and
// absent when the exact difference is 0, whatever the rounded digits show. The
// direction word follows the same rule. The percentage, when then is not 0, has
// one fraction digit with the same sign rule, and is absent when then is 0.
//
// Validates R5.1, R5.2, R5.3, Q2.7.
//
// The pipeline under test is the one FigureEntry runs: computeChange, the
// display rescale for the unit, differenceDigitsFor and formatChange. The expected
// values come from exact BigInt arithmetic on the sealed strings, not from the
// figures code under test.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { displayFigureValue } from "./display-figure";
import { differenceDigitsFor } from "./display-precision";
import { displayChangeResult, rescaledChangeInputs } from "./change-display";
import {
  computeChange,
  displayRescaleForUnit,
  formatChange,
  type DisplayRescale,
} from "@/lib/figures";
import type { FigureV1 } from "@/lib/seal-format";

const MICRO = 1_000_000n;
const MAX_MICRO = 1_000_000n * MICRO;

/** One sealed unit per case, with the region that publishes it. */
const UNITS = [
  { unit: "USD per gallon", region: "U.S. city average" },
  { unit: "EUR per 1,000 litres", region: "EU27, weighted average" },
  { unit: "index (2015 = 100)", region: "U.S. city average" },
] as const;

/** A decimal string with exactly `scale` fraction digits, truncated from micro-units. */
function textOf(micro: bigint, scale: number): string {
  const q = micro / 10n ** BigInt(6 - scale);
  const whole = q / 10n ** BigInt(scale);
  if (scale === 0) return whole.toString();
  const frac = (q % 10n ** BigInt(scale)).toString().padStart(scale, "0");
  return `${whole}.${frac}`;
}

/** The exact value of a decimal string in micro-units (up to 6 fraction digits). */
function micro(text: string): bigint {
  const [whole, frac = ""] = text.split(".");
  return BigInt(whole) * MICRO + BigInt((frac + "000000").slice(0, 6));
}

/** Exact sign of a decimal string difference: 1, -1 or 0. */
function signOf(diff: bigint): -1 | 0 | 1 {
  if (diff > 0n) return 1;
  if (diff < 0n) return -1;
  return 0;
}

/** Fraction digits of a printed number, e.g. "3.412" -> 3, "1,234" -> 0. */
function fractionDigitsOfText(text: string): number {
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

const microArb = fc.bigInt({ min: 0n, max: MAX_MICRO });
const scaleArb = fc.integer({ min: 0, max: 6 });

/**
 * A then and a now value. Some pairs are independent, some are equal, and some
 * differ by less than a cent, so the difference rounds to zero at two digits.
 */
const pairArb = fc
  .record({
    base: fc.oneof(microArb, fc.constant(0n)),
    delta: fc.integer({ min: -2000, max: 2000 }),
    other: microArb,
    mode: fc.integer({ min: 0, max: 2 }),
    thenScale: scaleArb,
    nowScale: scaleArb,
  })
  .map(({ base, delta, other, mode, thenScale, nowScale }) => {
    const nowMicro =
      mode === 0 ? base : mode === 1 ? base + BigInt(delta) : other;
    const safeNow = nowMicro < 0n ? 0n : nowMicro > MAX_MICRO ? MAX_MICRO : nowMicro;
    return {
      then: textOf(base, thenScale),
      now: textOf(safeNow, nowScale),
    };
  });

const unitArb = fc.constantFrom(...UNITS);

function figure(
  value: string,
  period: string,
  unit: (typeof UNITS)[number],
): FigureV1 {
  return {
    kind: "official",
    metric_id: "digits-test",
    value,
    unit: unit.unit,
    region: unit.region,
    period,
    source: "Test source",
    series_id: "TEST-SERIES",
    retrieved_at: "2026-10-30T14:02:11Z",
    source_url: "https://example.test/series",
  } as FigureV1;
}

/**
 * The change display for one pair, built the way FigureEntry builds it: the
 * display rescale applies to both inputs, then the difference uses the unit's
 * digits.
 */
function displayedChange(then: FigureV1, now: FigureV1) {
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
      : rescaledChangeInputs(then.value, now.value, rescale);
  const shown =
    inputs === undefined ? change : displayChangeResult(change, inputs);

  return formatChange(shown, then.region, {
    differenceDigits: differenceDigitsFor(
      shownUnit,
      shown.then.value,
      shown.now.value,
    ),
  });
}

describe("Property 11: the displayed change has the shown precision and the exact sign", () => {
  it("matches the shown digits, the exact sign, the direction and the percentage", () => {
    fc.assert(
      fc.property(pairArb, unitArb, ({ then: thenText, now: nowText }, unit) => {
        const thenFig = figure(thenText, "2024-09", unit);
        const nowFig = figure(nowText, "2026-09", unit);
        const shown = displayedChange(thenFig, nowFig);

        // The printed then and now values, as displayFigureValue prints them.
        const printedThen = displayFigureValue(thenText, unit.unit, unit.region).text;
        const printedNow = displayFigureValue(nowText, unit.unit, unit.region).text;
        const expectedDigits = Math.max(
          fractionDigitsOfText(printedThen),
          fractionDigitsOfText(printedNow),
        );

        // Digits: the difference has as many fraction digits as the printed values.
        const magnitude = shown.difference.replace(/^[+\u2212]/, "");
        expect(fractionDigitsOfText(magnitude)).toBe(expectedDigits);

        // Sign and direction come from the exact difference, not the rounded text.
        const diffSign = signOf(micro(nowText) - micro(thenText));
        if (diffSign > 0) {
          expect(shown.difference.startsWith("+")).toBe(true);
          expect(shown.direction).toBe("rose");
        } else if (diffSign < 0) {
          expect(shown.difference.startsWith("\u2212")).toBe(true);
          expect(shown.direction).toBe("fell");
        } else {
          expect(/^[+\u2212]/.test(shown.difference)).toBe(false);
          expect(shown.direction).toBe("unchanged");
        }
        expect(/^\d/.test(magnitude)).toBe(true);

        // Percentage: absent when then is 0, otherwise one digit and the same sign rule.
        if (micro(thenText) === 0n) {
          expect(shown.percent).toBeNull();
        } else {
          expect(shown.percent).not.toBeNull();
          const percent = shown.percent ?? "";
          expect(percent.endsWith("%")).toBe(true);
          const percentBody = percent.slice(0, -1).replace(/^[+\u2212]/, "");
          expect(fractionDigitsOfText(percentBody)).toBe(1);
          const percentSign = percent.startsWith("+")
            ? 1
            : percent.startsWith("\u2212")
              ? -1
              : 0;
          // then is positive here, so the percentage has the difference's sign.
          expect(percentSign).toBe(diffSign);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("keeps the sign of a difference that rounds to zero at the shown digits", () => {
    // Fuel shows two digits. 3.001 against 3.000 prints as 3.00 and 3.00, yet the
    // exact difference is positive, so the text carries "+" and "rose".
    const then = figure("3.000", "2024-09", UNITS[0]);
    const now = figure("3.001", "2026-09", UNITS[0]);
    const shown = displayedChange(then, now);
    expect(shown.difference).toBe("+0.00");
    expect(shown.direction).toBe("rose");
  });
});
