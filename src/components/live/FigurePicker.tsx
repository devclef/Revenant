import Link from "next/link";

import { REVEAL_COPY } from "@/components/reveal/copy";
import { formatLetterDate } from "@/components/ui/letter-date";

import type { PickableSeries } from "./catalogue-list";
import { LIVE_COPY } from "./copy";
import { pickerHint } from "./figure-hint";
import { figureLimit } from "./form";
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
 * A Fallback_Figure shows its own period and the retrieved date with the
 * Fallback_Note (spec 09, A1.8). With no series to offer, the picker shows the
 * none message and links to the demo, and states no range (A4.1, A4.2).
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
  const limit = figureLimit(series.length);
  const hint = pickerHint(limit);

  if (hint.key === "none") {
    const [before = "", after = ""] =
      LIVE_COPY.figuresNoneAvailable.split("{link}");
    return (
      <fieldset className={styles.figures} data-card="live-figures">
        <legend className={styles.legend}>{LIVE_COPY.figuresLegend}</legend>
        <p className={styles.hint}>
          {before}
          <Link href="/demo" className={styles.lockNoteLink}>
            {LIVE_COPY.figuresNoneLink}
          </Link>
          {after}
        </p>
      </fieldset>
    );
  }

  const hintText =
    hint.key === "one"
      ? LIVE_COPY.figuresHintOne
      : LIVE_COPY.figuresHint.replace("{max}", String(hint.max));
  const tooManyText =
    hint.key === "one"
      ? LIVE_COPY.figuresTooManyOne
      : LIVE_COPY.figuresTooMany.replace("{max}", String(hint.max));

  return (
    <fieldset className={styles.figures} data-card="live-figures">
      <legend className={styles.legend}>{LIVE_COPY.figuresLegend}</legend>
      <p className={styles.hint}>{hintText}</p>
      <ul className={styles.figureList}>
        {series.map((item) => {
          const checked = selected.includes(item.metricId);
          const disabled = !checked && atLimit;
          const inputId = `figure-${item.metricId}`;
          const isFallback = item.fallbackRetrievedAt !== undefined;
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
                  {(isFallback
                    ? LIVE_COPY.figurePeriod
                    : LIVE_COPY.figureLatest
                  ).replace("{period}", item.latestPeriod)}
                </span>
                {isFallback ? (
                  <span className={styles.figureMeta}>
                    {REVEAL_COPY.fallbackNote.replace(
                      "{date}",
                      formatLetterDate(item.fallbackRetrievedAt ?? "", {
                        kind: "utc",
                      }),
                    )}
                  </span>
                ) : null}
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
      {atLimit ? <p className={styles.hint}>{tooManyText}</p> : null}
    </fieldset>
  );
}
