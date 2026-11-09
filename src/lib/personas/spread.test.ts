// Property 14: the Spread_Rule classifier is exact (spec 10 design.md;
// requirements C5.2).
//
// The reference below computes each comparison as a ratio of two BigInt
// fractions (candidate over Then_Value, cross-multiplied), a different route
// from the classifier's common-scale integers. Both must agree on every input.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  SPREAD_ABOVE_MIN_PCT,
  SPREAD_BELOW_MAX_PCT,
  SPREAD_NEAR_PCT,
  classifyCandidate,
  type SpreadClass,
} from "./spread";

/** A decimal string for `int` shifted right by `scale` digits. */
function decimal(int: bigint, scale: number): string {
  if (scale === 0) return int.toString();
  const digits = int.toString().padStart(scale + 1, "0");
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

/** The exact value of a decimal string as a numerator over a power of ten. */
function fraction(text: string): { num: bigint; den: bigint } {
  const dot = text.indexOf(".");
  if (dot === -1) return { num: BigInt(text), den: BigInt(1) };
  const fractionDigits = text.length - dot - 1;
  return {
    num: BigInt(text.slice(0, dot) + text.slice(dot + 1)),
    den: BigInt(10) ** BigInt(fractionDigits),
  };
}

/**
 * The reference classifier. The ratio candidate/then is p/q with p and q
 * positive integers (q > 0), so every threshold is an integer comparison.
 */
function referenceClassify(candidate: string, then: string): SpreadClass {
  const c = fraction(candidate);
  const t = fraction(then);
  // candidate / then = (c.num / c.den) / (t.num / t.den) = (c.num * t.den) / (c.den * t.num)
  const p = c.num * t.den;
  const q = c.den * t.num;
  const gap = p > q ? p - q : q - p;
  const hundred = BigInt(100);
  if (gap * hundred <= BigInt(SPREAD_NEAR_PCT) * q) return "near";
  if (p * hundred <= BigInt(SPREAD_BELOW_MAX_PCT) * q) return "below";
  if (p * hundred >= BigInt(SPREAD_ABOVE_MIN_PCT) * q) return "above";
  return "between";
}

const intArb = fc.bigInt({ min: BigInt(0), max: BigInt(10) ** BigInt(12) });
const scaleArb = fc.integer({ min: 0, max: 6 });
const positiveIntArb = fc.bigInt({
  min: BigInt(1),
  max: BigInt(10) ** BigInt(12),
});

describe("classifyCandidate (Property 14)", () => {
  it("matches the rational reference for any candidate and positive Then_Value", () => {
    fc.assert(
      fc.property(
        intArb,
        scaleArb,
        positiveIntArb,
        scaleArb,
        (cInt, cScale, tInt, tScale) => {
          const candidate = decimal(cInt, cScale);
          const then = decimal(tInt, tScale);
          expect(classifyCandidate(candidate, then)).toBe(
            referenceClassify(candidate, then),
          );
        },
      ),
      { numRuns: 2000 },
    );
  });

  it("puts a candidate sitting right on each threshold in the class the rule names", () => {
    // Then 100: near covers 95 to 105 inclusive, below is at most 85, above is at least 115.
    expect(classifyCandidate("95", "100")).toBe("near");
    expect(classifyCandidate("105", "100")).toBe("near");
    expect(classifyCandidate("94.99", "100")).toBe("between");
    expect(classifyCandidate("105.01", "100")).toBe("between");
    expect(classifyCandidate("85", "100")).toBe("below");
    expect(classifyCandidate("85.01", "100")).toBe("between");
    expect(classifyCandidate("115", "100")).toBe("above");
    expect(classifyCandidate("114.99", "100")).toBe("between");
  });

  it("handles differing decimal scales without rounding", () => {
    // 1.0499 is within 5 % of 1.0 (the gap is 0.0499, and 5 % of 1.0 is 0.05).
    expect(classifyCandidate("1.0499", "1.0")).toBe("near");
    // 1.05 sits exactly on the near boundary of 1.0, so it is near too.
    expect(classifyCandidate("1.05", "1")).toBe("near");
    expect(classifyCandidate("1.0501", "1")).toBe("between");
    // 0.85 against 1.000 is exactly the below boundary.
    expect(classifyCandidate("0.85", "1.000")).toBe("below");
  });

  it("classifies the design's Maya and Tomás values as the design table says", () => {
    expect(classifyCandidate("3.64", "3.643")).toBe("near");
    expect(classifyCandidate("2.99", "3.643")).toBe("below");
    expect(classifyCandidate("4.25", "3.643")).toBe("above");
    expect(classifyCandidate("1.49", "1.7913149889844324")).toBe("below");
    expect(classifyCandidate("2.09", "1.7913149889844324")).toBe("above");
  });

  it("rejects a Then_Value that is zero or not a plain decimal", () => {
    expect(() => classifyCandidate("1", "0")).toThrow(RangeError);
    expect(() => classifyCandidate("1", "0.00")).toThrow(RangeError);
    expect(() => classifyCandidate("-1", "3")).toThrow(RangeError);
    expect(() => classifyCandidate("1,5", "3")).toThrow(RangeError);
    expect(() => classifyCandidate("1.5", "3.")).toThrow(RangeError);
  });
});
