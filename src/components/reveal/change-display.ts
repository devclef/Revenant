import type { ChangeResult, DisplayRescale } from "@/lib/figures";
import { rescaleForDisplay } from "@/lib/figures";
import { parseDecimal, sub, toDecimalString } from "@/lib/figures/decimal";
import { REVEAL_COPY } from "./copy";

/**
 * The display inputs for a then-vs-now change shown in a rescaled unit (C8.4).
 *
 * `then` and `now` are the sealed values converted for display (exact, power of
 * ten), with trailing fraction zeros removed. The rescale note is not part of
 * these inputs: ReceiptCard prints it once per card. The stored values are never
 * changed.
 */
export type ChangeDisplayInputs = {
  then: string;
  now: string;
};

// Remove trailing zeros after the decimal point, and the point itself when no
// digits remain. Display only: the value is the same number.
function trimFraction(value: string): string {
  if (!value.includes(".")) return value;
  return value.replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * The comparable change with the display inputs in place of the sealed values
 * (C8.4). The difference is the exact now − then of the display values. The
 * percent is unchanged, because a power-of-ten rescale leaves the ratio the same.
 * The sealed result is not modified.
 */
export function displayChangeResult(
  result: Extract<ChangeResult, { comparable: true }>,
  inputs: ChangeDisplayInputs,
): Extract<ChangeResult, { comparable: true }> {
  const difference = toDecimalString(
    sub(parseDecimal(inputs.now), parseDecimal(inputs.then)),
  );
  return {
    ...result,
    then: { ...result.then, value: inputs.then },
    now: { ...result.now, value: inputs.now },
    difference,
  };
}

/**
 * The rescale note for a figure shown in `displayedUnit` while it was sealed in
 * `storedUnit` (R11.10). Built from the two unit strings only. Undefined when
 * the units match, so no note is drawn for a figure shown as sealed.
 */
export function rescaleNoteText(
  storedUnit: string,
  displayedUnit: string,
): string | undefined {
  if (storedUnit === displayedUnit) return undefined;
  return REVEAL_COPY.rescaledNote
    .replace("{toUnit}", displayedUnit)
    .replace("{fromUnit}", storedUnit);
}

/**
 * The rescaled then and now values for one change, built from the sealed value
 * strings and the series' display rescale (C8.4). The rescale note is built by
 * {@link rescaleNoteText} and printed once per card by ReceiptCard.
 */
export function rescaledChangeInputs(
  thenValue: string,
  nowValue: string,
  rescale: Readonly<DisplayRescale>,
): ChangeDisplayInputs {
  return {
    then: trimFraction(rescaleForDisplay(thenValue, rescale.divisor)),
    now: trimFraction(rescaleForDisplay(nowValue, rescale.divisor)),
  };
}
