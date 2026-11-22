import type { FigureV1 } from "@/lib/seal-format";
import type { ChangeDisplay } from "@/lib/figures";
import { isFixtureFigure } from "@/lib/figures";
import { REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

/**
 * The then-vs-now change for one metric, shown as a single neutral line:
 * `{direction} {difference} · {percent} · {then period} to {now period}`.
 * The difference and percent are the unsigned magnitudes from `formatChange`
 * (Property 3). The direction word carries the rise or fall, so the line
 * needs no sign.
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
};

export function ChangeLine({ changeText, then, now }: ChangeLineProps) {
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
        <span>{changeText.direction}</span>{" "}
        <span>{changeText.differenceMagnitude}</span>
        {changeText.percentMagnitude === null ? null : (
          <>
            {REVEAL_COPY.changeSeparator}
            <span>{changeText.percentMagnitude}</span>
          </>
        )}
        {REVEAL_COPY.changeSeparator}
        <span className={styles.period}>{changeText.thenPeriod}</span>
        {REVEAL_COPY.periodRange}
        <span className={styles.period}>{changeText.nowPeriod}</span>
      </p>
    </div>
  );
}
