// Property tests for the change calculator and display formatting
// (spec 03-persona-demo, design.md; R11.8–R11.10, R12.*, R15.3).
//
// These use fast-check (already a project dependency) to assert invariants that
// must hold across a wide space of decimal values and figure pairs, rather than
// a handful of worked examples. Every oracle here is itself exact BigInt work
// from decimal.ts, so the test never measures the implementation against a
// binary-float approximation.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import type { FigureV1 } from "@/lib/seal-format";

import { CHANGE_FORMULA_ID, computeChange } from "./change";
import {
  add,
  isZero,
  parseDecimal,
  sub,
  toDecimalString,
} from "./decimal";
import { formatChange, formatValue } from "./format-change";

// A canonical-ish decimal string up to 40 chars, scales 0..12, covering zero
// and very large / very small magnitudes. The string always matches the
// value pattern ^-?[0-9]+(\.[0-9]+)?$ that parseDecimal accepts.
const valueArb: fc.Arbitrary<string> = fc
  .record({
    negative: fc.boolean(),
    // Up to ~26 integer digits gives very large magnitudes while staying well
    // under the 40-char cap once combined with a fractional part.
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
    // Build a fractional part exactly `scale` digits long so very small
    // magnitudes (0.000000000001) and ragged fractions both occur.
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

// A canonical official figure with every provenance field, varying only value
// and period so comparability holds. `then`/`now` periods are kept distinct and
// ordered by the caller.
function official(overrides: Partial<FigureV1> = {}): FigureV1 {
  return {
    kind: "official",
    metric_id: "us-gasoline",
    value: "2.00",
    unit: "USD per gallon",
    region: "U.S. city average",
    period: "2024-09",
    source: "U.S. EIA",
    series_id: "EMM_EPMR_PTE_NUS_DPG",
    retrieved_at: "2026-10-30T14:02:11Z",
    source_url: "https://www.eia.gov/series",
    ...overrides,
  } as FigureV1;
}

// Count significant digits in a canonical decimal string (leading zeros and the
// sign and point ignored). Used to assert the percent precision budget.
function significantDigits(value: string): number {
  const digits = value.replace("-", "").replace(".", "");
  const trimmed = digits.replace(/^0+/, "");
  return trimmed.length === 0 ? 0 : trimmed.length;
}

describe("computeChange — exactness and no mutation (R12.1,4,5,6,7,10)", () => {
  it("property 1: difference is the exact now − then and inputs are untouched", () => {
    fc.assert(
      fc.property(valueArb, valueArb, (thenV, nowV) => {
        const then = official({ value: thenV, period: "2024-09" });
        const now = official({ value: nowV, period: "2026-09" });
        const thenBefore = structuredClone(then);
        const nowBefore = structuredClone(now);

        const result = computeChange(then, now);

        expect(result.comparable).toBe(true);
        if (!result.comparable) return;
        expect(result.formula).toBe(CHANGE_FORMULA_ID);

        // Oracle: exact BigInt now − then, canonicalised.
        const expectedDiff = toDecimalString(
          sub(parseDecimal(nowV), parseDecimal(thenV)),
        );
        expect(result.difference).toBe(expectedDiff);

        // then/now strings are copied verbatim.
        expect(result.then.value).toBe(thenV);
        expect(result.now.value).toBe(nowV);

        // Inputs are never mutated.
        expect(then).toEqual(thenBefore);
        expect(now).toEqual(nowBefore);
      }),
      { numRuns: 300 },
    );
  });
});

describe("computeChange — symmetry and trailing zeros (R12.7)", () => {
  it("property 2: a rise and its mirror-image fall differ only in sign", () => {
    fc.assert(
      fc.property(valueArb, valueArb, (thenV, nowV) => {
        const rise = computeChange(
          official({ value: thenV, period: "2024-09" }),
          official({ value: nowV, period: "2026-09" }),
        );
        const fall = computeChange(
          official({ value: nowV, period: "2024-09" }),
          official({ value: thenV, period: "2026-09" }),
        );
        if (!rise.comparable || !fall.comparable) return;

        // difference(then→now) === −difference(now→then), checked exactly by
        // adding them: they must sum to canonical "0".
        const sum = toDecimalString(
          add(parseDecimal(rise.difference), parseDecimal(fall.difference)),
        );
        expect(sum).toBe("0");
      }),
      { numRuns: 300 },
    );
  });

  it("property 2b: equal-base rise/fall percents are exact negatives", () => {
    fc.assert(
      fc.property(valueArb, valueArb, (baseV, deltaV) => {
        const base = parseDecimal(baseV);
        if (isZero(base)) return; // percent undefined when then is zero.
        const up = toDecimalString(add(base, parseDecimal(deltaV)));
        const down = toDecimalString(sub(base, parseDecimal(deltaV)));

        const rise = computeChange(
          official({ value: baseV, period: "2024-09" }),
          official({ value: up, period: "2026-09" }),
        );
        const fall = computeChange(
          official({ value: baseV, period: "2024-09" }),
          official({ value: down, period: "2026-09" }),
        );
        if (!rise.comparable || !fall.comparable) return;
        if (rise.percent === null || fall.percent === null) return;

        const sum = toDecimalString(
          add(parseDecimal(rise.percent.value), parseDecimal(fall.percent.value)),
        );
        expect(sum).toBe("0");
      }),
      { numRuns: 300 },
    );
  });

  it("property 3: appending trailing fractional zeros changes nothing", () => {
    fc.assert(
      fc.property(
        valueArb,
        valueArb,
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 1, max: 6 }),
        (thenV, nowV, zt, zn) => {
          const pad = (v: string, z: number) =>
            v.includes(".") ? v + "0".repeat(z) : `${v}.${"0".repeat(z)}`;

          const base = computeChange(
            official({ value: thenV, period: "2024-09" }),
            official({ value: nowV, period: "2026-09" }),
          );
          const padded = computeChange(
            official({ value: pad(thenV, zt), period: "2024-09" }),
            official({ value: pad(nowV, zn), period: "2026-09" }),
          );
          if (!base.comparable || !padded.comparable) return;

          expect(padded.difference).toBe(base.difference);
          expect(padded.percent).toEqual(base.percent);
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe("computeChange — percent precision (R12.5)", () => {
  it("property 4: a non-null percent carries at least 10 significant digits or is exact", () => {
    fc.assert(
      fc.property(valueArb, valueArb, (thenV, nowV) => {
        const result = computeChange(
          official({ value: thenV, period: "2024-09" }),
          official({ value: nowV, period: "2026-09" }),
        );
        if (!result.comparable || result.percent === null) return;

        // A terminating ratio (exact) may legitimately have fewer digits
        // (e.g. "150"); a non-terminating one is carried to 20 significant
        // digits, so it must hold at least 10.
        if (!result.percent.exact) {
          expect(significantDigits(result.percent.value)).toBeGreaterThanOrEqual(10);
        }
      }),
      { numRuns: 300 },
    );
  });
});

describe("computeChange — comparability priority (R12.2,3,8,11)", () => {
  it("property 5: non-comparable pairs report the first failing field in order", () => {
    const order = [
      "kind",
      "source",
      "series_id",
      "unit",
      "region",
    ] as const;

    fc.assert(
      fc.property(
        // Which of the ordered fields mismatch (true = differ on the "now" side).
        fc.record({
          kind: fc.boolean(),
          source: fc.boolean(),
          series_id: fc.boolean(),
          unit: fc.boolean(),
          region: fc.boolean(),
        }),
        (mismatch) => {
          const nowOverrides: Partial<FigureV1> = { period: "2026-09" };
          if (mismatch.kind) {
            // A self-reported now figure differs on kind.
            (nowOverrides as Record<string, unknown>).kind = "self-reported";
            (nowOverrides as Record<string, unknown>).source = "self-reported";
          }
          if (mismatch.source) nowOverrides.source = "other-source";
          if (mismatch.series_id) nowOverrides.series_id = "other-series";
          if (mismatch.unit) nowOverrides.unit = "other-unit";
          if (mismatch.region) nowOverrides.region = "other-region";

          const result = computeChange(official(), official(nowOverrides));

          // The expected reason is the first field (in priority order) that
          // mismatches; if none do, the pair is comparable.
          const firstBroken = order.find((f) => mismatch[f]);
          if (firstBroken === undefined) {
            expect(result.comparable).toBe(true);
          } else {
            expect(result.comparable).toBe(false);
            if (result.comparable) return;
            expect(result.reason).toBe(firstBroken);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe("formatChange — direction only via sign or words (R11.8,R12.9,R15.3)", () => {
  // The only direction signals allowed in the displayed change are the numeric
  // sign ("+", U+2212) and the three direction words.
  const DIRECTION_WORDS = new Set(["rose", "fell", "unchanged"]);
  const PLUS = "+";
  const MINUS = "\u2212";

  it("property 6: direction matches the exact sign and uses only approved words", () => {
    fc.assert(
      fc.property(valueArb, valueArb, (thenV, nowV) => {
        const result = computeChange(
          official({ value: thenV, period: "2024-09" }),
          official({ value: nowV, period: "2026-09" }),
        );
        if (!result.comparable) return;

        const display = formatChange(result, "U.S.");

        // Direction word is one of exactly three.
        expect(DIRECTION_WORDS.has(display.direction)).toBe(true);

        // The exact difference sign drives the direction and the text prefix.
        const diff = parseDecimal(result.difference);
        if (isZero(diff)) {
          expect(display.direction).toBe("unchanged");
          expect(display.difference.startsWith(PLUS)).toBe(false);
          expect(display.difference.startsWith(MINUS)).toBe(false);
        } else if (result.difference.charCodeAt(0) === 0x2d) {
          expect(display.direction).toBe("fell");
          expect(display.difference.startsWith(MINUS)).toBe(true);
        } else {
          expect(display.direction).toBe("rose");
          expect(display.difference.startsWith(PLUS)).toBe(true);
        }

        // No hyphen-minus leaks into the display: the only minus is U+2212.
        expect(display.difference.includes("-")).toBe(false);
        if (display.percent !== null) {
          expect(display.percent.includes("-")).toBe(false);
        }
      }),
      { numRuns: 300 },
    );
  });
});

describe("formatValue — display rounding equals exact decimal rounding (R11.9,R11.10)", () => {
  it("property 7: formatValue at N digits rounds half-away-from-zero like the exact value", () => {
    fc.assert(
      fc.property(
        valueArb,
        fc.integer({ min: 0, max: 6 }),
        (value, digits) => {
          // Oracle: round the exact decimal to `digits` places, half away from
          // zero, using only BigInt string work, then format THAT exact value
          // at its own precision. It must equal formatValue(value, digits).
          const rounded = roundHalfAwayFromZero(value, digits);
          const viaExact = formatValue(rounded, "U.S.", digits);
          const viaFormat = formatValue(value, "U.S.", digits);
          expect(viaFormat).toBe(viaExact);
        },
      ),
      { numRuns: 300 },
    );
  });
});

// Round a canonical decimal string to `digits` fractional places, half away
// from zero, using exact BigInt arithmetic (the same rounding mode as
// Intl's "halfExpand"). Returns a canonical decimal string.
function roundHalfAwayFromZero(value: string, digits: number): string {
  const d = parseDecimal(value);
  if (d.scale <= digits) {
    return toDecimalString(d);
  }
  const drop = d.scale - digits;
  const magnitude = d.int < 0n ? -d.int : d.int;
  const negative = d.int < 0n;
  let factor = 1n;
  for (let i = 0; i < drop; i += 1) factor *= 10n;
  const quotient = magnitude / factor;
  const remainder = magnitude - quotient * factor;
  // Half away from zero: round up when 2*remainder >= factor.
  const roundedUp = remainder * 2n >= factor ? quotient + 1n : quotient;
  const signed = negative ? -roundedUp : roundedUp;
  return toDecimalString({ int: signed, scale: digits });
}
