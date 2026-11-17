import type { ChangeResult } from "@/lib/figures";

/** A comparable change, the only shape the formula can be built from. */
export type ComparableResult = Extract<ChangeResult, { comparable: true }>;

/**
 * The formula as a reader sees it, built from the inputs shown: for example
 * `(3.600 - 3.000) / 3.000 x 100`. When the then value is zero there is no
 * percent, so the formula is the plain difference. The formula identifier
 * (CHANGE_FORMULA_ID) is not printed; it lives in a data attribute.
 */
export function readableFormula(result: ComparableResult): string {
  const thenValue = result.then.value;
  const nowValue = result.now.value;
  if (result.percent === null) {
    return `${nowValue} - ${thenValue}`;
  }
  return `(${nowValue} - ${thenValue}) / ${thenValue} x 100`;
}
