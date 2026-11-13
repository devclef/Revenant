import type { FigureV1, MetricDefinitionV1, PayloadV1 } from "@/lib/seal-format";
import type { DisplayRescale } from "@/lib/figures";
import {
  computeChange,
  displayRescaleForUnit,
  formatPeriod,
  isFixtureFigure,
} from "@/lib/figures";
import { FIG_VALUE_SIZE } from "@/components/ceremony/constants";
import { pickNow } from "@/lib/figures/now";
import type { FiguresState } from "./figures-api";
import type { Opened } from "./opening-machine";
import type { RecallRecordV1, RecallRecordV2 } from "@/lib/recall";
import { FigureEntry } from "./FigureEntry";
import { receiptFigureOf, receiptSourceOf, type LetterKind } from "./FigureLine";
import { FixtureNote } from "./FixtureNote";
import { ReceiptCard } from "./ReceiptCard";
import { receiptKindFor } from "./receipt-kind";
import { keptSampleFor } from "./kept-sample";
import { REVEAL_COPY } from "./copy";
import { shortNameFor } from "./short-names";
import { nowMessageFor } from "./now-message";
import styles from "./reveal.module.css";

/**
 * The display rescale for a sealed unit (C8): read from the unit string alone,
 * so a letter still shows it whatever the Catalogue holds. Undefined when the
 * unit is shown as sealed.
 */
