import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { FALLBACK_RANGE, UNIT_RANGE_TABLE, type ScaleRange } from "./unit-ranges";
import {
  linearStepFor,
  positionOfIn,
  toPlainDecimalIn,
  valueAt,
  valueAtIn,
} from "./scale-math";

// Feature: 08-judge-polish, Task 1 (range-taking forms of scale-math).
//
// The Fallback_Range forms are in scale-math.test.ts and are unchanged. These
// tests cover the new range-taking forms. Property 3 covers every range the
// table and the Fallback_Range give.

const NUM_RUNS = 100;
const NUMBER_PATTERN = /^[0-9]+(\.[0-9]+)?$/;

const RANGES: readonly ScaleRange[] = [
  UNIT_RANGE_TABLE["USD per gallon"],
  UNIT_RANGE_TABLE["EUR per litre"],
  FALLBACK_RANGE,
];

describe("linearStepFor", () => {
  it("is 0.01 for a maximum of 10 and 0.001 for a maximum of 3", () => {
    expect(linearStepFor(UNIT_RANGE_TABLE["USD per gallon"])).toBe(0.01);
    expect(linearStepFor(UNIT_RANGE_TABLE["EUR per litre"])).toBe(0.001);
  });
});

describe("valueAtIn — examples", () => {
  it("snaps USD to 0.01 steps at three significant figures", () => {
    const usd = UNIT_RANGE_TABLE["USD per gallon"];
    expect(valueAtIn(0.347, usd)).toBe(3.47);
    expect(valueAtIn(0, usd)).toBe(0);
    expect(valueAtIn(1, usd)).toBe(10);
  });

  it("snaps EUR per litre to 0.001 steps and keeps three significant figures", () => {
    const eur = UNIT_RANGE_TABLE["EUR per litre"];
    expect(valueAtIn(0.5713, eur)).toBe(1.71);
    expect(valueAtIn(1, eur)).toBe(3);
  });

  it("clamps the track position to [0, 1]", () => {
    const usd = UNIT_RANGE_TABLE["USD per gallon"];
    expect(valueAtIn(-3, usd)).toBe(0);
    expect(valueAtIn(4, usd)).toBe(10);
  });

  it("the Fallback_Range gives the same values as valueAt", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (x) => {
        expect(valueAtIn(x, FALLBACK_RANGE)).toBe(valueAt(x));
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("positionOfIn — examples", () => {
  it("is 0 below the minimum and 1 above the maximum", () => {
    const usd = UNIT_RANGE_TABLE["USD per gallon"];
    expect(positionOfIn(12, usd)).toBe(1);
    expect(positionOfIn(-1, usd)).toBe(0);
    expect(positionOfIn(5, usd)).toBe(0.5);
  });

  it("is 0 for NaN", () => {
    expect(positionOfIn(Number.NaN, UNIT_RANGE_TABLE["USD per gallon"])).toBe(0);
  });
});

describe("toPlainDecimalIn — examples", () => {
  it("writes 0 as \"0\" and trims fractional zeros", () => {
    const usd = UNIT_RANGE_TABLE["USD per gallon"];
    expect(toPlainDecimalIn(0, usd)).toBe("0");
    expect(toPlainDecimalIn(3.47, usd)).toBe("3.47");
    expect(toPlainDecimalIn(2, usd)).toBe("2");
  });

  it("writes EUR per litre values with their decimals, trimmed", () => {
    expect(toPlainDecimalIn(1.71, UNIT_RANGE_TABLE["EUR per litre"])).toBe("1.71");
  });

  it("throws for a value outside the range", () => {
    expect(() => toPlainDecimalIn(11, UNIT_RANGE_TABLE["USD per gallon"])).toThrow(
      RangeError,
    );
  });
});

// Property 3: Every scale value is a valid Recall_Record number, and off-range
// answers sit at the nearer edge.
// Validates: Requirements 7.6, 7.7
describe("Property 3: scale values are valid record numbers", () => {
  it("toPlainDecimalIn(valueAtIn(x)) matches the record pattern for every range", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...RANGES),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (range, x) => {
          const text = toPlainDecimalIn(valueAtIn(x, range), range);
          expect(text).toMatch(NUMBER_PATTERN);
          expect(text.length).toBeLessThanOrEqual(40);
          const value = Number(text);
          expect(value).toBeGreaterThanOrEqual(range.min);
          expect(value).toBeLessThanOrEqual(range.max);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("positionOfIn is 0 below the minimum and 1 above the maximum", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...RANGES),
        fc.double({ noNaN: true, noDefaultInfinity: false }),
        (range, value) => {
          const position = positionOfIn(value, range);
          if (value <= range.min) expect(position).toBe(0);
          if (value >= range.max) expect(position).toBe(1);
          expect(position).toBeGreaterThanOrEqual(0);
          expect(position).toBeLessThanOrEqual(1);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
