// Formula input for derived values (spec 03-persona-demo, design.md).
//
// A derived value such as the then-vs-now change reads its inputs from here.
// The input keeps the stored value at full published precision: it is never
// rounded, so a formula sees exactly what the source published. Rounding is
// done only at display time, by roundDecimal.
//
// Pure module: imports only the exact decimal module.

import { parseDecimal, type Decimal } from "./decimal";

/**
 * The stored figure value as an exact {@link Decimal}. The scale equals the
 * number of fractional digits in `stored`, so "3.10" keeps scale 2.
 *
 * Throws {@link RangeError} when `stored` is not a decimal value string.
 */
export function formulaInput(stored: string): Decimal {
  return parseDecimal(stored);
}