function rescaleFor(sealedUnit: string): Readonly<DisplayRescale> | undefined {
  const display = displayRescaleForUnit(sealedUnit);
  if (display === null) return undefined;
  return {
    divisor: display.divisor as DisplayRescale["divisor"],
    unit: display.displayUnit,
  };
}

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
 *   {@link receiptFigureOf} (role "then") inside a {@link ReceiptCard}.
 * - The "now" figure is picked with `pickNow` from the Figures_API response
 *   (`figures`, read once per reveal by `useFigures` in Reveal). The match uses
 *   the sealed metric's source, series, unit and region only. While the request
 *   is in flight the entry shows `nowLoading`. A series that is missing, or has
 *   no figure, shows `nowRetired` (series missing) or `nowNotYet` (no figure), via nowMessageFor, plus a "Your answer" line when no Number_Line is drawn (issue #250). A failed request shows
 *   `nowRequestFailed`. In every missing case there is no change and no
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
 * The display rescale comes from the sealed unit string (`displayRescaleForUnit`,
 * C8) and is passed to each {@link receiptFigureOf}; it is display-only and never
 * changes a stored value (R11.10). The sealed "then" figure uses the same rescale
 * so then and now read in the same unit.
 *
 * {@link FixtureNote} is rendered once at the top when any shown figure is a
 * fixture (`isFixtureFigure`, R13.5). The per-figure "fixture data" label is
 * separate and lives on each {@link ReceiptCard} row (the labels come from receiptFigureOf).
 *
 * Every string comes from copy.ts; no letter text or figure value is an
 * authored literal (R15.1). This component reads no clock, holds no state, logs
 * nothing and makes no network request. The Now_Figures come from the `figures`
 * prop. The display rescale is read from each sealed unit string (C8).
 */

export type FiguresThenNowProps = {
  /** The opened letter; its payload holds the sealed figures and metrics. */
  opened: Opened;
  /**
   * The stored recall record. Its answer for each number question gives the
   * Mark on that metric's Number_Line. Without it, no entry has a Mark.
   */
  record?: RecallRecordV1 | RecallRecordV2;
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
  /**
   * Whether the first card carries the Stage's primary control (C3, P4.1).
   * Reveal turns it off once the Close shows, so the Close owns the layout
   * check's first viewport (spec 09 PH1). Default true.
   */
  primaryCard?: boolean;
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
  record: RecallRecordV1 | RecallRecordV2 | undefined,
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
  primaryCard = true,
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
    /** The card heading: the Short_Name, or the sealed display_name. */
    name: string;
    /** The sealed display_name, shown under Source (P5.4). */
    seriesName: string;
    then: Readonly<FigureV1>;
    now: Readonly<FigureV1> | undefined;
    nowMissing: string | null;
    nowNote: string | null;
    rescale: Readonly<DisplayRescale> | undefined;
    change: ReturnType<typeof computeChange> | undefined;
    /** The card this figure gets (spec 12 Z2). See receiptKindFor. */
    kind: ReturnType<typeof receiptKindFor>;
    markValue: string | undefined;
    sample: boolean;
    /** The answer in the shown unit, for a branch with no Number_Line. */
    answerValue: string | undefined;
    answerUnit: string;
  };

  const entries: Entry[] = [];
  let anyFixture = false;

  // Self-reported figures are listed after the official ones, with no now
  // figure, no change and no Number_Line (spec 08 later-tasks, R26.6).
  payload.figures.forEach((then, index) => {
    if (then.kind === "self-reported") return;
    const metric = metricById.get(then.metric_id);
    // A figure with no matching metric cannot occur for a validly sealed letter
    // (the schema enforces it); skip defensively rather than invent a name.
    if (metric === undefined) return;
    const seriesName = metric.display_name;
    const name = shortNameFor(then.metric_id, seriesName);

    // The display rescale comes from the sealed unit string (C8.2), so it holds
    // whatever the Catalogue carries.
    const rescale = rescaleFor(then.unit);

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
      seriesName,
      then,
      now,
      nowMissing,
      nowNote,
      rescale,
      change,
      kind: receiptKindFor(then, now, change),
      markValue,
      sample: keptSampleFor(then.metric_id, payload.recall_questions, record),
      // The typed answer is stored per litre already (C8.3), so it is shown as
      // typed. Only the unit changes.
      answerValue: markValue,
      answerUnit: rescale === undefined ? then.unit : rescale.unit,
    });
  });

  const selfReported = payload.figures.flatMap((figure, index) => {
    if (figure.kind !== "self-reported") return [];
    const metric = metricById.get(figure.metric_id);
    if (metric === undefined) return [];
    return [
      {
        key: `${figure.metric_id}-${index}`,
        name: metric.display_name,
        figure,
      },
    ];
  });

  return (
    <section className={styles.figuresThenNow}>
      <h2 tabIndex={-1} data-figures-heading="">{REVEAL_COPY.stage3Title}</h2>

      {anyFixture ? <FixtureNote /> : null}

      {entries.map((entry, index) => {
        // The first card of the Stage carries the primary control (C3, P4.1).
        const primary = primaryCard && index === 0;
        const answer = {
          markValue: entry.answerValue,
          unit: entry.answerUnit,
        };
        const thenRow = receiptFigureOf(
          entry.then,
          "then",
          letterKind,
          entry.rescale,
        );

        if (entry.now === undefined) {
          // No now figure: the sealed then figure, and the A3 message in place
          // of the now row. No Number_Line and no change line (issue #250).
          return (
            <div key={entry.key} className={styles.figureGroup} data-figure-entry="">
              <ReceiptCard
                name={entry.name}
                region={entry.then.region}
                markValue={answer.markValue}
                sample={entry.sample}
                unit={answer.unit}
                then={thenRow}
                now={{ message: entry.nowMissing }}
                primary={primary}
                source={receiptSourceOf(entry.then, entry.seriesName)}
              />
            </div>
          );
        }

        if (entry.kind === "single") {
          // Single_Figure_View (spec 12 Z2): the sealed figure and its own
          // nothing-to-compare line. No now row, no Number_Line, no change.
          // The card does not draw `now`, so it gets an empty message.
          return (
            <div key={entry.key} className={styles.figureGroup} data-figure-entry="">
              <ReceiptCard
                name={entry.name}
                region={entry.then.region}
                markValue={answer.markValue}
                sample={entry.sample}
                unit={answer.unit}
                then={thenRow}
                now={{ message: null }}
                primary={primary}
                source={receiptSourceOf(entry.then, entry.seriesName)}
                single
              />
            </div>
          );
        }

        if (entry.change !== undefined && entry.change.comparable) {
          // Comparable: the Receipt_Card with the Number_Line and the change
          // line (FigureEntry, C3.1).
          return (
            <div key={entry.key} className={styles.figureGroup} data-figure-entry="">
              <FigureEntry
                name={entry.name}
                seriesName={entry.seriesName}
                then={entry.then}
                now={entry.now}
                change={entry.change}
                rescale={entry.rescale}
                letterKind={letterKind}
                markValue={entry.markValue}
                sample={entry.sample}
                nowNote={entry.nowNote ?? undefined}
                primary={primary}
              />
            </div>
          );
        }

        // Not comparable: both figures with their own periods and sources, plus
        // the one neutral reason sentence for the first failing check. No
        // Number_Line and no change line.
        const reason =
          entry.change !== undefined && !entry.change.comparable
            ? REVEAL_COPY.reason[entry.change.reason]
            : undefined;
        return (
          <div key={entry.key} className={styles.figureGroup} data-figure-entry="">
            <ReceiptCard
              name={entry.name}
              region={entry.then.region}
              markValue={answer.markValue}
              sample={entry.sample}
              unit={answer.unit}
              then={thenRow}
              now={receiptFigureOf(entry.now, "now", letterKind, entry.rescale)}
              nowNote={entry.nowNote ?? undefined}
              primary={primary}
              source={receiptSourceOf(entry.then, entry.seriesName)}
              nowSource={receiptSourceOf(entry.now, entry.seriesName)}
              change={
                <>
                  <p className={styles.period}>{REVEAL_COPY.notComparable}</p>
                  {reason === undefined ? null : (
                    <p className={styles.period}>{reason}</p>
                  )}
                </>
              }
            />
          </div>
        );
      })}

      {selfReported.length === 0 ? null : (
        <section
          className={styles.selfReportedGroup}
          data-self-reported-group=""
        >
          <h3 className={styles.selfReportedHeading}>
            {REVEAL_COPY.selfReportedTitle}
          </h3>
          <p className={styles.period}>{REVEAL_COPY.selfReportedHint}</p>
          {selfReported.map((entry) => (
            <div key={entry.key} className={styles.figureGroup}>
              <SelfReportedFigure
                name={entry.name}
                figure={entry.figure}
              />
            </div>
          ))}
        </section>
      )}
    </section>
  );
}

