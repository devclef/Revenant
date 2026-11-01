// Feature: 05-reveal-ceremony
//
// Unit tests for ceremony/figures/number-line.ts: padding, the zero-zero case,
// the minimum span when then = now, clamping of the Mark, and the mirror
// property (a fall's positions are 1 - p of the rise's, Property 11 and R10.4).

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  LINE_PAD_SPAN_FRACTION,
  LINE_PAD_VALUE_FRACTION,
  LINE_PAD_ZERO,
} from "../constants";
import { clamp01, numberLineGeometry } from "./number-line";

const EPS = 1e-9;

describe("numberLineGeometry padding", () => {
  it("pads by the span fraction when that is the larger term", () => {
    // span 10, |t| 10: 0.25 * 10 = 2.5 beats 0.05 * 10 = 0.5
    const g = numberLineGeometry("10", "20");
    expect(g.pad).toBeCloseTo(2.5, 12);
    expect(g.rangeLow).toBeCloseTo(7.5, 12);
    expect(g.rangeHigh).toBeCloseTo(22.5, 12);
    expect(g.posThen).toBeCloseTo(1 / 6, 12);
    expect(g.posNow).toBeCloseTo(5 / 6, 12);
    expect(g.posMark).toBeUndefined();
  });

  it("pads by the value fraction when that is the larger term", () => {
    // span 1, |t| 100: max(0.25, 5) = 5
    const g = numberLineGeometry(100, 101);
    expect(g.pad).toBeCloseTo(LINE_PAD_VALUE_FRACTION * 100, 12);
    expect(g.pad).toBeCloseTo(5, 12);
  });

  it("uses the constants from constants.ts", () => {
    expect(LINE_PAD_SPAN_FRACTION).toBe(0.25);
    expect(LINE_PAD_VALUE_FRACTION).toBe(0.05);
    expect(LINE_PAD_ZERO).toBe(1);
  });

  it("gives equal padding on both sides of the span", () => {
    const g = numberLineGeometry("3.5", "7.25");
    expect(g.posThen).toBeGreaterThan(0);
    expect(g.posNow).toBeLessThan(1);
    const leftGap = 3.5 - g.rangeLow;
    const rightGap = g.rangeHigh - 7.25;
    expect(leftGap).toBeCloseTo(rightGap, 12);
    expect(leftGap).toBeCloseTo(g.pad, 12);
  });

  it("reads the then and now values from the strings with Number()", () => {
    const fromStrings = numberLineGeometry("3.412", "3.90");
    const fromNumbers = numberLineGeometry(3.412, 3.9);
    expect(fromStrings).toEqual(fromNumbers);
  });
});

describe("numberLineGeometry minimum span", () => {
  it("gives a 10 percent span when then equals now", () => {
    const g = numberLineGeometry("50", "50");
    expect(g.rangeHigh - g.rangeLow).toBeCloseTo(0.1 * 50, 12);
    expect(g.posThen).toBeCloseTo(0.5, 12);
    expect(g.posNow).toBeCloseTo(0.5, 12);
  });

  it("gives a 2-unit span when then and now are both zero", () => {
    const g = numberLineGeometry("0", "0");
    expect(g.pad).toBe(LINE_PAD_ZERO);
    expect(g.rangeLow).toBe(-1);
    expect(g.rangeHigh).toBe(1);
    expect(g.rangeHigh - g.rangeLow).toBe(2);
    expect(g.posThen).toBeCloseTo(0.5, 12);
    expect(g.posNow).toBeCloseTo(0.5, 12);
  });

  it("does not use the zero case when only one value is zero", () => {
    const g = numberLineGeometry("0", "4");
    expect(g.pad).toBeCloseTo(1, 12); // 0.25 * span of 4
    expect(g.posThen).toBeCloseTo(1 / 6, 12);
    expect(g.posNow).toBeCloseTo(5 / 6, 12);
  });
});

