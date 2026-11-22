import type { ChangeDisplay, ChangeResult, Decimal } from "@/lib/figures";
import { formulaInput } from "@/lib/figures";

/** A comparable change, the only shape the formula can be built from. */
export type ComparableResult = Extract<ChangeResult, { comparable: true }>;

/**
 * A decimal as text with exactly `scale` fraction digits, trailing zeros kept.
 * `toDecimalString` would trim them, and a formula input keeps the stored
 * precision (3.000 stays 3.000). Pure string work, no binary conversion.
 */
function decimalWithScale(d: Decimal): string {
  const negative = d.int < 0n;
  let digits = (negative ? -d.int : d.int).toString();
  if (d.scale > 0) {
    digits = digits.padStart(d.scale + 1, "0");
    const cut = digits.length - d.scale;
    digits = `${digits.slice(0, cut)}.${digits.slice(cut)}`;
  }
  return negative ? `-${digits}` : digits;
}

/**
 * One formula input as text: the stored value from `formulaInput`, moved `k`
 * decimal places to the right (divided by 10^k). `k` is 0 for a unit shown as
 * published, and 3 for EUR per 1,000 litres shown per litre. The shift is an
 * exact decimal move, so no digit is rounded and the scale grows by `k`.
 */
export function formulaInputText(stored: string, k: number): string {
  const input = formulaInput(stored);
  return decimalWithScale({ int: input.int, scale: input.scale + k });
}

/**
 * The formula as a reader sees it, built from the inputs shown and the result
 * exactly as ChangeLine displays it (R5.4). For example
 * `(3.600 - 3.000) / 3.000 x 100 = +20.0%`. When the then value is zero there
 * is no percent, so the formula is the plain difference:
 * `3.600 - 0.000 = +3.60`. The formula identifier (CHANGE_FORMULA_ID) is not
 * printed; it lives in a data attribute.
 *
 * `result` is the sealed comparable change. Its two values are read through
 * `formulaInput` and shifted by `k`, so the inputs keep the stored precision.
 * `shown` supplies the signed difference and percent, so the formula ends with
 * the same text the change line prints.
 */
export function readableFormula(
  result: ComparableResult,
  shown: ChangeDisplay,
  k: number = 0,
): string {
  const thenValue = formulaInputText(result.then.value, k);
  const nowValue = formulaInputText(result.now.value, k);
  if (shown.percent === null) {
    return `${nowValue} - ${thenValue} = ${shown.difference}`;
  }
  return `(${nowValue} - ${thenValue}) / ${thenValue} x 100 = ${shown.percent}`;
}
