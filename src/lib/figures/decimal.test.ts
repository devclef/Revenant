// Tests for the exact BigInt decimal module (spec 03-persona-demo, design.md).

import { describe, expect, it } from "vitest";

import {
  add,
  isZero,
  parseDecimal,
  ratioPercent,
  sub,
  toDecimalString,
} from "./decimal";

describe("parseDecimal", () => {
  it("throws RangeError on strings not matching ^-?[0-9]+(\\.[0-9]+)?$", () => {
    for (const bad of ["", ".", "1.", "-", "1.2.3", "abc", "+1", "1e3"]) {
      expect(() => parseDecimal(bad)).toThrow(RangeError);
    }
  });

  it("accepts canonical and zero-ish forms", () => {
    // "0" and "-0" both canonicalise to "0".
    expect(toDecimalString(parseDecimal("0"))).toBe("0");
    expect(toDecimalString(parseDecimal("-0"))).toBe("0");
    expect(toDecimalString(parseDecimal("3.412"))).toBe("3.412");
    // "-3.00" is a valid input; its canonical form drops the sign (zero frac)
    // only trailing fractional zeros are trimmed, so -3.00 -> -3.
    expect(toDecimalString(parseDecimal("-3.00"))).toBe("-3");
  });
});

describe("toDecimalString", () => {
  it("strips trailing fractional zeros", () => {
    expect(toDecimalString(parseDecimal("3.00"))).toBe("3");
    expect(toDecimalString(parseDecimal("3.10"))).toBe("3.1");
    expect(toDecimalString(parseDecimal("3.412000"))).toBe("3.412");
  });

  it("never emits -0", () => {
    expect(toDecimalString(parseDecimal("-0"))).toBe("0");
    expect(toDecimalString(parseDecimal("-0.00"))).toBe("0");
    // A difference that lands exactly on zero is also "0", not "-0".
    expect(toDecimalString(sub(parseDecimal("3"), parseDecimal("3.00")))).toBe("0");
  });

  it("keeps the sign and all significant fractional digits", () => {
    expect(toDecimalString(parseDecimal("-3.00"))).toBe("-3");
    expect(toDecimalString(parseDecimal("-0.5"))).toBe("-0.5");
  });
});

describe("add / sub", () => {
  it("aligns differing scales exactly", () => {
    expect(toDecimalString(add(parseDecimal("2.00"), parseDecimal("0.5")))).toBe("2.5");
    expect(toDecimalString(sub(parseDecimal("9.00"), parseDecimal("6")))).toBe("3");
    expect(toDecimalString(add(parseDecimal("1.005"), parseDecimal("2.1")))).toBe("3.105");
    expect(toDecimalString(sub(parseDecimal("1.2"), parseDecimal("1.25")))).toBe("-0.05");
  });

  it("is exact for long fractions (no float error)", () => {
    expect(toDecimalString(add(parseDecimal("0.1"), parseDecimal("0.2")))).toBe("0.3");
  });
});

describe("isZero", () => {
  it("is true for every spelling of zero", () => {
    expect(isZero(parseDecimal("0"))).toBe(true);
    expect(isZero(parseDecimal("0.000"))).toBe(true);
    expect(isZero(parseDecimal("-0"))).toBe(true);
  });

  it("is false for non-zero values", () => {
    expect(isZero(parseDecimal("0.001"))).toBe(false);
    expect(isZero(parseDecimal("-3.00"))).toBe(false);
  });
});

describe("ratioPercent", () => {
  it("is exact for terminating ratios", () => {
    // 3/2 * 100 = 150 exactly.
    const r = ratioPercent(parseDecimal("3"), parseDecimal("2"));
    expect(r.value).toBe("150");
    expect(r.exact).toBe(true);
  });

  it("carries >= 20 significant digits and is inexact for a repeating ratio", () => {
    // 1/3 * 100 = 33.3333... never terminates.
    const r = ratioPercent(parseDecimal("1"), parseDecimal("3"));
    expect(r.exact).toBe(false);
    // Count significant digits (all digits, since there are no leading zeros
    // in 33.333...). Default budget is 20.
    const sigDigits = r.value.replace(/[.-]/g, "").length;
    expect(sigDigits).toBeGreaterThanOrEqual(20);
    expect(r.value.startsWith("33.333333333333333333")).toBe(true);
  });

  it("rounds half-to-even on a boundary case", () => {
    // 3/16 * 100 = 18.75 exactly (a terminating value), so the digit after the
    // kept significant digits is an exact 5 with nothing following it.
    // sig = 3: kept [1,8,7], guard 5, last kept digit 7 is odd -> round up.
    const up = ratioPercent(parseDecimal("3"), parseDecimal("16"), 3);
    expect(up.value).toBe("18.8");
    expect(up.exact).toBe(false);

    // 1/16 * 100 = 6.25 exactly.
    // sig = 2: kept [6,2], guard 5, last kept digit 2 is even -> round down.
    const down = ratioPercent(parseDecimal("1"), parseDecimal("16"), 2);
    expect(down.value).toBe("6.2");
    expect(down.exact).toBe(false);
  });

  it("returns 0 for a zero numerator", () => {
    const r = ratioPercent(parseDecimal("0"), parseDecimal("5"));
    expect(r.value).toBe("0");
    expect(r.exact).toBe(true);
  });
});
