// Display-only rescale for figure values (spec 03-persona-demo, design.md R11.10).
//
// A catalogue series may carry a `display_rescale` with an exact power-of-ten
// divisor (for example, EU Oil Bulletin prices published per 1,000 litres shown
// per litre). `rescaleForDisplay(value, divisor)` divides the value by that
// power of ten by shifting the decimal point left. It is exact — pure
// string/BigInt digit manipulation, no rounding — and the stored value is never
// changed; this is for display only.
//
// There is no Number(), parseFloat, parseInt or unary + on any value anywhere
// in this module (a source-scan test enforces that across the figures code).
// It imports nothing from src/lib/crypto, src/lib/db or Node built-ins, and
// adds no dependency.

import { parseDecimal, toDecimalString, type Decimal } from "./decimal";

// Allowed divisors, matching DisplayRescale in 02-demo-figures/design.md:
// each an exact power of ten from 10 to 1,000,000.
const MIN_POWER = 1; // 10^1
const MAX_POWER = 6; // 10^6

/**
 * The base-ten exponent `k` such that `divisor === 10 ** k`, or `null` when
 * `divisor` is not an exact power of ten in the allowed 10..1_000_000 range.
 *
 * `divisor` is an integer here, so this is checked with integer arithmetic
 * only — no floating-point `Math.log10`.
 */
function powerOfTen(divisor: number): number | null {
  if (!Number.isInteger(divisor)) {
    return null;
  }
  let remaining = divisor;
  let power = 0;
  while (remaining > 1 && remaining % 10 === 0) {
    remaining = remaining / 10;
    power += 1;
  }
  if (remaining !== 1) {
    return null;
  }
  if (power < MIN_POWER || power > MAX_POWER) {
    return null;
  }
  return power;
}

/**
 * Divide the decimal value string `value` by `divisor` (an exact power of ten
 * in 10..1_000_000) by shifting the decimal point left, exactly and with no
 * rounding. Returns the canonical decimal string of the result.
 *
 * Throws {@link RangeError} when `divisor` is not an exact power of ten in the
 * allowed range, or when `value` is not a canonical decimal string.
 */
export function rescaleForDisplay(value: string, divisor: number): string {
  const power = powerOfTen(divisor);
  if (power === null) {
    throw new RangeError(
      `rescaleForDisplay: divisor must be an exact power of ten in 10..1000000, got ${JSON.stringify(
        divisor,
      )}`,
    );
  }

  // Dividing by 10^power is exactly increasing the scale by `power`: the same
  // integer digits, with the decimal point moved `power` places to the left.
  const d = parseDecimal(value);
  const shifted: Decimal = { int: d.int, scale: d.scale + power };
  return toDecimalString(shifted);
}
