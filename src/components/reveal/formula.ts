import type { ChangeDisplay, ChangeResult } from "@/lib/figures";

/** A comparable change, the only shape the formula can be built from. */
export type ComparableResult = Extract<ChangeResult, { comparable: true }>;

/**
 * The formula as a reader sees it, built from the inputs shown and the result
 * exactly as ChangeLine displays it (R5.4). For example
 * `(3.600 - 3.000) / 3.000 x 100 = +20.0%`. When the then value is zero there
 * is no percent, so the formula is the plain difference:
 * `3.600 - 0.000 = +3.60`. The formula identifier (CHANGE_FORMULA_ID) is not
 * printed; it lives in a data attribute.
 *
 * `result` supplies the inputs at full precision after any display rescale.
 * `shown` supplies the difference and percent strings, so the formula ends with
 * the same text the change line prints.
 */
export function readableFormula(
  result: ComparableResult,
  shown: ChangeDisplay,
): string {
  const thenValue = result.then.value;
  const nowValue = result.now.value;
  if (shown.percent === null) {
    return `${nowValue} - ${thenValue} = ${shown.difference}`;
  }
  return `(${nowValue} - ${thenValue}) / ${thenValue} x 100 = ${shown.percent}`;
}
