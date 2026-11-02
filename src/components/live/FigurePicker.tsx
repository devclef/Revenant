import type { PickableSeries } from "./catalogue-list";
import { LIVE_COPY } from "./copy";
import styles from "./live.module.css";

export interface FigurePickerProps {
  /** The series to offer, already in catalogue order (see listPickableSeries). */
  series: readonly PickableSeries[];
  /** Metric ids the visitor has chosen. */
  selected: readonly string[];
  /** True when the visitor has chosen the most figures allowed. */
  atLimit: boolean;
  onToggle: (metricId: string) => void;
}

/**
 * Lists the figures a visitor can seal with: name, unit, region and the latest
 * period. Fixture series carry the "fixture data" label. No value is shown,
 * because a figure is only read at reveal (R13.1, R13.7).
 *
 * Controlled component: the parent owns the selection. Unchecked boxes are
 * disabled once the limit is reached, so the picker never holds more than the
 * allowed number of figures.
 */
export function FigurePicker({
  series,
  selected,
  atLimit,
  onToggle,
}: FigurePickerProps) {
  return (
    <fieldset className={styles.figures}>
      <legend className={styles.legend}>{LIVE_COPY.figuresLegend}</legend>
      <p className={styles.hint}>{LIVE_COPY.figuresHint}</p>
      <ul className={styles.figureList}>
        {series.map((item) => {
          const checked = selected.includes(item.metricId);
          const disabled = !checked && atLimit;
          const inputId = `figure-${item.metricId}`;
          return (
            <li key={item.metricId} className={styles.figureItem}>
              <label htmlFor={inputId} className={styles.figureLabel}>
                <input
                  id={inputId}
                  type="checkbox"
                  className={styles.checkbox}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onToggle(item.metricId)}
                />
                <span className={styles.figureName}>{item.displayName}</span>
                <span className={styles.figureMeta}>
                  {item.unit} · {item.region}
                </span>
                <span className={styles.figureMeta}>
                  {LIVE_COPY.figureLatest.replace(
                    "{period}",
                    item.latestPeriod,
                  )}
                </span>
                {item.isFixture ? (
                  <span className={styles.fixture}>
                    {LIVE_COPY.fixtureLabel}
                  </span>
                ) : null}
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
