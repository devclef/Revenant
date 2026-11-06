import type { FigureV1, MetricDefinitionV1 } from "@/lib/seal-format";
import type { DisplayRescale } from "@/lib/figures";
import { computeChange, isFixtureFigure, rescaleForDisplay } from "@/lib/figures";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import { pickNow } from "@/lib/figures/now";
import type { FiguresState } from "./figures-api";
import type { Opened } from "./opening-machine";
import type { RecallRecordV1 } from "@/lib/recall";
import { FigureEntry, YourAnswerLine } from "./FigureEntry";
import { FigureLine, type LetterKind } from "./FigureLine";
import { FixtureNote } from "./FixtureNote";
import { REVEAL_COPY } from "./copy";
import { nowMessageFor } from "./now-message";
import styles from "./reveal.module.css";

/**
 * Stage 3 of the reveal (design.md "Reveal", R11-R13): the sealed figures then
 * and the catalogue's figures now, one metric per entry, in the exact order the
 * figures were sealed.
 *
 * For each sealed figure, in payload order:
 *
 * - The metric's display name is looked up from the sealed `payload.metrics`
 *   (never the live catalogue), so a letter still names its metric even if the
 *   catalogue has changed (data-integrity.md). A figure whose metric_id is not
 *   declared is skipped; the sealed-letter schema forbids that, so it cannot
 *   happen for a validly sealed letter.
 * - The sealed "then" figure comes from the payload only and is shown with
 *   {@link FigureLine} (role "then").
 * - The "now" figure is picked with `pickNow` from the Figures_API response
 *   (`figures`, read once per reveal by `useFigures` in Reveal). The match uses
 *   the sealed metric's source, series, unit and region only. While the request
 *   is in flight the entry shows `nowLoading`. A series that is missing, or has
 *   no figure, shows `nowRetired` (series missing) or `nowNotYet` (no figure), via nowMessageFor, plus a "Your answer" line when no Number_Line is drawn (issue #250). A failed request shows
 *   `nowUnavailableFetch`. In every missing case there is no change and no
 *   Number_Line (R6.5, R6.6, data-integrity.md). An honest gap, never a filled
 *   one.
 * - When both figures are present, {@link computeChange} decides comparability.
 *   Not comparable: both figures are shown with their own periods, plus the one
 *   neutral reason sentence for the first failing check (R12.x,
 *   data-integrity.md). Comparable: a {@link FigureEntry}, which holds the then
 *   and now stamps, the Number_Line with the judge's Mark, and the one neutral
 *   change line (R9.1, R12.9).
 * - The Mark for a metric is the judge's answer to its number question in the
 *   stored record (`record`, optional). No record, or "No answer", draws no Mark.
 *
 * The display rescale (if any) comes from the series as loaded in
 * `DEMO_FIGURES` and is passed to each {@link FigureLine}; it is display-only
 * and never changes a stored value (R11.10). The sealed "then" figure uses the
 * same series rescale so then and now read in the same unit.
 *
 * {@link FixtureNote} is rendered once at the top when any shown figure is a
 * fixture (`isFixtureFigure`, R13.5). The per-figure "fixture data" label is
 * separate and lives on each {@link FigureLine} / {@link ChangeLine}.
 *
 * Every string comes from copy.ts; no letter text or figure value is an
 * authored literal (R15.1). This component reads no clock, holds no state, logs
 * nothing and makes no network request. The Now_Figures come from the `figures`
 * prop. `DEMO_FIGURES` is a frozen import, used only for the display rescale.
 */

export type FiguresThenNowProps = {
  /** The opened letter; its payload holds the sealed figures and metrics. */
  opened: Opened;
  /**
   * The stored recall record. Its answer for each number question gives the
   * Mark on that metric's Number_Line. Without it, no entry has a Mark.
   */
  record?: RecallRecordV1;
  /**
   * Live letters only (spec 06, R18). When true, a then and a now figure with
   * the same period end and value are comparable and show a change of zero.
   * Default false: the persona path is unchanged.
   */
  allowSamePeriod?: boolean;
  /**
   * The kind of opened letter, threaded to each figure so its then label reads
   * "historical record" for a persona or "sealed with the letter" for a
   * Live_Letter or Real_Letter (R13.1, R13.2). Default `"persona"` keeps the
   * persona path, and its tests, unchanged.
   */
  letterKind?: LetterKind;
  /**
   * The Figures_API state from `useFigures()` (figures-api.ts). It supplies
   * every Now_Figure. The caller reads it once per reveal and passes it down.
   */
  figures: FiguresState;
};

type NowLookup =
  | { found: true; figure: Readonly<FigureV1>; note: string | null }
  | { found: false; message: string | null };

// The Now_Figure for one sealed then figure, or the copy that says why there is
// none (issue #250, A3). A request still in flight shows nowLoading. Every other
// reason is mapped by nowMessageFor, so each message describes the real cause.
function nowLookup(
  then: Readonly<FigureV1>,
  metric: MetricDefinitionV1,
  figures: FiguresState,
): NowLookup {
  if (figures.status === "loading") {
    return { found: false, message: REVEAL_COPY.nowLoading };
  }
  if (figures.status === "failed") {
    return {
      found: false,
      message: nowMessageFor({ kind: "request_failed" }),
    };
  }
  const picked = pickNow(then, metric, figures.figures);
  if (!picked.found) {
    return {
      found: false,
      message: nowMessageFor({ kind: picked.reason }),
    };
  }
  return {
    found: true,
    figure: picked.figure,
    note: nowMessageFor({
      kind: "found",
      fallback: picked.fallback,
      retrievedAt: picked.figure.retrieved_at,
    }),
  };
}

