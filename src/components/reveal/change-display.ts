import type { ChangeResult, DisplayRescale } from "@/lib/figures";
import { rescaleForDisplay } from "@/lib/figures";
import { parseDecimal, sub, toDecimalString } from "@/lib/figures/decimal";
import { REVEAL_COPY } from "./copy";

/**
 * The display inputs for a then-vs-now change shown in a rescaled unit (C8.4).
 *
 * `then` and `now` are the sealed values converted for display (exact, power of
 * ten), with trailing fraction zeros removed. `note` is the rescale note that
 * the change line shows. The stored values are never changed.
 */
export type ChangeDisplayInputs = {
  then: string;
  now: string;
  note: string;
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
 * The rescaled then and now values and the rescale note for one change, built
 * from the sealed value strings and the series' display rescale (C8.4).
 */
export function rescaledChangeInputs(
  thenValue: string,
  nowValue: string,
  rescale: Readonly<DisplayRescale>,
  sealedUnit: string,
): ChangeDisplayInputs {
  return {
    then: trimFraction(rescaleForDisplay(thenValue, rescale.divisor)),
    now: trimFraction(rescaleForDisplay(nowValue, rescale.divisor)),
    note: REVEAL_COPY.rescaledNote
      .replace("{toUnit}", rescale.unit)
      .replace("{fromUnit}", sealedUnit),
  };
}
