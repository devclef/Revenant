import { answerText } from "@/components/ceremony/recall/answer-text";
import { ClampedAnswer } from "./ClampedAnswer";
import { REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

/**
 * The Answer_List (spec 09 A9, C4.1, P6.4; spec 10 C6.10; spec 11 P4.2): the
 * judge's recorded answers as a compact text list, Author_Questions first. It
 * takes items of two kinds:
 *
 * - `text`: an Author_Question and the free-text answer the judge gave (or "No
 *   answer"). The question and the answer are the judge's own content, so each
 *   carries `data-user-content`. The answer is clamped to
 *   `ANSWER_CLAMP_LINES_LETTER` lines with a show-full control (ClampedAnswer),
 *   and has a 3 px Accent left border, which marks "you" without colouring the
 *   paragraph text orange (tone.md, C8.1).
 * - `number`: a figure question, shown as the metric's name then the
 *   Answer_Text and unit, or "No answer". A Kept_Sample carries the
 *   Sample_Label (C5.8, Property 17).
 *
 * It holds nothing from inside the letter. It shows no figure value, period or
 * source next to an answer (spec 03 R3.8), so it can sit in the `marks` Stage
 * before the letter opens. The answers come in as given; a number answer is
 * shown through `answerText` and never reformatted.
 *
 * Every string comes from copy.ts (R15.1). This component holds no state and is
 * server-safe (no "use client").
 */

export type AnswerListItem =
  | {
      kind: "text";
      /** The Author_Question text, as sealed. */
      question: string;
      /** The free-text answer the judge gave, or null for "No answer". */
      answer: string | null;
      /**
       * A label shown above the answer. The Text_Persona passes the
       * Fictional_Label here (spec 11 P1.7). Absent for the judge's own answers.
       */
      label?: string;
    }
  | {
      kind: "number";
      /** The metric's display name, from the sealed payload. */
      name: string;
      /** The answer in the shown unit, or `undefined` for "No answer". */
      markValue?: string;
      /** The unit shown with the answer. */
      unit: string;
      /** Whether this answer is a Kept_Sample (spec 10 C5.8). */
      sample?: boolean;
    };

export type AnswerListProps = {
  /** One entry per recall question, Author_Questions first (payload order). */
  items: readonly AnswerListItem[];
};

export function AnswerList({ items }: AnswerListProps) {
  return (
    <ul className={styles.answerList} data-answer-list="">
      {items.map((item, index) =>
        item.kind === "text" ? (
          <li key={index} className={styles.answerTextItem}>
            <span className={styles.answerQuestion} data-user-content="">
              {item.question}
            </span>
            {item.label === undefined ? null : (
              <span className={styles.answerLabel}>{item.label}</span>
            )}
            {item.answer === null ? (
              <span className={styles.answerValue}>{REVEAL_COPY.noAnswer}</span>
            ) : (
              <ClampedAnswer
                text={item.answer}
                as="span"
                className={styles.answerText}
              />
            )}
          </li>
        ) : (
          <li key={index} className={styles.answerItem}>
            <span className={styles.answerName}>{item.name}</span>
            <span className={styles.answerValue}>
              {item.markValue === undefined
                ? REVEAL_COPY.noAnswer
                : `${answerText(item.markValue)} ${item.unit}`}
              {item.sample ? (
                <span className={styles.sampleLabel}> {REVEAL_COPY.sampleLabel}</span>
              ) : null}
            </span>
          </li>
        ),
      )}
    </ul>
  );
}
