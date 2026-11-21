// Property tests for formula inputs and display precision
// (spec 03-persona-demo, design.md; Property 5 and Property 6).
//
// Property 5: a stored value at published precision reaches the formula at full
// precision. formulaInput keeps every stored digit, so the formula sees the same
// value the publisher printed.
//
// Property 6: display rounding never changes the change calculation. The change
// is computed once from the unrounded inputs; the display decimals only affect
// the text shown, never the stored difference or the direction.
//
// Uses fast-check (already a project dependency). Every oracle is exact BigInt
// work from decimal.ts, so no test value passes through a binary float.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import type { FigureV1 } from "@/lib/seal-format";

import { computeChange } from "./change";
import {
  isZero,
  parseDecimal,
  roundDecimal,
  sub,
  toDecimalString,
  type Decimal,
} from "./decimal";
import { formatChange, formatValue } from "./format-change";
import { formulaInput } from "./formula-input";
import { PUBLISHED_PRECISION } from "./published-precision";

const REGION = "U.S. city average";

// A canonical-ish decimal string up to 26 integer digits and 12 fraction digits,
// including zero, negatives and very small magnitudes.
const valueArb: fc.Arbitrary<string> = fc
  .record({
    negative: fc.boolean(),
    intDigits: fc.string({
      unit: fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"),
      minLength: 1,
      maxLength: 26,
    }),
    scale: fc.integer({ min: 0, max: 12 }),
    fracDigits: fc.string({
      unit: fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"),
      minLength: 0,
      maxLength: 12,
    }),
  })
  .map(({ negative, intDigits, scale, fracDigits }) => {
    let frac = fracDigits;
    if (scale === 0) {
      frac = "";
    } else if (frac.length < scale) {
      frac = frac + "0".repeat(scale - frac.length);
    } else {
      frac = frac.slice(0, scale);
    }
    const body = frac.length === 0 ? intDigits : `${intDigits}.${frac}`;
    return negative && body.replace(/[0.]/g, "") !== "" ? `-${body}` : body;
  });

// The series keys that carry a published precision row (EIA today).
const publishedSeries = Object.keys(PUBLISHED_PRECISION);

// A value string with exactly `decimals` fraction digits, the shape a publisher
// prints for a series with a precision row. Zero is never negative.
const publishedValueArb: fc.Arbitrary<{ text: string; decimals: number }> = fc
  .record({
    series: fc.constantFrom(...publishedSeries),
    negative: fc.boolean(),
    whole: fc.bigInt({ min: 0n, max: 10n ** 12n }),
    fraction: fc.bigInt({ min: 0n, max: 10n ** 9n - 1n }),
  })
  .map(({ series, negative, whole, fraction }) => {
    const decimals = PUBLISHED_PRECISION[series].decimals;
    const fracCap = 10n ** BigInt(decimals);
    const frac = (fraction % fracCap).toString().padStart(decimals, "0");
    const isZeroValue = whole === 0n && /^0*$/.test(frac);
    const sign = negative && !isZeroValue ? "-" : "";
    const text = decimals === 0 ? `${sign}${whole}` : `${sign}${whole}.${frac}`;
    return { text, decimals };
  });

// An official figure with every provenance field, varying only the value. The
// periods are fixed in the tests below so comparability holds.
function official(overrides: Partial<FigureV1> = {}): FigureV1 {
  return {
    kind: "official",
    metric_id: "us-gasoline",
    value: "2.00",
    unit: "USD per gallon",
    region: REGION,
    period: "2024-09",
    source: "U.S. EIA",
    series_id: "EMM_EPMR_PTE_NUS_DPG",
    retrieved_at: "2026-10-30T14:02:11Z",
    source_url: "https://www.eia.gov/series",
    ...overrides,
  } as FigureV1;
}

// The unsigned value of a decimal, for comparing against the magnitude text.
function absolute(d: Decimal): Decimal {
  return d.int < 0n ? { int: -d.int, scale: d.scale } : d;
}

describe("Property 5: formulaInput keeps the stored value at full precision", () => {
  it("keeps the published decimals and every stored digit", () => {
    fc.assert(
      fc.property(publishedValueArb, ({ text, decimals }) => {
        const input = formulaInput(text);

        // The scale is exactly the published fraction digit count.
        expect(input.scale).toBe(decimals);

        // The value equals the stored text read as an exact decimal.
        expect(input).toEqual(parseDecimal(text));
        expect(toDecimalString(input)).toBe(
          toDecimalString(parseDecimal(text)),
        );

        // Full precision: the integer is the stored digits with no rounding.
        const digits = text.replace("-", "").replace(".", "");
        const expectedInt = BigInt(digits) * (text.startsWith("-") ? -1n : 1n);
        expect(input.int).toBe(expectedInt);
      }),
    );
  });

  it("keeps any canonical decimal value at its stored scale", () => {
    fc.assert(
      fc.property(valueArb, (text) => {
        const input = formulaInput(text);
        const dot = text.indexOf(".");
        const storedScale = dot === -1 ? 0 : text.length - dot - 1;
        expect(input.scale).toBe(storedScale);
        expect(input).toEqual(parseDecimal(text));
      }),
    );
  });
});

describe("Property 6: display rounding never changes the change calculation", () => {
  it("computes the same difference and direction whatever the display decimals", () => {
    fc.assert(
      fc.property(
        valueArb,
        valueArb,
        fc.integer({ min: 0, max: 8 }),
        (thenValue, nowValue, displayDecimals) => {
          const then = official({ value: thenValue, period: "2024-09" });
          const now = official({ value: nowValue, period: "2026-09" });

          // The calculation runs once, on the unrounded inputs.
          const result = computeChange(then, now);
          expect(result.comparable).toBe(true);
          if (!result.comparable) {
            return;
          }

          // The stored difference is the exact now minus then.
          const exactDiff = sub(
            parseDecimal(nowValue),
            parseDecimal(thenValue),
          );
          expect(result.difference).toBe(toDecimalString(exactDiff));

          // Rounding the display does not alter the calculation: the same
          // inputs produce the same result object.
          expect(computeChange(then, now)).toEqual(result);

          // The direction comes from the exact difference, even when the
          // display rounds the difference to zero.
          const shown = formatChange(result, REGION, {
            differenceDigits: displayDecimals,
          });
          const expectedDirection = isZero(exactDiff)
            ? "unchanged"
            : exactDiff.int < 0n
              ? "fell"
              : "rose";
          expect(shown.direction).toBe(expectedDirection);

          // The unsigned difference shows the exact magnitude rounded half away
          // from zero at the requested decimals, and nothing else.
          const rounded = roundDecimal(absolute(exactDiff), displayDecimals);
          expect(shown.differenceMagnitude).toBe(
            formatValue(toDecimalString(rounded), REGION, displayDecimals),
          );
        },
      ),
    );
  });
});