/**
 * The judge's typed answer for the number question about `metricId`, or
 * `undefined` for "No answer", no record, or no number question for the metric.
 */
function markValueFor(
  metricId: string,
  questions: Opened["payload"]["recall_questions"],
  record: RecallRecordV1 | undefined,
): string | undefined {
  if (record === undefined) return undefined;
  const question = questions.find(
    (q) => q.answer_type === "number" && q.metric_id === metricId,
  );
  if (question === undefined) return undefined;
  const answer = record.answers.find((a) => a.question_id === question.id);
  return answer !== undefined && answer.kind === "number"
    ? answer.value
    : undefined;
}

export function FiguresThenNow({
  opened,
  record,
  allowSamePeriod = false,
  letterKind = "persona",
  figures,
}: FiguresThenNowProps) {
  const { payload } = opened;

  const metricById = new Map<string, MetricDefinitionV1>();
  for (const metric of payload.metrics) {
    metricById.set(metric.id, metric);
  }

  // Build each entry up front so we can decide the fixture note from every
  // figure actually shown, then render.
  type Entry = {
    key: string;
    name: string;
    then: Readonly<FigureV1>;
    now: Readonly<FigureV1> | undefined;
    nowMissing: string | null;
    nowNote: string | null;
    rescale: Readonly<DisplayRescale> | undefined;
    change: ReturnType<typeof computeChange> | undefined;
    markValue: string | undefined;
    /** The answer in the shown unit, for a branch with no Number_Line. */
    answerValue: string | undefined;
    answerUnit: string;
  };

  const entries: Entry[] = [];
  let anyFixture = false;

  payload.figures.forEach((then, index) => {
    const metric = metricById.get(then.metric_id);
    // A figure with no matching metric cannot occur for a validly sealed letter
    // (the schema enforces it); skip defensively rather than invent a name.
    if (metric === undefined) return;
    const name = metric.display_name;

    const series = DEMO_FIGURES.series.get(then.metric_id);
    const rescale = series?.display_rescale;

    const lookup = nowLookup(then, metric, figures);
    const now = lookup.found ? lookup.figure : undefined;
    const nowMissing = lookup.found ? null : lookup.message;
    const nowNote = lookup.found ? lookup.note : null;

    const change =
      now === undefined
        ? undefined
        : computeChange(then, now, { allowSamePeriod });

    if (isFixtureFigure(then)) anyFixture = true;
    if (now !== undefined && isFixtureFigure(now)) anyFixture = true;

    const markValue = markValueFor(then.metric_id, payload.recall_questions, record);
    entries.push({
      // metric_id is unique per payload, but index keeps the key stable even if
      // that ever changes.
      key: `${then.metric_id}-${index}`,
      name,
      then,
      now,
      nowMissing,
      nowNote,
      rescale,
      change,
      markValue,
      answerValue:
        markValue === undefined || rescale === undefined
          ? markValue
          : rescaleForDisplay(markValue, rescale.divisor),
      answerUnit: rescale === undefined ? then.unit : rescale.unit,
    });
  });

  return (
    <section className={styles.figuresThenNow}>
      <h2 tabIndex={-1} data-figures-heading="">{REVEAL_COPY.stage3Title}</h2>

      {anyFixture ? <FixtureNote /> : null}

      {entries.map((entry) => (
        <div
          key={entry.key}
          className={styles.figureGroup}
          data-figure-entry=""
        >
          {entry.now === undefined ? (
            <h3 className={styles.metricName}>{entry.name}</h3>
          ) : null}

          {entry.now === undefined ? (
            // No now figure: show the sealed then figure and say, plainly, why
            // the current figure is unavailable. No change is shown.
            <>
              <p className={styles.then}>{REVEAL_COPY.then}</p>
              <FigureLine
                figure={entry.then}
                role="then"
                letterKind={letterKind}
                displayRescale={entry.rescale}
              />
              {entry.nowMissing === null ? null : (
                <p className={styles.period}>{entry.nowMissing}</p>
              )}
              <YourAnswerLine
                markValue={entry.answerValue}
                unit={entry.answerUnit}
              />
            </>
          ) : entry.change !== undefined && entry.change.comparable ? (
            // Comparable: the nine R14.3 items, with the name at the top
            // (FigureEntry, R14.3, R12.1).
            <FigureEntry
              name={entry.name}
              then={entry.then}
              now={entry.now}
              change={entry.change}
              rescale={entry.rescale}
              letterKind={letterKind}
              markValue={entry.markValue}
              nowNote={entry.nowNote ?? undefined}
            />
          ) : (
            // Not comparable: both figures with their own periods, plus the one
            // neutral reason sentence for the first failing check.
            <>
              <h3 className={styles.metricName}>{entry.name}</h3>
              <p className={styles.then}>{REVEAL_COPY.then}</p>
              <FigureLine
                figure={entry.then}
                role="then"
                letterKind={letterKind}
                displayRescale={entry.rescale}
              />
              <p className={styles.now}>{REVEAL_COPY.now}</p>
              <FigureLine
                figure={entry.now}
                role="now"
                letterKind={letterKind}
                displayRescale={entry.rescale}
              />
              {entry.nowNote === null ? null : (
                <p className={styles.period}>{entry.nowNote}</p>
              )}
              <p className={styles.period}>{REVEAL_COPY.notComparable}</p>
              {entry.change !== undefined && !entry.change.comparable ? (
                <p className={styles.period}>
                  {REVEAL_COPY.reason[entry.change.reason]}
                </p>
              ) : null}
              <YourAnswerLine
                markValue={entry.answerValue}
                unit={entry.answerUnit}
              />
            </>
          )}
        </div>
      ))}
    </section>
  );
}
