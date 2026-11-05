import type { FigureV1 } from "@/lib/seal-format";
import type { ChangeResult, DisplayRescale } from "@/lib/figures";
import {
  formatPeriod,
  formatValue,
  isFixtureFigure,
  rescaleForDisplay,
} from "@/lib/figures";
import type { LetterKind } from "./FigureLine";
import { formatLetterDate } from "@/components/ui/letter-date";
import { MotionProvider } from "@/components/ceremony/motion";
import { FIG_VALUE_SIZE } from "@/components/ceremony/constants";
import { NumberLine } from "@/components/ceremony/figures/NumberLine";
import { ChangeLine } from "./ChangeLine";
import { REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

/**
 * One comparable Figure_Entry of stage 3, drawn on the dark desk (spec 07,
 * R14.3). It renders these items, top to bottom, in this order:
 *
 * 1. the metric's name and region, small and uppercase;
 * 2. the then row: "Then:", the then value (.figValue), then the unit, the
 *    period, the region and the provenance label — "historical record,
 *    retrieved {date}" in a persona letter, "sealed with the letter, retrieved
 *    {date}" in a Live_Letter or Real_Letter (R13.1, R13.2), "fixture data" for
 *    a fixture figure (R13.3), or "self-reported" for a self-reported one
 *    (R13.4);
 * 3. the now row: "Now:", the now value (.figValue), then the same items for
 *    the now figure;
 * 4. the Number_Line, with the then and now pins, the Mark (when answered) and
 *    the "Your answer" label. The Number_Line is always drawn, so the label is
 *    too: with an answer it reads "Your answer" over the value and unit; with
 *    no answer it reads "Your answer" over "No answer". The Mark's own hidden
 *    text is "Your answer: {value} {unit}";
 * 5. the change line, with both periods (ChangeLine, unchanged);
 * 6. the formula as text, with both inputs (ChangeLine, unchanged);
 * 7. the source control, which shows the source, the series ID and the
 *    `source_url` link.
 *
 * "Your answer" is visible once in every case, as that Number_Line label. No
 * p.figAnswer element is rendered; the .figAnswer class is not used here.
 *
 * Every figure number carries its own period (R14.11). The then and now values
 * are both `.figValue` at FIG_VALUE_SIZE, so they have equal weight, and the
 * type styles say nothing about direction, for a rise, a fall and a zero change
 * (R14.12). Accent appears only on the Mark (Property 8).
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
   * The kind of letter this figure belongs to. Default `"persona"` keeps the
   * persona path, and its tests, unchanged. It decides only the official
   * non-fixture then label (R13.1, R13.2).
   */
  letterKind?: LetterKind;
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
  letterKind = "persona",
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
  // Then label precedence: fixture (R13.3), self-reported (R13.4), then the
  // official figure by letter kind (R13.1 persona, R13.2 live/real).
  const thenLabel = thenFixture
    ? REVEAL_COPY.labelFixtureData
    : then.kind === "self-reported"
      ? REVEAL_COPY.labelSelfReported
      : (letterKind === "persona"
          ? REVEAL_COPY.labelHistoricalRecord
          : REVEAL_COPY.labelSealedWithLetter
        ).replace("{date}", formatLetterDate(then.retrieved_at, { kind: "utc" }));
  // The now figure always reads "retrieved {date}" whatever the letter kind;
  // a fixture now reads "fixture data" (R13.3).
  const nowLabel = nowFixture
    ? REVEAL_COPY.labelFixtureData
    : REVEAL_COPY.labelRetrieved.replace(
        "{date}",
        formatLetterDate(now.retrieved_at, { kind: "utc" }),
      );

  const rescaledNote =
    rescale === undefined
      ? undefined
      : REVEAL_COPY.rescaledNote
          .replace("{toUnit}", rescale.unit)
          .replace("{fromUnit}", then.unit);

  const sourceUrl = sourceUrlOf(then);

  // Both values share one size and weight (R14.12), set from the ceremony
  // constant so the reveal and the ceremony agree.
  const valueStyle = { fontSize: FIG_VALUE_SIZE };

  return (
    <MotionProvider>
      <section className={styles.fig} aria-label={`${name}, ${then.region}`}>
        <h3 className={styles.figName}>
          {name} · {then.region}
        </h3>

        <p className={styles.figRow}>
          <span className={styles.rowLabel}>{REVEAL_COPY.then}:</span>{" "}
          <span className={styles.figValue} style={valueStyle} data-role="then">
            {shownValue(then)}
          </span>{" "}
          <span>{unit}</span>{" "}
          <span>{formatPeriod(then.period, then.region)}</span>
          {" · "}
          <span>{then.region}</span>
          {" · "}
          <span className={styles.fixtureLabel}>{thenLabel}</span>
          {rescaledNote === undefined ? null : <> · {rescaledNote}</>}
        </p>

        <p className={styles.figRow}>
          <span className={styles.rowLabel}>{REVEAL_COPY.now}:</span>{" "}
          <span className={styles.figValue} style={valueStyle} data-role="now">
            {shownValue(now)}
          </span>{" "}
          <span>{unit}</span>{" "}
          <span>{formatPeriod(now.period, now.region)}</span>
          {" · "}
          <span>{now.region}</span>
          {" · "}
          <span className={styles.fixtureLabel}>{nowLabel}</span>
        </p>

        <NumberLine
          thenValue={toDisplay(then.value)}
          nowValue={toDisplay(now.value)}
          thenShown={shownValue(then)}
          nowShown={shownValue(now)}
          thenPeriod={formatPeriod(then.period, then.region)}
          nowPeriod={formatPeriod(now.period, now.region)}
          markValue={markForLine}
          unit={unit}
        />

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