/**
 * Stage 3 for a letter whose only figures are self-reported (spec L5.1). There
 * is no official figure, so no Figures_API request is made and no "The receipts"
 * heading is drawn: the section holds only "Your own numbers". Its heading is
 * the Figures_Heading, so focus moves there when stage 3 opens. Each group
 * carries `data-figure-entry` so the fade-up runs as it does for official
 * figures.
 */
export function SelfReportedOnly({ payload }: { payload: PayloadV1 }) {
  const metricById = new Map<string, MetricDefinitionV1>();
  for (const metric of payload.metrics) {
    metricById.set(metric.id, metric);
  }

  const entries = payload.figures.flatMap((figure, index) => {
    if (figure.kind !== "self-reported") return [];
    const metric = metricById.get(figure.metric_id);
    if (metric === undefined) return [];
    return [
      {
        key: `${figure.metric_id}-${index}`,
        name: metric.display_name,
        figure,
      },
    ];
  });

  if (entries.length === 0) return null;

  return (
    <section
      className={styles.selfReportedGroup}
      data-self-reported-group=""
    >
      <h3
        className={styles.selfReportedHeading}
        tabIndex={-1}
        data-figures-heading=""
      >
        {REVEAL_COPY.selfReportedTitle}
      </h3>
      <p className={styles.period}>{REVEAL_COPY.selfReportedHint}</p>
      {entries.map((entry) => (
        <div
          key={entry.key}
          className={styles.figureGroup}
          data-figure-entry=""
        >
          <SelfReportedFigure name={entry.name} figure={entry.figure} />
        </div>
      ))}
    </section>
  );
}

/**
 * One self-reported figure as the judge typed it: the name, region, value, unit
 * and period, labelled "self-reported". The value is shown exactly as typed
 * (data-integrity.md). There is no now figure, no change and no Number_Line
 * (spec 08 later-tasks, R26.6). Every typed field carries data-user-content.
 */
function SelfReportedFigure({
  name,
  figure,
}: {
  name: string;
  figure: Readonly<FigureV1>;
}) {
  return (
    <section
      className={styles.fig}
      aria-label={`${name}, ${figure.region}`}
      data-self-reported=""
    >
      <h4 className={styles.figName}>
        <span data-user-content="">{name}</span> ·{" "}
        <span data-user-content="">{figure.region}</span>
      </h4>
      <p className={styles.figRow} data-self-reported-row="">
        <span className={styles.rowLabel}>{REVEAL_COPY.then}:</span>{" "}
        <span className={styles.valueLine}>
          <span
            className={styles.figValue}
            style={{ fontSize: FIG_VALUE_SIZE }}
            data-user-content=""
          >
            {figure.value}
          </span>{" "}
          <span data-user-content="">{figure.unit}</span>
        </span>{" "}
        <span className={styles.metaLine}>
          <span className={styles.period} data-user-content="">
            {formatPeriod(figure.period, figure.region)}
          </span>
          {" · "}
          <span className={styles.period}>
            {REVEAL_COPY.labelSelfReported}
          </span>
        </span>
      </p>
    </section>
  );
}
