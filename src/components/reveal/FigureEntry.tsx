import type { FigureV1 } from "@/lib/seal-format";
import type { ChangeResult, DisplayRescale } from "@/lib/figures";
import { formatPeriod, formatValue, rescaleForDisplay } from "@/lib/figures";
import { MotionProvider } from "@/components/ceremony/motion";
import { NumberLine } from "@/components/ceremony/figures/NumberLine";
import { ChangeLine } from "./ChangeLine";
import { rescaledChangeInputs } from "./change-display";
import { displayPrecisionForUnit } from "./display-precision";
import { ReceiptCard } from "./ReceiptCard";
import {
  receiptFigureOf,
  receiptSourceOf,
  type LetterKind,
} from "./FigureLine";

/**
 * One comparable Figure_Entry of stage 3, drawn as a Receipt_Card (spec 09 C3,
 * spec 07 R14.3). The card holds these rows, top to bottom:
 *
 * 1. the metric's name and region;
 * 2. "Your answer", once, with the answer and its unit, or "No answer";
 * 3. "Then": the then value, unit, period, region and provenance label;
 * 4. "Now": the now value in the same type style, with the same items;
 * 5. the Number_Line, with the then and now pins and the Mark (when answered);
 * 6. the change line, with both periods, and the formula;
 * 7. the source control: the source, the series ID and the `source_url` link.
 *
 * The Number_Line's range comes from the then and now values only, so the Mark
 * never moves a figure (R12.2). The display rescale applies to every number
 * shown and to the drawing; the stored values are never changed (R11.10).
 * Accent appears only on the Mark (Property 8). The formula and the change
 * line are built by ChangeLine, unchanged.
 *
 * This component holds no state, reads no clock beyond the formatters it calls,
 * logs nothing and touches no storage. Every string comes from copy.ts.
 */

export type FigureEntryProps = {
  /** The card heading: the Short_Name, or the sealed display_name (P5.4). */
  name: string;
  /**
   * The sealed display_name, shown under Source as the Series_Name (P5.4).
   * Absent, the Series_Name line is not drawn.
   */
  seriesName?: string;
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
  /** True when the judge's answer is a Kept_Sample (spec 10 C5.8). */
  sample?: boolean;
  /**
   * A line shown under the now row, for a now figure that is a bundled
   * fallback (issue #250, A3.3). Absent for a stored figure.
   */
  nowNote?: string;
  /** Marks the card as the primary control of its Stage (data-primary-control). */
  primary?: boolean;
};

export function FigureEntry({
  name,
  seriesName,
  then,
  now,
  change,
  rescale,
  letterKind = "persona",
  markValue,
  sample = false,
  nowNote,
  primary = false,
}: FigureEntryProps) {
  // The drawing values use the same rescale as the printed values. Only
  // positions and the Mark's hidden text come from these; no displayed number
  // is computed from a position (R12.4).
  const toDisplay = (value: string): string =>
    rescale === undefined ? value : rescaleForDisplay(value, rescale.divisor);

  const unit = rescale === undefined ? then.unit : rescale.unit;
  // The printed values share the card's display precision (P5.1), so the
  // Number_Line labels match the Then and Now rows.
  const precision = displayPrecisionForUnit(unit);

  const shownValue = (figure: Readonly<FigureV1>): string =>
    formatValue(toDisplay(figure.value), figure.region, precision);

  // The typed answer is already in the shown unit: FiguresThenNow passes the
  // per-litre value it stored (C8.3). Rescaling it again here would divide twice.
  const markForLine = markValue;

  return (
    <MotionProvider>
      <ReceiptCard
        name={name}
        region={then.region}
        markValue={markForLine}
        sample={sample}
        unit={unit}
        then={receiptFigureOf(then, "then", letterKind, rescale)}
        now={receiptFigureOf(now, "now", letterKind, rescale)}
        nowNote={nowNote}
        primary={primary}
        numberLine={
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
        }
        change={
          <ChangeLine
            result={change}
            region={then.region}
            then={then}
            now={now}
            display={
              rescale === undefined
                ? undefined
                : rescaledChangeInputs(then.value, now.value, rescale, then.unit)
            }
          />
        }
        source={receiptSourceOf(then, seriesName)}
      />
    </MotionProvider>
  );
}
