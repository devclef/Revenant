import type { ReactNode } from "react";
import { answerText } from "@/components/ceremony/recall/answer-text";
import { FIG_VALUE_SIZE } from "@/components/ceremony/constants";
import { REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

/**
 * The Receipt_Card (spec 09 C3): one card per metric, shared by every branch
 * of the figures Stage. It renders these rows, top to bottom (C3.1):
 *
 * 1. the metric's name and region;
 * 2. "Your answer", once, with the answer and its unit, or "No answer";
 * 3. "Then", the then value, unit, period, region and provenance label;
 * 4. "Now", the now value in the same type style as "Then", or the A3 message
 *    in place of the now row when no comparable now figure exists;
 * 5. the Number_Line (passed in as `numberLine`, absent when there is none);
 * 6. the change line and formula (passed in as `change`, absent when there is
 *    none);
 * 7. the source control: the source, the series ID and the link to check the
 *    figure at its source.
 *
 * Both values share one class and one size (C3.2), so a rise and its
 * mirror-image fall differ only in the text the change line prints. The card
 * never names a difference, distance or grade between the answer and a figure
 * (C3.6).
 *
 * Every value passed in is already formatted and already rescaled for display
 * by the caller. This component computes no number and holds no state.
 * Every string comes from copy.ts (R15.1).
 */

/** One sealed figure as shown in the Then or Now row. */
export type ReceiptFigure = {
  /** The value as shown to the reader, already formatted. */
  value: string;
  /** The unit shown with the value. */
  unit: string;
  /** The figure's period, already formatted for its region. */
  period: string;
  /** The region the figure covers. */
  region: string;
  /** The provenance label, for example "historical record, retrieved …". */
  label: string;
  /** A note shown after the row, for example a display rescale note. */
  note?: string;
};

/** The source control at the foot of the card. */
export type ReceiptSource = {
  /** The publisher and source name, as sealed. */
  source: string;
  /** The series identifier, as sealed. */
  seriesId: string;
  /** A link to check the figure at its source, when one was sealed. */
  sourceUrl?: string;
};

export type ReceiptCardProps = {
  /** The metric's display name, from the sealed payload. */
  name: string;
  /** The region the metric covers, shown in the card heading. */
  region: string;
  /** The judge's answer in the shown unit, or `undefined` for "No answer". */
  markValue?: string;
  /** True when the answer is a Kept_Sample: the label shows after it (C5.8). */
  sample?: boolean;
  /** The unit shown with the answer. */
  unit: string;
  /** The then figure row. */
  then: ReceiptFigure;
  /**
   * The now figure row, or a message in place of it (A3). A message shows the
   * text in the now row's position and nothing else for the now figure.
   */
  now: ReceiptFigure | { message: string | null };
  /** A line under the now row, for a bundled fallback figure (A3.3). */
  nowNote?: string;
  /** The Number_Line, or `undefined` when the card has none. */
  numberLine?: ReactNode;
  /** The change line and formula, or `undefined` when the card has none. */
  change?: ReactNode;
  /** The source control. */
  source: ReceiptSource;
  /**
   * A second source control for the now figure, shown only when the now figure
   * comes from a different source (a not-comparable pair). Absent for a
   * comparable pair, whose two figures share one series.
   */
  nowSource?: ReceiptSource;
  /** Marks the card's primary control for the layout checks (data-primary-control). */
  primary?: boolean;
};

function isMessage(
  now: ReceiptFigure | { message: string | null },
): now is { message: string | null } {
  return "message" in now;
}

function SourceControl({ source }: { source: ReceiptSource }) {
  return (
    <details className={styles.src}>
      <summary>{REVEAL_COPY.sourceSummary}</summary>
      <p>{source.source}</p>
      <p>
        {REVEAL_COPY.seriesLabel}: {source.seriesId}
      </p>
      {source.sourceUrl === undefined ? null : (
        <p>
          <a href={source.sourceUrl} rel="noreferrer noopener" target="_blank">
            {REVEAL_COPY.checkAtSource}
          </a>
        </p>
      )}
    </details>
  );
}

/**
 * One Then or Now row. Both roles render through this function, so they share
 * one element structure, one class and one size (C3.2).
 */
export function FigureRow({
  role,
  figure,
}: {
  role: "then" | "now";
  figure: ReceiptFigure;
}) {
  const roleLabel = role === "then" ? REVEAL_COPY.then : REVEAL_COPY.now;
  return (
    <p className={styles.figRow} data-receipt-row={role}>
      <span className={styles.rowLabel}>{roleLabel}:</span>{" "}
      <span className={styles.valueLine}>
        <span
          className={styles.figValue}
          style={{ fontSize: FIG_VALUE_SIZE }}
          data-role={role}
        >
          {figure.value}
        </span>{" "}
        <span>{figure.unit}</span>
      </span>{" "}
      <span className={styles.metaLine}>
        <span className={styles.period}>{figure.period}</span>
        {" · "}
        <span className={styles.region}>{figure.region}</span>
        {" · "}
        <span className={styles.fixtureLabel}>{figure.label}</span>
        {figure.note === undefined ? null : (
          <span className={styles.period}> · {figure.note}</span>
        )}
      </span>
    </p>
  );
}

export function ReceiptCard({
  name,
  region,
  markValue,
  sample = false,
  unit,
  then,
  now,
  nowNote,
  numberLine,
  change,
  source,
  nowSource,
  primary = false,
}: ReceiptCardProps) {
  const answer =
    markValue === undefined
      ? REVEAL_COPY.noAnswer
      : `${answerText(markValue)} ${unit}`;

  return (
    <section
      className={styles.fig}
      aria-label={`${name}, ${region}`}
      data-receipt-card=""
      data-primary-control={primary ? "" : undefined}
    >
      <h3 className={styles.figName}>
        {name} · {region}
      </h3>

      <div className={styles.yourAnswer} data-your-answer="">
        <span className={styles.yourAnswerLabel}>{REVEAL_COPY.yourAnswer}</span>
        <span className={styles.yourAnswerValue}>
          {answer}
          {sample ? (
            <span className={styles.sampleLabel} data-sample-label="">
              {" "}
              {REVEAL_COPY.sampleLabel}
            </span>
          ) : null}
        </span>
      </div>

      <FigureRow role="then" figure={then} />

      {isMessage(now) ? (
        <>
          <p className={styles.figRow} data-receipt-row="now">
            <span className={styles.rowLabel}>{REVEAL_COPY.now}:</span>
          </p>
          {now.message === null ? null : (
            <p className={styles.period} data-receipt-message="">
              {now.message}
            </p>
          )}
        </>
      ) : (
        <FigureRow role="now" figure={now} />
      )}

      {nowNote === undefined ? null : (
        <p className={styles.period}>{nowNote}</p>
      )}

      {numberLine}

      {change}

      <SourceControl source={source} />
      {nowSource === undefined ? null : <SourceControl source={nowSource} />}
    </section>
  );
}
