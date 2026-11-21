// Feature: 15-the-flow, Property 6: The change line follows the figures
//
// For any two comparable figures, the difference has the same number of decimals
// as the larger of the two values, the percentage has one, and both come from
// full precision values.
//
// The expected text is worked out here with BigInt arithmetic on the sealed
// strings, not with the figures code under test. The pipeline is the one the
// change line prints: computeChange, then formatChange.
//
// Validates requirement 12.4.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { computeChange, formatChange, type ChangeResult } from "@/lib/figures";
import type { FigureV1 } from "@/lib/seal-format";

const REGION = "U.S. city average";
const UNIT = "USD per gallon";
const THEN_PERIOD = "2024-01";
const NOW_PERIOD = "2025-01";

/** The exact scale of every value: 4 decimal places, held as a BigInt. */
const SCALE = 4;

/** One sealed value: an integer count of 10^-scale units and its decimals. */
const valueArb = fc.record({
  units: fc.bigInt({ min: 0n, max: 9_999_999n }),
  scale: fc.integer({ min: 0, max: SCALE }),
});

/**
 * The canonical decimal string for `units` at `scale` decimals. The units are
 * always a multiple of 10^(SCALE - scale), so the text is exact.
 */
function textOf(units: bigint, scale: number): string {
  const digits = 10n ** BigInt(scale);
  const quantised = units / 10n ** BigInt(SCALE - scale);
  const wholePart = quantised / digits;
  if (scale === 0) return wholePart.toString();
  const frac = (quantised % digits).toString().padStart(scale, "0");
  return `${wholePart}.${frac}`;
}

/** The value as an exact count of 10^-SCALE units. */
function unitsOf(value: { units: bigint; scale: number }): bigint {
  const step = 10n ** BigInt(SCALE - value.scale);
  return (value.units / step) * step;
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

/** Digits after the decimal point of a canonical string. */
function fractionDigits(text: string): number {
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

/** Removes the thousands separators that the locale adds. */
function plain(text: string): string {
  return text.replace(/,/g, "");
}

/**
 * The percentage as exact arithmetic: (now - then) / then × 100, rounded half
 * away from zero to one decimal. Returns the magnitude in tenths.
 */
function percentTenths(diff: bigint, thenUnits: bigint): bigint {
  const absDiff = diff < 0n ? -diff : diff;
  const numerator = 1000n * absDiff;
  return (2n * numerator + thenUnits) / (2n * thenUnits);
}

function resultOf(
  then: FigureV1,
  now: FigureV1,
): Extract<ChangeResult, { comparable: true }> {
  const result = computeChange(then, now);
  if (!result.comparable) {
    throw new Error(`expected comparable figures, got ${result.reason}`);
  }
  return result;
}

describe("Property 6: the change line follows the figures", () => {
  it("shows the difference with the larger value's decimals and the percentage with one", () => {
    fc.assert(
      fc.property(valueArb, valueArb, (thenValue, nowValue) => {
        const thenText = textOf(unitsOf(thenValue), thenValue.scale);
        const nowText = textOf(unitsOf(nowValue), nowValue.scale);
        const result = resultOf(
          figure(thenText, THEN_PERIOD),
          figure(nowText, NOW_PERIOD),
        );
        const shown = formatChange(result, REGION);

        // The difference has as many decimals as the larger input value.
        const digits = Math.max(
          fractionDigits(thenText),
          fractionDigits(nowText),
        );
        const magnitude = plain(shown.difference).replace(/^[+\u2212]/, "");
        expect(fractionDigits(magnitude)).toBe(digits);

        // Its value is the exact difference, with no rounding needed at that scale.
        const thenUnits = unitsOf(thenValue);
        const nowUnits = unitsOf(nowValue);
        const diff = nowUnits - thenUnits;
        const absDiff = diff < 0n ? -diff : diff;
        const quantum = 10n ** BigInt(SCALE - digits);
        const exact = absDiff / quantum;
        const digitsDenominator = 10n ** BigInt(digits);
        const expectedMagnitude =
          digits === 0
            ? (exact / digitsDenominator).toString()
            : `${exact / digitsDenominator}.${(exact % digitsDenominator).toString().padStart(digits, "0")}`;
        expect(magnitude).toBe(expectedMagnitude);

        // The direction and sign come from the exact difference.
        if (diff === 0n) {
          expect(shown.direction).toBe("unchanged");
          expect(
            shown.difference.startsWith("+") ||
              shown.difference.startsWith("\u2212"),
          ).toBe(false);
        } else if (diff > 0n) {
          expect(shown.direction).toBe("rose");
          expect(shown.difference.startsWith("+")).toBe(true);
        } else {
          expect(shown.direction).toBe("fell");
          expect(shown.difference.startsWith("\u2212")).toBe(true);
        }

        // The percentage: null only when then is zero, otherwise one decimal,
        // rounded half away from zero from the exact ratio.
        if (thenUnits === 0n) {
          expect(shown.percent).toBeNull();
          return;
        }
        expect(shown.percent).not.toBeNull();
        const percent = plain(shown.percent ?? "").replace(/%$/, "");
        expect(fractionDigits(percent.replace(/^[+\u2212]/, ""))).toBe(1);

        const tenths = percentTenths(diff, thenUnits);
        const tenthsText = `${tenths / 10n}.${tenths % 10n}`;
        const percentSign = diff === 0n ? "" : diff > 0n ? "+" : "\u2212";
        expect(percent).toBe(`${percentSign}${tenthsText}`);
      }),
      { numRuns: 300 },
    );
  });
});
