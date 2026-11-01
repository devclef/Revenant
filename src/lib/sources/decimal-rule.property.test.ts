// Feature: 04-real-figures, Property 1: The Decimal_Rule is exact and idempotent on typed values
//
// Property-based test (fast-check, numRuns: 100) for cellToDecimal, the
// Decimal_Rule. It never computes a number: the output is either the stored
// double's shortest round-trip decimal or the publisher's display text, so the
// invariants below hold across the whole typed-value space (R5.2, R5.3, R5.4,
// R5.6, data-integrity.md "full published precision … round only for display").

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { cellToDecimal, type Cell } from "./decimal-rule";

const NUM_RUNS = 100;

/** The decimal shape cellToDecimal guarantees: no sign-less leading dot, no
 *  exponent form. The implementation and the property agree on this pattern. */
const DECIMAL_PATTERN = /^-?[0-9]+(\.[0-9]+)?$/;
const MAX_LENGTH = 40;

/** The in-range magnitude band: 1e-6 <= |v| < 1e21. Outside it String(v) uses
 *  exponent notation, which the rule rejects. */
const MIN_ABS = 1e-6;
const MAX_ABS = 1e21;

describe("Property 1: the Decimal_Rule is exact and idempotent on typed values", () => {
  it("for an in-range finite double, returns a plain decimal of <=40 chars that round-trips (unless the noise guard fired)", () => {
    fc.assert(
      fc.property(
        // Any finite double in the accepted magnitude band, either sign.
        fc
          .double({
            min: MIN_ABS,
            max: MAX_ABS,
            noNaN: true,
            noDefaultInfinity: true,
            minExcluded: false,
            maxExcluded: true,
          })
          .chain((mag) => fc.tuple(fc.constant(mag), fc.boolean())),
        // Arbitrary display text, including shapes the rule must ignore.
        fc.oneof(
          fc.constant(undefined),
          fc.string(),
          fc.constantFrom("", "n/a", "—", "1,234.5", " 12 "),
        ),
        ([mag, negative], w) => {
          const v = negative ? -mag : mag;
          // The generator can produce a value that rounds to exactly 1e21 or
          // to 0 at the double level; skip those, they are outside the band.
          fc.pre(Number.isFinite(v) && Math.abs(v) >= MIN_ABS && Math.abs(v) < MAX_ABS);

          const cell: Cell = { t: "n", v, w };
          const result = cellToDecimal(cell);

          expect(result).toMatch(DECIMAL_PATTERN);
          expect(result.length).toBeLessThanOrEqual(MAX_LENGTH);

          // Number(result) === v unless the noise guard preferred the display
          // text (which by construction agrees with v to 15 sig digits but may
          // differ in the ULPs below the publisher's precision).
          const stored = String(v);
          const guardFired = result !== stored;
          if (!guardFired) {
            expect(Number(result)).toBe(v);
          } else {
            // When the guard fired the display text was chosen; it still agrees
            // with the stored value to Excel's 15 significant digits.
            expect(Number(result).toPrecision(15)).toBe(v.toPrecision(15));
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("is idempotent on a clean decimal literal: cellToDecimal({t:'n', v:Number(D), w:D}) === D", () => {
    fc.assert(
      fc.property(decimalLiteralArb(), (d) => {
        const cell: Cell = { t: "n", v: Number(d), w: d };
        expect(cellToDecimal(cell)).toBe(d);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("prefers the display text D for a double within 1-3 representable steps of Number(D)", () => {
    fc.assert(
      fc.property(
        decimalLiteralArb(),
        fc.integer({ min: 1, max: 3 }),
        fc.boolean(),
        (d, steps, up) => {
          const base = Number(d);
          // Nudging a non-finite or zero base is meaningless; the literal
          // generator never produces those, but guard anyway.
          fc.pre(Number.isFinite(base) && base !== 0);

          const nudged = bumpUlps(base, up ? steps : -steps);
          fc.pre(Number.isFinite(nudged) && nudged !== 0);
          // The nudged double must still be in the accepted band, and must
          // still agree with D to 15 significant digits for the guard to fire.
          fc.pre(Math.abs(nudged) >= MIN_ABS && Math.abs(nudged) < MAX_ABS);
          fc.pre(nudged.toPrecision(15) === base.toPrecision(15));

          const cell: Cell = { t: "n", v: nudged, w: d };
          expect(cellToDecimal(cell)).toBe(d);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("throws for an exponent-form value, NaN, Infinity, or a non-numeric cell", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Too small: a non-zero magnitude whose String() form is an exponent
          // (0 < |v| < 1e-6). Zero is excluded: String(0) is "0", a plain
          // decimal the rule accepts, so it is not a rejection case.
          fc
            .double({ min: 0, max: MIN_ABS, maxExcluded: true, noNaN: true, noDefaultInfinity: true })
            .map((n) => (n === 0 ? Number.MIN_VALUE : n)),
          // Too large: |v| >= 1e21, where String() is also an exponent form.
          fc.double({ min: MAX_ABS, max: Number.MAX_VALUE, noNaN: true, noDefaultInfinity: true }),
          // NaN and infinities.
          fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY),
          // Non-numeric stored values with a numeric type tag.
          fc.constantFrom<unknown>("3.41", null, undefined, {}, true),
        ),
        // A non-numeric cell type should also throw regardless of value.
        fc.oneof(fc.constant("n"), fc.constantFrom("s", "b", "e", "", "str")),
        (value, t) => {
          // The rule rejects a cell when: the type is not "n"; the stored value
          // is not a finite number; or (with w === String(v), so the noise
          // guard never fires) String(v) is not a plain decimal of <=40 chars,
          // which is exactly the exponent forms. Only assert throwing for those.
          const w = typeof value === "number" ? String(value) : undefined;
          const rejects =
            t !== "n" ||
            typeof value !== "number" ||
            !Number.isFinite(value) ||
            !DECIMAL_PATTERN.test(String(value)) ||
            String(value).length > MAX_LENGTH;
          fc.pre(rejects);

          const cell: Cell = { t, v: value, w };
          expect(() => cellToDecimal(cell)).toThrow();
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

/**
 * Generate a clean decimal literal D: at most 15 significant digits, at most 6
 * fractional digits, no trailing zeros, no leading-zero integer part beyond a
 * single "0", and in the accepted magnitude band when non-zero. These are the
 * shapes a publisher's displayed price actually takes.
 */
function decimalLiteralArb(): fc.Arbitrary<string> {
  return fc
    .record({
      negative: fc.boolean(),
      intPart: fc.integer({ min: 0, max: 999_999_999 }),
      // 0 to 6 fractional digits.
      fracDigits: fc.integer({ min: 0, max: 6 }),
      fracValue: fc.integer({ min: 0, max: 999_999 }),
    })
    .map(({ negative, intPart, fracDigits, fracValue }) => {
      let s = String(intPart);
      if (fracDigits > 0) {
        // Build exactly fracDigits digits, then strip trailing zeros.
        let frac = String(fracValue % 10 ** fracDigits).padStart(fracDigits, "0");
        frac = frac.replace(/0+$/, "");
        if (frac !== "") {
          s = `${s}.${frac}`;
        }
      }
      // Avoid "-0"; a zero value stays unsigned.
      const isZero = !/[1-9]/.test(s);
      if (negative && !isZero) {
        s = `-${s}`;
      }
      return s;
    })
    .filter((s) => {
      // At most 15 significant digits.
      const digits = s.replace(/[-.]/g, "").replace(/^0+/, "");
      if (digits.length > 15) {
        return false;
      }
      // Must survive a Number() round trip to the same literal, otherwise D is
      // not a valid "clean" literal for the idempotence claim, and must be in
      // range (or exactly zero, which the rule handles via String(0) === "0").
      const n = Number(s);
      if (!Number.isFinite(n)) {
        return false;
      }
      if (n === 0) {
        return s === "0";
      }
      if (Math.abs(n) < MIN_ABS || Math.abs(n) >= MAX_ABS) {
        return false;
      }
      return String(n) === s;
    });
}

/**
 * Bump an IEEE-754 double by `steps` representable steps (ULPs). Positive steps
 * move away from zero in the direction of increasing magnitude when `base > 0`
 * and `steps > 0`; the exact direction does not matter to the property, only
 * that the result is a near neighbour of `base`.
 */
function bumpUlps(base: number, steps: number): number {
  const buf = new ArrayBuffer(8);
  const f = new Float64Array(buf);
  const i = new BigInt64Array(buf);
  f[0] = base;
  i[0] += BigInt(steps);
  return f[0];
}
