import Link from "next/link";

import { displayFigureValue } from "@/components/reveal/display-figure";
import { REVEAL_COPY } from "@/components/reveal/copy";
import { formatShortDate } from "@/components/ui/letter-date";

import {
  groupPickable,
  regionGroupFor,
  type PickableSeries,
  type RegionGroup,
} from "./catalogue-list";
import { LIVE_COPY, REAL_COPY } from "./copy";
import { pickerHint } from "./figure-hint";
import { figureLimit, type WriteMode } from "./form";
import styles from "./live.module.css";

/**
 * The value and source of one figure, as the Figures_API published it. The
 * value is the string from the response, shown at full published precision.
 * Nothing here is rounded, converted or estimated.
 */
export interface FigureDetail {
  /** The value exactly as published. */
  value: string;
  /** Publisher name, as the figure's source field gives it. */
  sourceName: string;
  /** The series identifier at the publisher. */
  seriesId: string;
  /** Link a visitor can follow to check the figure. */
  sourceUrl: string;
  /** When Revenant fetched the figure (UTC). */
  retrievedAt: string;
  /** The period the value describes, as the figure gives it. */
  period: string;
  /** Unit and currency, as the figure gives it. */
  unit: string;
  /** Geographic scope, as the figure gives it. */
  region: string;
}

export interface FigurePickerProps {
  /** The series to offer, already in catalogue order (see listPickableSeries). */
  series: readonly PickableSeries[];
  /** Metric ids the visitor has chosen. */
  selected: readonly string[];
  /** True when the visitor has chosen the most figures allowed. */
  atLimit: boolean;
  onToggle: (metricId: string) => void;
  /**
   * Value and source per metric id. A series with no entry shows its name,
   * unit, region and period only; no value is invented for it.
   */
  details?: ReadonlyMap<string, FigureDetail>;
  /** `real` (`/seal`) shows the hint that a question allows no figure. */
  mode?: WriteMode;
}

/** The heading of each region group, from the copy file. */
const GROUP_HEADING: Record<RegionGroup, string> = {
  us: LIVE_COPY.regionUs,
  eu: LIVE_COPY.regionEu,
};

/**
 * Lists the figures a visitor can seal with: name, value, unit, region, the
 * period and the source name. The source details (series ID, source link and
 * retrieved date) sit behind a details control. Fixture series carry the
 * "fixture data" label. Items keep catalogue order and are never sorted or
 * styled by value or direction (R13.7).
 *
 * Figures sit under a fieldset per region (United States, then European
 * Union). A figure with no region heading stays in a plain list below them, so
 * no figure is ever hidden. With no region groups at all, the picker is one
 * plain list, as before.
 *
 * A Fallback_Figure shows its own period and the retrieved date with the
 * Fallback_Note (spec 09, A1.8). With no series to offer, the picker shows the
 * none message and links to the demo, and states no range (A4.1, A4.2).
 *
 * Controlled component: the parent owns the selection. Unchecked boxes are
 * disabled once the limit is reached, so the picker never holds more than the
 * allowed number of figures. The limit counts figures across every group.
 */
export function FigurePicker({
  series,
  selected,
  atLimit,
  onToggle,
  details,
  mode = "demo",
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
    mode === "real"
      ? hint.key === "one"
        ? REAL_COPY.figuresHintRealOne
        : REAL_COPY.figuresHintReal.replace("{max}", String(hint.max))
      : hint.key === "one"
        ? LIVE_COPY.figuresHintOne
        : LIVE_COPY.figuresHint.replace("{max}", String(hint.max));
  const tooManyText =
    hint.key === "one"
      ? LIVE_COPY.figuresTooManyOne
      : LIVE_COPY.figuresTooMany.replace("{max}", String(hint.max));

  const renderItem = (item: PickableSeries) => {
    const checked = selected.includes(item.metricId);
    const disabled = !checked && atLimit;
    const inputId = `figure-${item.metricId}`;
    const isFallback = item.fallbackRetrievedAt !== undefined;
    const detail = details?.get(item.metricId);
    const shown =
      detail === undefined
        ? undefined
        : displayFigureValue(detail.value, detail.unit, detail.region);
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
          {shown !== undefined ? (
            <span className={styles.figureValue}>
              {LIVE_COPY.figureValue.replace("{value}", shown.text)}{" "}
              {shown.unit}
            </span>
          ) : null}
          <span className={styles.figureMeta}>
            {item.unit} · {item.region}
          </span>
          <span className={styles.figureMeta}>
            {LIVE_COPY.pickerPeriod.replace(
              "{period}",
              formatShortDate(item.latestPeriod),
            )}
          </span>
          {detail !== undefined ? (
            <span className={styles.figureMeta}>
              {LIVE_COPY.figureSource.replace("{source}", detail.sourceName)}
            </span>
          ) : null}
          {isFallback ? (
            <span className={styles.figureMeta}>
              {LIVE_COPY.pickerRetrieved.replace(
                "{date}",
                formatShortDate(item.fallbackRetrievedAt ?? ""),
              )}
            </span>
          ) : null}
          {item.isFixture ? (
            <span className={styles.fixture}>{LIVE_COPY.fixtureLabel}</span>
          ) : null}
        </label>
        {detail !== undefined ? (
          <details className={styles.sourceDetails}>
            <summary className={styles.sourceSummary}>
              {LIVE_COPY.figureSourceDetails}
            </summary>
            <dl className={styles.sourceList}>
              <dt>{LIVE_COPY.figureSourceName}</dt>
              <dd>{detail.sourceName}</dd>
              <dt>{LIVE_COPY.figureSeriesId}</dt>
              <dd>{detail.seriesId}</dd>
              <dt>{LIVE_COPY.figureSourceLink}</dt>
              <dd>
                <a href={detail.sourceUrl} rel="noopener noreferrer">
                  {detail.sourceUrl}
                </a>
              </dd>
              <dt>{LIVE_COPY.figureRetrieved}</dt>
              <dd>{formatShortDate(detail.retrievedAt)}</dd>
            </dl>
            <p className={styles.figureMeta}>
              {REVEAL_COPY.asPublished
                .replace("{value}", detail.value)
                .replace("{unit}", detail.unit)}
            </p>
          </details>
        ) : null}
      </li>
    );
  };

  const groups = groupPickable(series);
  const ungrouped = series.filter(
    (item) => regionGroupFor(item.region) === null,
  );

  return (
    <fieldset className={styles.figures} data-card="live-figures">
      <legend className={styles.legend}>{LIVE_COPY.figuresLegend}</legend>
      <p className={styles.hint}>{hintText}</p>
      {series.some((item) => item.fallbackRetrievedAt !== undefined) ? (
        <p className={styles.hint}>{LIVE_COPY.pickerNote}</p>
      ) : null}
      {groups.length > 0 ? (
        <div className={styles.regionGroups}>
          {groups.map((group) => (
            <fieldset key={group.group} className={styles.regionGroup}>
              <legend className={styles.regionLegend}>
                {GROUP_HEADING[group.group]}
              </legend>
              <ul className={styles.figureList}>
                {group.series.map(renderItem)}
              </ul>
            </fieldset>
          ))}
        </div>
      ) : null}
      {ungrouped.length > 0 ? (
        <ul className={styles.figureList}>{ungrouped.map(renderItem)}</ul>
      ) : null}
      {atLimit ? <p className={styles.hint}>{tooManyText}</p> : null}
    </fieldset>
  );
}
