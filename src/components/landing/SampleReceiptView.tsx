// Feature: 09-demo-polish (B3.4, B3.7)
//
// The Sample_Receipt's view: one real figure with its full provenance, or the
// receiptNone line. It shows no change and no arrow, and no Accent on any
// figure element (orange means "you", tone.md). Server-renderable; the client
// wrapper in SampleReceipt.tsx supplies the state.

import { REVEAL_COPY } from "@/components/reveal/copy";
import { formatLetterDate } from "@/components/ui/letter-date";
import { isFixtureFigure } from "@/lib/figures/fixture";
import { formatPeriod, formatValue } from "@/lib/figures/format-change";
import type { FigureV1 } from "@/lib/seal-format";

import { LANDING_SECTION_COPY } from "./copy";
import type { SampleState } from "./sample-receipt";
import styles from "./landing.module.css";

export function SampleReceiptView({ state }: { state: SampleState }) {
  return (
    <section className={styles.section} aria-labelledby="receipt-title">
      <h2 id="receipt-title" className={styles.sectionTitle}>
        {LANDING_SECTION_COPY.receiptTitle}
      </h2>
      <div className={styles.receiptBox} data-block="sample-receipt" aria-live="polite">
        {state.status === "ready" ? (
          <ReceiptFigure
            metricName={state.metric.display_name}
            figure={state.figure}
            fallback={state.fallback}
          />
        ) : state.status === "none" ? (
          <p className={styles.body}>{LANDING_SECTION_COPY.receiptNone}</p>
        ) : null}
      </div>
    </section>
  );
}

type ReceiptFigureProps = {
  metricName: string;
  figure: FigureV1;
  fallback: boolean;
};

function ReceiptFigure({ metricName, figure, fallback }: ReceiptFigureProps) {
  const retrieved = formatLetterDate(figure.retrieved_at, { kind: "utc" });
  const sourceUrl = figure.kind === "official" ? figure.source_url : undefined;

  return (
    <>
      {isFixtureFigure(figure) ? (
        <p className={styles.receiptFixture}>{REVEAL_COPY.labelFixtureData}</p>
      ) : null}
      <p className={styles.receiptName}>{metricName}</p>
      <p className={styles.receiptValueLine}>
        <span className={styles.receiptValue}>
          {formatValue(figure.value, figure.region)}
        </span>{" "}
        <span className={styles.receiptUnit}>{figure.unit}</span>
      </p>
      <p className={styles.receiptMeta}>
        {formatPeriod(figure.period, figure.region)} · {figure.region}
      </p>
      <dl className={styles.receiptDetails}>
        <dt>{LANDING_SECTION_COPY.receiptSource}</dt>
        <dd>{figure.source}</dd>
        <dt>{LANDING_SECTION_COPY.receiptSeries}</dt>
        <dd>{figure.series_id}</dd>
        <dt>{LANDING_SECTION_COPY.receiptRetrieved}</dt>
        <dd>{retrieved}</dd>
      </dl>
      {sourceUrl === undefined ? null : (
        <a
          className={styles.receiptLink}
          href={sourceUrl}
          rel="noreferrer noopener"
          target="_blank"
        >
          {LANDING_SECTION_COPY.receiptCheck}
        </a>
      )}
      {fallback ? (
        <p className={styles.receiptNote}>
          {REVEAL_COPY.fallbackNote.replace("{date}", retrieved)}
        </p>
      ) : null}
    </>
  );
}
