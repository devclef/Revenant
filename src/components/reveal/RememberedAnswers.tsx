"use client";

import type { Opened } from "./opening-machine";
import type { RecallRecordV1 } from "@/lib/recall";
import { REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

/**
 * Stage 1 of the reveal (R9.2, R9.3): what the judge just remembered. For each
 * sealed recall question, in payload order, it shows the question text, the
 * figure's unit (for a number question) and the judge's own answer — either the
 * decimal they typed or "No answer".
 *
 * This is the first thing shown after the encrypted record is stored, and it is
 * the ONLY stage that renders before the letter. It shows nothing from inside
 * the letter: no sealed figure, no period, no source and no comparison (R3.8).
 * Memory comes first, then the letter, then the numbers (product.md).
 *
 * The answer shown is read straight from the stored {@link RecallRecordV1}, so
 * it is exactly what was recorded, with no rounding or reformatting. A question
 * with no matching answer (which the record schema does not allow, but is
 * handled defensively) is shown as "No answer".
 *
 * Every string comes from copy.ts (R15.1). This component holds no state, reads
 * no clock, logs nothing and touches no storage.
 */

export type RememberedAnswersProps = {
  /** The opened letter; its payload holds the sealed questions and metrics. */
  opened: Opened;
  /** The stored recall record: the judge's answers, keyed by question ID. */
  record: RecallRecordV1;
};

export function RememberedAnswers({ opened, record }: RememberedAnswersProps) {
  const { payload } = opened;

  // The unit of each metric, so a number question can show the unit of the
  // figure it asked about (R8.2). The unit comes from the sealed metric
  // definition, never re-fetched.
  const unitByMetricId = new Map<string, string>();
  for (const metric of payload.metrics) {
    unitByMetricId.set(metric.id, metric.unit);
  }

  // The stored answer for each question, keyed by question ID.
  const answerByQuestionId = new Map(
    record.answers.map((answer) => [answer.question_id, answer] as const),
  );

  return (
    <section className={styles.remembered}>
      <h2>{REVEAL_COPY.stage1Title}</h2>

      <dl>
        {payload.recall_questions.map((question) => {
          const answer = answerByQuestionId.get(question.id);
          const answerText =
            answer !== undefined && answer.kind === "number"
              ? `${REVEAL_COPY.yourAnswer}: ${answer.value}`
              : REVEAL_COPY.noAnswer;

          const unit =
            question.answer_type === "number"
              ? unitByMetricId.get(question.metric_id)
              : undefined;
          const unitText =
            unit === undefined
              ? undefined
              : REVEAL_COPY.unitLabel.replace("{unit}", unit);

          return (
            <div key={question.id} className={styles.rememberedItem}>
              <dt className={styles.rememberedQuestion}>
                {question.text}
                {unitText === undefined ? null : (
                  <span className={styles.unit}> {unitText}</span>
                )}
              </dt>
              <dd className={styles.rememberedAnswer}>{answerText}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
