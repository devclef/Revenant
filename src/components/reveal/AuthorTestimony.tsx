import type { RecallRecordV1, RecallRecordV2 } from "@/lib/recall";
import type { RecallQuestion, TestimonyEntry } from "./opening-machine";
import { ClampedAnswer } from "./ClampedAnswer";
import { REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

/**
 * The Author_Testimony (spec 10 C8.2 to C8.8; spec 11 P4.2): the questions the
 * author wrote for their future self, each followed by "What you said just now"
 * and the Text_Answer as recorded, clamped to two lines with a show-full control
 * (ClampedAnswer), or "No answer". It sits in the `letter`
 * Stage above the paper and outside it (C4.9).
 *
 * Only Author_Questions (`answer_type: "text"`) appear here, in payload order.
 * With no text question the component renders nothing, so a letter without
 * Author_Questions shows no block and no empty heading (C8.6).
 *
 * The question text and the answer are the judge's own words. They are React
 * text nodes inside `data-user-content` elements, never HTML, and line breaks
 * are kept by `white-space: pre-wrap` (Property 19). The heading takes focus
 * from the Skip control (C6.5), so it carries `tabIndex={-1}`.
 *
 * The component reads no clock, holds no state and never grades or compares the
 * answer with the letter (neutrality.md). Every string comes from copy.ts.
 */

export type AuthorTestimonyProps = {
  /** The sealed recall questions, in payload order. */
  questions: readonly RecallQuestion[];
  /**
   * The stored recall record: the judge's answers, keyed by question ID. Null
   * on the Text_Persona walk, which stores no record (spec 11 P1.5).
   */
  record: RecallRecordV1 | RecallRecordV2 | null;
  /**
   * The Text_Persona's testimony, one entry per question in order. Set only on
   * the walk, where it stands in for `record`. Each entry is shown with
   * `answerLabel`.
   */
  testimony?: readonly TestimonyEntry[];
  /** The label above each answer. Defaults to "What you said just now". */
  answerLabel?: string;
  /** The heading. Defaults to "Questions you left for yourself". */
  title?: string;
};

export function AuthorTestimony({
  questions,
  record,
  testimony,
  answerLabel,
  title,
}: AuthorTestimonyProps) {
  const label = answerLabel ?? REVEAL_COPY.saidJustNow;
  const heading = title ?? REVEAL_COPY.authorTestimonyTitle;

  // The Text_Persona path: her entries, in order, labelled as fictional.
  if (testimony !== undefined) {
    if (testimony.length === 0) return null;
    return (
      <section className={styles.authorTestimony} data-author-testimony="">
        <h2
          tabIndex={-1}
          className={styles.authorTestimonyHeading}
          data-author-testimony-heading=""
        >
          {heading}
        </h2>
        {testimony.map((entry, index) => (
          <div key={index} className={styles.authorTestimonyItem}>
            <p className={styles.authorTestimonyQuestion} data-user-content="">
              {entry.question}
            </p>
            <p className={styles.authorTestimonyLabel}>{label}</p>
            <ClampedAnswer
              text={entry.answer}
              as="p"
              className={styles.authorTestimonyAnswer}
            />
          </div>
        ))}
      </section>
    );
  }

  const textQuestions = questions.filter(
    (question) => question.answer_type === "text",
  );
  if (textQuestions.length === 0 || record === null) {
    return null;
  }

  // The stored answer for each question, keyed by question ID.
  const answerByQuestionId = new Map(
    record.answers.map((answer) => [answer.question_id, answer] as const),
  );

  return (
    <section className={styles.authorTestimony} data-author-testimony="">
      <h2
        tabIndex={-1}
        className={styles.authorTestimonyHeading}
        data-author-testimony-heading=""
      >
        {heading}
      </h2>

      {textQuestions.map((question) => {
        const answer = answerByQuestionId.get(question.id);
        return (
          <div key={question.id} className={styles.authorTestimonyItem}>
            <p
              className={styles.authorTestimonyQuestion}
              data-user-content=""
            >
              {question.text}
            </p>
            <p className={styles.authorTestimonyLabel}>{label}</p>
            {answer !== undefined && answer.kind === "text" ? (
              <ClampedAnswer
                text={answer.value}
                as="p"
                className={styles.authorTestimonyAnswer}
              />
            ) : (
              <p className={styles.authorTestimonyAnswer}>
                {REVEAL_COPY.noAnswer}
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}
