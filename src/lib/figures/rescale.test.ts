// Tests for display-only decimal-point rescale (spec 03-persona-demo, design.md).

import { describe, expect, it } from "vitest";

import { rescaleForDisplay } from "./rescale";

describe("rescaleForDisplay", () => {
  it("shifts the decimal point left by the power of ten", () => {
    expect(rescaleForDisplay("1234", 1000)).toBe("1.234");
    expect(rescaleForDisplay("3412", 1000)).toBe("3.412");
    expect(rescaleForDisplay("50", 100)).toBe("0.5");
  });

  it("rescales by every allowed power of ten (10..1_000_000)", () => {
    expect(rescaleForDisplay("25", 10)).toBe("2.5");
    expect(rescaleForDisplay("1234567", 1000000)).toBe("1.234567");
  });

  it("is exact for a value that already carries a long fraction", () => {
    // A long fraction is preserved digit-for-digit: no rounding, no float error.
    expect(rescaleForDisplay("12345678901234567890", 1000)).toBe(
      "12345678901234567.89",
    );
    expect(rescaleForDisplay("1.23456789", 100)).toBe("0.0123456789");
  });

  it("canonicalises the result (trims trailing fractional zeros, no -0)", () => {
    // 1000 / 1000 = 1 exactly; scale shift gives "1.000" -> canonical "1".
    expect(rescaleForDisplay("1000", 1000)).toBe("1");
    // 0 stays 0 and never becomes -0.
    expect(rescaleForDisplay("0", 1000)).toBe("0");
    expect(rescaleForDisplay("-0", 100)).toBe("0");
    // A negative value keeps its sign.
    expect(rescaleForDisplay("-3412", 1000)).toBe("-3.412");
  });

  it("throws RangeError when the divisor is not an exact power of ten", () => {
    for (const bad of [1, 2, 5, 3, 250, 1024, 1500, 10000000]) {
      expect(() => rescaleForDisplay("1234", bad)).toThrow(RangeError);
    }
  });

  it("throws RangeError when the divisor is not an integer power of ten", () => {
    for (const bad of [10.5, 100.1, NaN, Infinity]) {
      expect(() => rescaleForDisplay("1234", bad)).toThrow(RangeError);
    }
  });

  it("throws RangeError when the value is not a canonical decimal string", () => {
    expect(() => rescaleForDisplay("", 1000)).toThrow(RangeError);
    expect(() => rescaleForDisplay("abc", 1000)).toThrow(RangeError);
    expect(() => rescaleForDisplay("1e3", 1000)).toThrow(RangeError);
  });
});
