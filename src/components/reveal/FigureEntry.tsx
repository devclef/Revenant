import type { FigureV1 } from "@/lib/seal-format";
import type { ChangeResult, DisplayRescale } from "@/lib/figures";
import { rescaleForDisplay } from "@/lib/figures";
import { MotionProvider } from "@/components/ceremony/motion";
import { NumberLine } from "@/components/ceremony/figures/NumberLine";
import figureStyles from "@/components/ceremony/figures/figures.module.css";
import { Stamp } from "@/components/ceremony/figures/Stamp";
import { ChangeLine } from "./ChangeLine";
import { REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

/**
 * One comparable entry of stage 3, drawn as the then-and-now figure pair
 * (design.md "Number_Line geometry", "Stamps and counter", R9.1, R10.6, R12.1).
 *
 * It renders, top to bottom:
 *
 * - the then {@link Stamp}, which frames the then {@link FigureLine} unchanged;
 * - a {@link NumberLine} with the Mark, when the judge gave an answer;
 * - the now {@link Stamp}, which frames the now {@link FigureLine} unchanged;
 * - the single neutral {@link ChangeLine}.
 *
 * The Number_Line's range comes from the then and now values only, so the Mark
 * never moves a stamp (R12.2). When `markValue` is `undefined` (no answer), no
 * Mark element is drawn (R12.1). The Mark goes through the same display rescale
 * as the figures, so it sits at the same place on the axis as the values it is
 * compared with. Its typed text is an exact rescale, shown in the display unit.
 *
 * The component reads no clock and holds no state. It wraps its Stamps in
 * `MotionProvider`, which defers to a parent provider when there is one, so the
 * Calm control on the page still governs every entry.
 *
 * Every string comes from copy.ts (R15.1). This component logs nothing and
 * touches no storage.
 */

export type FigureEntryProps = {
  /** The sealed then figure. */
  then: Readonly<FigureV1>;
  /** The now figure, from the same series and comparable with `then`. */
  now: Readonly<FigureV1>;
  /** The comparable change between `then` and `now`. */
  change: Extract<ChangeResult, { comparable: true }>;
  /** The series' display rescale, when one applies (display-only). */
  rescale?: Readonly<DisplayRescale>;
  /**
   * The judge's answer for this metric, as the decimal string they typed, or
   * `undefined` for "No answer" (or no answer to this metric at all).
   */
  markValue?: string;
};

export function FigureEntry({ then, now, change, rescale, markValue }: FigureEntryProps) {
  // The drawing values use the same rescale as the stamps. Only positions and
  // the Mark's hidden text come from these; no displayed number is computed
  // from a position (R12.4).
  const toDisplay = (value: string): string =>
    rescale === undefined ? value : rescaleForDisplay(value, rescale.divisor);

  const unit = rescale === undefined ? then.unit : rescale.unit;
  const markForLine = markValue === undefined ? undefined : toDisplay(markValue);

  return (
    <MotionProvider>
      <div className={figureStyles.paperPanel}>
        <p className={styles.then}>{REVEAL_COPY.then}</p>
        <Stamp figure={then} role="then" displayRescale={rescale} />

        <NumberLine
          thenValue={toDisplay(then.value)}
          nowValue={toDisplay(now.value)}
          markValue={markForLine}
          unit={unit}
        />

        <p className={styles.now}>{REVEAL_COPY.now}</p>
        <Stamp figure={now} role="now" displayRescale={rescale} />

        <ChangeLine result={change} region={then.region} then={then} now={now} />
      </div>
    </MotionProvider>
  );
}
