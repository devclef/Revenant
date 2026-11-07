import type { FigureV1 } from "@/lib/seal-format";
import type { DisplayRescale } from "@/lib/figures";
import {
  formatPeriod,
  formatValue,
  isFixtureFigure,
  rescaleForDisplay,
} from "@/lib/figures";
import { formatLetterDate } from "@/components/ui/letter-date";
import { REVEAL_COPY } from "./copy";
import type { ReceiptFigure, ReceiptSource } from "./ReceiptCard";

/**
 * The data behind one sealed figure's Then or Now row, and its source control
 * (spec 09 C3). Every Figure_Entry branch hands these to {@link ReceiptCard},
 * so the label and display rules live here, in one place.
 *
 * The label is decided by the role, the figure itself and the `letterKind` of
 * the opened letter (R13.1-R13.4):
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
 * `{date}` is `retrieved_at` in UTC, so it never shifts under the viewer's
 * timezone (data-integrity.md). When the series carries a `display_rescale`,
 * the value is shown rescaled (exact, display-only) with the note saying what
 * was rescaled from what (R11.10). The stored value is never changed.
 *
 * Every string comes from copy.ts (R15.1). These helpers read no clock beyond
 * the formatters they call, hold no state and touch no storage.
 */

/**
 * The kind of letter the figure belongs to, which decides the then-figure
 * label for an official non-fixture figure (R13.1, R13.2). A persona letter
 * reads "historical record"; a Live_Letter or Real_Letter reads "sealed with
 * the letter". Fixture and self-reported figures ignore this (R13.3, R13.4).
 */
export type LetterKind = "persona" | "live" | "real";

/** The provenance label for one Then or Now figure. */
export function figureLabel(
  figure: Readonly<FigureV1>,
  role: "then" | "now",
  letterKind: LetterKind = "persona",
): string {
  if (isFixtureFigure(figure)) return REVEAL_COPY.labelFixtureData;
  // A self-reported number is the reader's own: never "retrieved" (R13.4).
  if (figure.kind === "self-reported") return REVEAL_COPY.labelSelfReported;
  // retrieved_at is a UTC instant, so it always reads the same in any zone.
  const retrievedDate = formatLetterDate(figure.retrieved_at, { kind: "utc" });
  if (role === "now") {
    return REVEAL_COPY.labelRetrieved.replace("{date}", retrievedDate);
  }
  // A persona then figure is a historical record (R13.1); a live or real then
  // figure was sealed with the letter (R13.2).
  const template =
    letterKind === "persona"
      ? REVEAL_COPY.labelHistoricalRecord
      : REVEAL_COPY.labelSealedWithLetter;
  return template.replace("{date}", retrievedDate);
}

/**
 * The Then or Now row data for one figure. The value is rescaled for display
 * when a rescale applies, then formatted for the figure's region. The period is
 * formatted for the region too, so every displayed number shows its own period.
 */
export function receiptFigureOf(
  figure: Readonly<FigureV1>,
  role: "then" | "now",
  letterKind: LetterKind = "persona",
  displayRescale?: Readonly<DisplayRescale>,
): ReceiptFigure {
  const value =
    displayRescale === undefined
      ? formatValue(figure.value, figure.region)
      : formatValue(
          rescaleForDisplay(figure.value, displayRescale.divisor),
          figure.region,
        );
  const note =
    displayRescale === undefined
      ? undefined
      : REVEAL_COPY.rescaledNote
          .replace("{toUnit}", displayRescale.unit)
          .replace("{fromUnit}", figure.unit);
  return {
    value,
    unit: displayRescale === undefined ? figure.unit : displayRescale.unit,
    period: formatPeriod(figure.period, figure.region),
    region: figure.region,
    label: figureLabel(figure, role, letterKind),
    note,
  };
}

// The "check at the source" link exists only on an official figure, which is
// the only member of the FigureV1 union that carries source_url.
function sourceUrlOf(figure: Readonly<FigureV1>): string | undefined {
  return figure.kind === "official" ? figure.source_url : undefined;
}

/** The source control data for one sealed figure. */
export function receiptSourceOf(figure: Readonly<FigureV1>): ReceiptSource {
  return {
    source: figure.source,
    seriesId: figure.series_id,
    sourceUrl: sourceUrlOf(figure),
  };
}
