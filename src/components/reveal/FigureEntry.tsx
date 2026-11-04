import type { FigureV1 } from "@/lib/seal-format";
import type { ChangeResult, DisplayRescale } from "@/lib/figures";
import {
  formatPeriod,
  formatValue,
  isFixtureFigure,
  rescaleForDisplay,
} from "@/lib/figures";
import { formatUtcDate } from "@/components/demo/dates";
import { MotionProvider } from "@/components/ceremony/motion";
import { NumberLine } from "@/components/ceremony/figures/NumberLine";
import { ChangeLine } from "./ChangeLine";
import { REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

/**
 * One comparable Figure_Entry of stage 3, drawn on the dark desk (spec 07,
 * R14.3). It renders nine items, top to bottom, in this order:
 *
 * 1. the metric's name and region, small and uppercase;
 * 2. "Your answer: {value} {unit}" with the value in the Accent, or "No answer";
 * 3. the then value, in the heaviest and largest type of the entry;
 * 4. the then unit, period, region and the "historical record, retrieved
 *    {date}" label, or the "fixture data" label for a fixture figure;
 * 5. the Number_Line, with the then and now pins and the Mark (when answered);
 * 6. the now value on its own line, bold at body size, with the now period,
 *    region and retrieved date;
 * 7. the change line, with both periods (ChangeLine, unchanged);
 * 8. the formula as text (ChangeLine, unchanged);
 * 9. the source control, which shows the source, the series ID and the
 *    `source_url` link.
 *
 * Every figure number carries its own period (R14.11). The type styles say
 * nothing about direction: the then value is always `.big` and the now value is
 * always body-size `strong`, for a rise, a fall and a zero change (R14.12).
 * Accent appears only on the judge's own answer and on the Mark (Property 8).
 *
 * The Number_Line's range comes from the then and now values only, so the Mark
 * never moves a figure (R12.2). The display rescale applies to every number
 * shown and to the drawing; the stored values are never changed (R11.10).
 *
 * Every string comes from copy.ts (R15.1). This component holds no state, reads
 * no clock beyond the formatter it is given, logs nothing and touches no
 * storage.
 */

export type FigureEntryProps = {
  /** The metric's display name, from the sealed payload. */
  name: string;
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

// The "check at the source" link exists only on an official figure, which is
// the only member of the FigureV1 union that carries source_url.
function sourceUrlOf(figure: Readonly<FigureV1>): string | undefined {
  return figure.kind === "official" ? figure.source_url : undefined;
}

export function FigureEntry({
  name,
  then,
  now,
  change,
  rescale,
  markValue,
}: FigureEntryProps) {
  // The drawing values use the same rescale as the printed values. Only
  // positions and the Mark's hidden text come from these; no displayed number
  // is computed from a position (R12.4).
  const toDisplay = (value: string): string =>
    rescale === undefined ? value : rescaleForDisplay(value, rescale.divisor);

  // The printed value: the rescaled value when a rescale applies, formatted for
  // the figure's region. The stored value is never changed.
  const shownValue = (figure: Readonly<FigureV1>): string =>
    formatValue(toDisplay(figure.value), figure.region);

  const unit = rescale === undefined ? then.unit : rescale.unit;
  const markForLine = markValue === undefined ? undefined : toDisplay(markValue);

  const thenFixture = isFixtureFigure(then);
  const nowFixture = isFixtureFigure(now);
  const thenLabel = thenFixture
    ? REVEAL_COPY.labelFixtureData
    : REVEAL_COPY.labelHistoricalRecord.replace(
        "{date}",
        formatUtcDate(then.retrieved_at),
      );
  const nowLabel = nowFixture
    ? REVEAL_COPY.labelFixtureData
    : REVEAL_COPY.labelRetrieved.replace("{date}", formatUtcDate(now.retrieved_at));

  const rescaledNote =
    rescale === undefined
      ? undefined
      : REVEAL_COPY.rescaledNote
          .replace("{toUnit}", rescale.unit)
          .replace("{fromUnit}", then.unit);

  const sourceUrl = sourceUrlOf(then);

  return (
    <MotionProvider>
      <section className={styles.fig} aria-label={`${name}, ${then.region}`}>
        <h3 className={styles.figName}>
          {name} · {then.region}
        </h3>

        {markValue === undefined ? (
          <p className={styles.youLine}>{REVEAL_COPY.noAnswer}</p>
        ) : (
          <p className={styles.youLine}>
            {REVEAL_COPY.yourAnswer}:{" "}
            <span className={styles.youValue}>
              {markValue} {then.unit}
            </span>
          </p>
        )}

        <div className={styles.thenLbl}>{REVEAL_COPY.then}</div>
        <div className={styles.big} data-role="then">
          {shownValue(then)}
        </div>
        <p className={styles.meta}>
          <span>{unit}</span> · <span>{formatPeriod(then.period, then.region)}</span>{" "}
          · <span>{then.region}</span> ·{" "}
          <span className={styles.fixtureLabel}>{thenLabel}</span>
          {rescaledNote === undefined ? null : <> · {rescaledNote}</>}
        </p>

        <NumberLine
          thenValue={toDisplay(then.value)}
          nowValue={toDisplay(now.value)}
          markValue={markForLine}
          unit={unit}
        />

        <p className={styles.nowLine} data-role="now">
          {REVEAL_COPY.now}:{" "}
          <strong>
            {shownValue(now)} {unit}
          </strong>{" "}
          · {formatPeriod(now.period, now.region)} · {now.region} ·{" "}
          <span className={styles.fixtureLabel}>{nowLabel}</span>
        </p>

        <ChangeLine result={change} region={then.region} then={then} now={now} />

        <details className={styles.src}>
          <summary>{REVEAL_COPY.sourceSummary}</summary>
          <p>{then.source}</p>
          <p>
            {REVEAL_COPY.seriesLabel}: {then.series_id}
          </p>
          {sourceUrl === undefined ? null : (
            <p>
              <a href={sourceUrl} rel="noreferrer noopener" target="_blank">
                {REVEAL_COPY.checkAtSource}
              </a>
            </p>
          )}
        </details>
      </section>
    </MotionProvider>
  );
}
