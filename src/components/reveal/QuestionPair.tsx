import styles from "./receipts.module.css";

/**
 * One author question on the receipts column (spec 15 R12.2). It shows the
 * question as written, the reader's testimony beside the answer sealed with it,
 * in that order, with no comment on the difference (R12.3).
 *
 * - The question as written sits on a paper panel with its own --ink.
 * - The testimony sits on the desk with the orange rule: it is the reader's own.
 * - The sealed answer sits on a paper panel. A version 1 letter has no sealed
 *   answer, so it shows "No answer was sealed with this question."
 *
 * The component computes nothing, holds no state and never scores or highlights
 * the gap between the testimony and the sealed answer (neutrality.md). Every
 * string comes from the caller, which reads copy.ts.
 */

export type QuestionPairProps = {
  /** The question as the author wrote it. */
  question: string;
  /** The label above the question (for example "Your question, as you wrote it"). */
  questionLabel: string;
  /** The reader's testimony, already chosen by the caller (`testimonyTextOf`). */
  testimony: string;
  /** The label above the testimony. */
  testimonyLabel: string;
  /** The answer sealed with the question, or undefined on a version 1 letter. */
  sealedAnswer: string | undefined;
  /** The label above the sealed answer, with its date already filled in. */
  sealedLabel: string;
  /** Shown instead of the sealed answer when there is none. */
  noSealedAnswer: string;
  /**
   * True for a live letter, whose words are the reader's own. They carry
   * `data-user-content`. A persona's words do not.
   */
  userContent?: boolean;
};

export function QuestionPair({
  question,
  questionLabel,
  testimony,
  testimonyLabel,
  sealedAnswer,
  sealedLabel,
  noSealedAnswer,
  userContent = true,
}: QuestionPairProps) {
  const userMarker = userContent ? "" : undefined;
  return (
    <article className={styles.pair} data-question-pair="">
      <div className={styles.paper} data-question-paper="">
        <span className={styles.tag}>{questionLabel}</span>
        <p className={styles.question} data-user-content={userMarker}>
          {question}
        </p>
      </div>

      <div className={styles.testimony} data-question-testimony="">
        <span className={`${styles.tag} ${styles.testimonyTag}`}>
          {testimonyLabel}
        </span>
        <p className={styles.answer} data-user-content={userMarker}>
          {testimony}
        </p>
      </div>

      <div className={styles.paper} data-question-sealed="">
        <span className={styles.tag}>{sealedLabel}</span>
        {sealedAnswer === undefined ? (
          <p className={styles.answer}>{noSealedAnswer}</p>
        ) : (
          <p className={styles.answer} data-user-content={userMarker}>
            {sealedAnswer}
          </p>
        )}
      </div>
    </article>
  );
}
