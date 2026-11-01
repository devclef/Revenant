import type { FigureV1 } from "@/lib/seal-format";
import type { ChangeResult } from "@/lib/figures";
import {
  CHANGE_FORMULA_ID,
  formatChange,
  isFixtureFigure,
} from "@/lib/figures";
import { REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

/**
 * The then-vs-now change for one metric, shown as a single neutral line
 * (R12.9, neutrality.md). Given a comparable {@link ChangeResult} and the
 * figure's region, it renders `formatChange`'s display: the direction word, the
 * signed difference, the percent (when defined) and the then and now periods.
 * The formula line follows, built from copy.ts and {@link CHANGE_FORMULA_ID},
 * so the formula shown is the one the calculation used.
 *
 * The direction word comes only from `formatChange`'s
 * {@link ChangeDisplay.direction} (rose / fell / unchanged), never from
 * copy.ts — the copy module holds no direction words (R12.9). A rise and a fall
 * share the exact same elements and classes: there is no `.rose` / `.fell`
 * variant and no colour change, so direction is never encoded in the styling
 * (neutrality.md).
 *
 * When either input figure is a fixture (source or series_id starting with
 * FIXTURE), the "fixture data" label is shown on the change line too (R13.4,
 * data-integrity.md). The two inputs are passed so this component can decide
 * that itself; the `ChangeResult` carries only value and period strings.
 *
 * Every string comes from copy.ts (R15.1). This component holds no state, reads
 * no clock, logs nothing and touches no storage.
 */

export type ChangeLineProps = {
  /** The comparable change to show. */
  result: Extract<ChangeResult, { comparable: true }>;
  /** The region the figures cover, used for locale-aware formatting. */
  region: string;
  /** The sealed "then" figure, used only to detect fixture inputs. */
  then: Readonly<FigureV1>;
  /** The sealed "now" figure, used only to detect fixture inputs. */
  now: Readonly<FigureV1>;
};

export function ChangeLine({ result, region, then, now }: ChangeLineProps) {
  const display = formatChange(result, region);
  const fixture = isFixtureFigure(then) || isFixtureFigure(now);

  // The percent is shown only when formatChange produced one (the then value
  // was non-zero). The periods are always shown so the reader sees which two
  // periods the change spans (data-integrity.md).
  return (
    <div className={styles.change}>
      <p>
        {fixture ? (
          <>
            <span className={styles.fixtureLabel}>
              {REVEAL_COPY.labelFixtureData}
            </span>{" "}
          </>
        ) : null}
        <span>{display.direction}</span> <span>{display.difference}</span>
        {display.percent === null ? null : <span> {display.percent}</span>}{" "}
        <span className={styles.period}>{display.thenPeriod}</span>
        {REVEAL_COPY.periodRange}
        <span className={styles.period}>{display.nowPeriod}</span>
      </p>
      <p className={styles.formula}>
        {REVEAL_COPY.formulaLabel}: {CHANGE_FORMULA_ID}
      </p>
    </div>
  );
}