describe("numberLineGeometry clamping and the Mark", () => {
  it("puts a Mark above the range on the upper edge", () => {
    const g = numberLineGeometry("10", "20", "1000");
    expect(g.posMark).toBe(1);
  });

  it("puts a Mark below the range on the lower edge", () => {
    const g = numberLineGeometry("10", "20", "-1000");
    expect(g.posMark).toBe(0);
  });

  it("returns plain edge values, so both edges look the same in markup", () => {
    const high = numberLineGeometry("10", "20", "1000").posMark;
    const low = numberLineGeometry("10", "20", "-1000").posMark;
    expect(typeof high).toBe("number");
    expect(typeof low).toBe("number");
    expect(Object.is(high, 1)).toBe(true);
    expect(Object.is(low, 0)).toBe(true);
  });

  it("places an in-range Mark between the edges", () => {
    const g = numberLineGeometry("10", "20", "15");
    expect(g.posMark).toBeCloseTo((15 - 7.5) / 15, 12);
  });

  it("leaves the range unchanged for any Mark (Property 11)", () => {
    const base = numberLineGeometry("10", "20");
    const withA = numberLineGeometry("10", "20", "12");
    const withB = numberLineGeometry("10", "20", "-500");
    for (const g of [withA, withB]) {
      expect(g.rangeLow).toBe(base.rangeLow);
      expect(g.rangeHigh).toBe(base.rangeHigh);
      expect(g.pad).toBe(base.pad);
      expect(g.posThen).toBe(base.posThen);
      expect(g.posNow).toBe(base.posNow);
    }
  });

  it("has no Mark position when there is no answer", () => {
    expect(numberLineGeometry("1", "2").posMark).toBeUndefined();
  });

  it("clamp01 keeps values in [0, 1] and leaves inner values alone", () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(7)).toBe(1);
    expect(clamp01(0.42)).toBe(0.42);
  });

  it("throws on a non-numeric value rather than drawing NaN", () => {
    expect(() => numberLineGeometry("abc", "2")).toThrow(RangeError);
    expect(() => numberLineGeometry("1", "2", "nope")).toThrow(RangeError);
  });
});

describe("numberLineGeometry mirror property", () => {
  // Rise: then t, now t + d. Fall: then t, now t - d. The fall's range is the
  // rise's reflected about t, and a Mark m on the rise is 2t - m on the fall.
  // Every position on the fall must then be 1 - p of the rise's position.
  const finiteValue = fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true });
  const positiveDelta = fc.double({ min: 1e-3, max: 1e6, noNaN: true, noDefaultInfinity: true });
  const mark = fc.double({ min: -2e6, max: 2e6, noNaN: true, noDefaultInfinity: true });

  it("gives the fall's positions as 1 minus the rise's positions", () => {
    fc.assert(
      fc.property(finiteValue, positiveDelta, mark, (t, d, m) => {
        const rise = numberLineGeometry(t, t + d, m);
        const fall = numberLineGeometry(t, t - d, 2 * t - m);
        expect(Math.abs(fall.posThen - (1 - rise.posThen))).toBeLessThan(EPS);
        expect(Math.abs(fall.posNow - (1 - rise.posNow))).toBeLessThan(EPS);
        expect(Math.abs((fall.posMark as number) - (1 - (rise.posMark as number)))).toBeLessThan(EPS);
        expect(Math.abs(fall.pad - rise.pad)).toBeLessThan(EPS * Math.max(1, Math.abs(t)));
      }),
    );
  });

  it("keeps Mark positions exactly on the mirror, clamped edges included", () => {
    fc.assert(
      fc.property(finiteValue, positiveDelta, mark, (t, d, m) => {
        const rise = numberLineGeometry(t, t + d, m);
        const fall = numberLineGeometry(t, t - d, 2 * t - m);
        const p = rise.posMark as number;
        const q = fall.posMark as number;
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
        expect(Math.abs(q - (1 - p))).toBeLessThan(EPS);
      }),
    );
  });
});
