import type { FigureV1 } from "@/lib/seal-format";
import type { ChangeDisplay } from "@/lib/figures";
import { isFixtureFigure } from "@/lib/figures";
import { REVEAL_COPY } from "./copy";
import type { ChangeDisplayInputs } from "./change-display";
import styles from "./reveal.module.css";

/**
 * The then-vs-now change for one metric, shown as a single neutral line
 * (R12.9, neutrality.md). It renders the direction word, the signed difference,
 * the percent (when defined) and the then and now periods, all from the
 * {@link ChangeDisplay} that FigureEntry built with `formatChange`.
 *
 * The formula is not drawn here. FormulaLine draws it outside the Source
 * details, so it stays visible while the details are closed (R4.2).
 *
 * The direction word comes only from `formatChange`'s
 * {@link ChangeDisplay.direction} (rose / fell / unchanged), never from
 * copy.ts (R12.9). A rise and a fall share the exact same elements and classes:
 * there is no colour change, so direction is never encoded in the styling
 * (neutrality.md).
 *
 * When either input figure is a fixture (source or series_id starting with
 * FIXTURE), the "fixture data" label is shown on the change line too (R13.4,
 * data-integrity.md). The two inputs are passed so this component can decide
 * that itself.
 *
 * Every string comes from copy.ts (R15.1). This component holds no state, reads
 * no clock, logs nothing and touches no storage.
 */

export type ChangeLineProps = {
  /** The change as `formatChange` displays it (R5.4). */
  changeText: ChangeDisplay;
  /** The sealed "then" figure, used only to detect fixture inputs. */
  then: Readonly<FigureV1>;
  /** The sealed "now" figure, used only to detect fixture inputs. */
  now: Readonly<FigureV1>;
  /**
   * The rescale note (C8.4), when the unit is shown in a display rescale.
   * Absent when no rescale applies.
   */
  display?: ChangeDisplayInputs;
};

export function ChangeLine({ changeText, then, now, display }: ChangeLineProps) {
  const fixture = isFixtureFigure(then) || isFixtureFigure(now);

  // The percent is shown only when formatChange produced one (the then value
  // was non-zero). The periods are always shown so the reader sees which two
  // periods the change spans (data-integrity.md).
  return (
    // data-change marks the change line so the stage 3 Steps can fade it in
    // from the plan (FiguresFadeUp, figures.module.css).
    <div className={styles.change} data-change="">
      <p>
        {fixture ? (
          <>
            <span className={styles.fixtureLabel}>
              {REVEAL_COPY.labelFixtureData}
            </span>{" "}
          </>
        ) : null}
        <span>{changeText.direction}</span> <span>{changeText.difference}</span>
        {changeText.percent === null ? null : <span> {changeText.percent}</span>}{" "}
        <span className={styles.period}>{changeText.thenPeriod}</span>
        {REVEAL_COPY.periodRange}
        <span className={styles.period}>{changeText.nowPeriod}</span>
      </p>
      {display === undefined ? null : <p className={styles.period}>{display.note}</p>}
    </div>
  );
}
