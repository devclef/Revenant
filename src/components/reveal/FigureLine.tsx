import type { FigureV1 } from "@/lib/seal-format";
import type { DisplayRescale } from "@/lib/figures";
import {
  formatValue,
  formatPeriod,
  isFixtureFigure,
  rescaleForDisplay,
} from "@/lib/figures";
import { formatLetterDate } from "@/components/ui/letter-date";
import { FIG_VALUE_SIZE } from "@/components/ceremony/constants";
import { REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

/**
 * One sealed figure, shown with full provenance (R11.2, R13.1-R13.6). It holds
 * the figure's value, unit, period and region in one element, then a collapsed
 * `<details>` with the source, series and (for an official figure) a link to
 * check it at the source.
 *
 * The label is decided by the caller's `role`, the figure itself and the
 * `letterKind` of the opened letter (R13.1-R13.4):
 *
 * - A fixture figure (source or series_id starting with FIXTURE) always shows
 *   "fixture data" and never "historical record" (R13.3, data-integrity.md).
 * - A self-reported figure always shows "self-reported" and never "historical
 *   record" or "retrieved" (R13.4).
 * - A non-fixture official "then" figure shows "historical record, retrieved
 *   {date}" in a persona letter (R13.1) and "sealed with the letter, retrieved
 *   {date}" in a Live_Letter or Real_Letter (R13.2); a non-fixture official
 *   "now" figure shows "retrieved {date}" whatever the letter kind.
 *
 * `{date}` is `retrieved_at` formatted with `formatLetterDate` in UTC into the
 * en-GB long form (e.g. "30 October 2024"). A `retrieved_at` is an instant of
 * Revenant's fetch, so it always uses UTC and never shifts under the viewer's
 * timezone (data-integrity.md).
 *
 * When the series carries a `display_rescale`, the value is shown rescaled
 * (exact, display-only) in the rescaled unit, with the plain note saying what
 * was rescaled from what (R11.10). The stored value is never changed; the
 * source details still carry the figure as published.
 *
 * A self-reported figure has no `source_url` in the payload schema, so the
 * "check at the source" link is rendered only when `source_url` is present.
 *
 * Every string comes from copy.ts (R15.1). This component holds no state, reads
 * no clock, logs nothing and touches no storage.
 */

/**
 * The kind of letter the figure belongs to, which decides the then-figure
 * label for an official non-fixture figure (R13.1, R13.2). A persona letter
 * reads "historical record"; a Live_Letter or Real_Letter reads "sealed with
 * the letter". Fixture and self-reported figures ignore this (R13.3, R13.4).
 */
export type LetterKind = "persona" | "live" | "real";

export type FigureLineProps = {
  /** The sealed figure to show, with its full provenance. */
  figure: Readonly<FigureV1>;
  /** Whether this is the "then" figure or the "now" figure. */
  role: "then" | "now";
  /**
   * The kind of letter the figure belongs to. Default `"persona"` keeps the
   * persona path, and its tests, unchanged. Only the official non-fixture then
   * label depends on it (R13.1, R13.2).
   */
  letterKind?: LetterKind;
  /** The series' display rescale, when one applies (display-only). */
  displayRescale?: Readonly<DisplayRescale>;
};

// The "check at the source" link exists only on an official figure, which is
// the only member of the FigureV1 union that carries source_url.
function sourceUrlOf(figure: Readonly<FigureV1>): string | undefined {
  return figure.kind === "official" ? figure.source_url : undefined;
}

export function FigureLine({
  figure,
  role,
  letterKind = "persona",
  displayRescale,
}: FigureLineProps) {
  const fixture = isFixtureFigure(figure);

  // Label precedence: fixture first (R13.3), then self-reported (R13.4), then
  // the official figure by role and letter kind (R13.1, R13.2).
  let label: string;
  if (fixture) {
    label = REVEAL_COPY.labelFixtureData;
  } else if (figure.kind === "self-reported") {
    // A self-reported number is the reader's own: never "retrieved" (R13.4).
    label = REVEAL_COPY.labelSelfReported;
  } else {
    // retrieved_at is a UTC instant; formatLetterDate in UTC renders it as the
    // en-GB long form (e.g. "30 October 2024"), so it never shifts.
    const retrievedDate = formatLetterDate(figure.retrieved_at, { kind: "utc" });
    if (role === "now") {
      label = REVEAL_COPY.labelRetrieved.replace("{date}", retrievedDate);
    } else {
      // A persona then figure is a historical record (R13.1); a live or real
      // then figure was sealed with the letter (R13.2).
      const template =
        letterKind === "persona"
          ? REVEAL_COPY.labelHistoricalRecord
          : REVEAL_COPY.labelSealedWithLetter;
      label = template.replace("{date}", retrievedDate);
    }
  }

  // Display value and unit: rescaled (display-only, exact) when the series has
  // a display_rescale, otherwise the figure as published. The stored value is
  // never changed.
  const shownValue =
    displayRescale === undefined
      ? formatValue(figure.value, figure.region)
      : formatValue(
          rescaleForDisplay(figure.value, displayRescale.divisor),
          figure.region,
        );
  const shownUnit =
    displayRescale === undefined ? figure.unit : displayRescale.unit;

  const rescaledNote =
    displayRescale === undefined
      ? undefined
      : REVEAL_COPY.rescaledNote
          .replace("{toUnit}", displayRescale.unit)
          .replace("{fromUnit}", figure.unit);

  const period = formatPeriod(figure.period, figure.region);
  const sourceUrl = sourceUrlOf(figure);

  return (
    <div className={styles.figure}>
      <span className={styles.fixtureLabel}>{label}</span>{" "}
      <span className={styles.figValue} style={{ fontSize: FIG_VALUE_SIZE }}>
        {shownValue}
      </span>{" "}
      <span>{shownUnit}</span>{" "}
      <span className={styles.period}>{period}</span>{" "}
      <span className={styles.region}>{figure.region}</span>
      {rescaledNote === undefined ? null : (
        <span className={styles.period}> {rescaledNote}</span>
      )}
      <details className={styles.source}>
        <summary>{REVEAL_COPY.sourceSummary}</summary>
        <p>{figure.source}</p>
        <p>
          {REVEAL_COPY.seriesLabel}: {figure.series_id}
        </p>
        {sourceUrl === undefined ? null : (
          <p>
            <a href={sourceUrl} rel="noreferrer noopener" target="_blank">
              {REVEAL_COPY.checkAtSource}
            </a>
          </p>
        )}
      </details>
    </div>
  );
}
