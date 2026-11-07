import { answerText } from "@/components/ceremony/recall/answer-text";
import { REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

/**
 * The Answer_List (spec 09 A9, C4.1, P6.4): the judge's recorded answers as a
 * compact text list. It shows, for each answer, the metric's name, then the
 * Answer_Text and unit, or "No answer".
 *
 * It holds nothing from inside the letter. It shows no figure value, period or
 * source next to an answer (spec 03 R3.8), so it can sit in the `marks` Stage
 * before the letter opens. The answers come in as given; each one is shown
 * through `answerText` and never reformatted.
 *
 * Every string comes from copy.ts (R15.1). This component holds no state.
 */

export type AnswerListItem = {
  /** The metric's display name, from the sealed payload. */
  name: string;
  /** The answer in the shown unit, or `undefined` for "No answer". */
  markValue?: string;
  /** The unit shown with the answer. */
  unit: string;
};

export type AnswerListProps = {
  /** One entry per recall question, in payload order. */
  items: readonly AnswerListItem[];
};

export function AnswerList({ items }: AnswerListProps) {
  return (
    <ul className={styles.answerList} data-answer-list="">
      {items.map((item, index) => (
        <li key={index} className={styles.answerItem}>
          <span className={styles.answerName}>{item.name}</span>
          <span className={styles.answerValue}>
            {item.markValue === undefined
              ? REVEAL_COPY.noAnswer
              : `${answerText(item.markValue)} ${item.unit}`}
          </span>
        </li>
      ))}
    </ul>
  );
}
