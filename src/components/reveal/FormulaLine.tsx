import { CHANGE_FORMULA_ID, type ChangeDisplay } from "@/lib/figures";
import { REVEAL_COPY } from "./copy";
import { readableFormula, type ComparableResult } from "./formula";
import styles from "./reveal.module.css";

/**
 * The formula for one then-vs-now change, with the links to check its inputs
 * at the source (R4.2). It sits outside the Source details, so it stays visible
 * while the details are closed.
 *
 * One checkAtSource link is drawn for each distinct source_url among the
 * inputs. An input without a source_url shows the series ID in its place, even
 * when the other input has a link.
 *
 * The formula is built from the same result that ChangeLine prints, so the
 * formula shown is the one the change used. This component holds no state and
 * computes no number.
 */

export type FormulaLineProps = {
  /** The comparable change, with the display inputs already applied (R5.4). */
  result: ComparableResult;
  /** The change as ChangeLine prints it: the result ends the formula (R5.4). */
  shown: ChangeDisplay;
  /** The sealed series ID, shown for each input that has no source_url. */
  seriesId: string;
  /** The source_url of each input figure. Absent entries are skipped. */
  sourceUrls: ReadonlyArray<string | undefined>;
};

export function FormulaLine({
  result,
  shown,
  seriesId,
  sourceUrls,
}: FormulaLineProps) {
  // One entry per distinct source: the source_url where an input has one,
  // otherwise that input's series ID. Two inputs sharing a URL give one entry.
  const sources = [
    ...new Set(
      sourceUrls.map((url) =>
        url !== undefined && url !== "" ? `url:${url}` : `series:${seriesId}`,
      ),
    ),
  ];

  return (
    <div className={styles.change} data-change="">
      <p className={styles.formula} data-formula={CHANGE_FORMULA_ID}>
        {REVEAL_COPY.formulaLabel}: {readableFormula(result, shown)}
      </p>
      {sources.map((source) =>
        source.startsWith("url:") ? (
          <p key={source}>
            <a
              href={source.slice("url:".length)}
              rel="noreferrer noopener"
              target="_blank"
            >
              {REVEAL_COPY.checkAtSource}
            </a>
          </p>
        ) : (
          <p key={source} className={styles.period}>
            {REVEAL_COPY.seriesLabel}: {seriesId}
          </p>
        ),
      )}
    </div>
  );
}
