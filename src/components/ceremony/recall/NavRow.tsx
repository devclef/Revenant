/**
 * The Nav_Row under a recall question (spec 14, T1.5 and T2.2). "Previous
 * question" sits on the left from question 2 on. The main button ("Next
 * question", or the submit label on the last question) sits on the right on
 * every question, including question 1. On question 1 an empty span holds the
 * left slot, so the main button stays on the right.
 *
 * The main button calls `onMain` on click. It is not a submit button, because
 * the pager's form already decides what a submit means. The pager passes a
 * handler that asks the form to submit, so Enter and the button share one path.
 */

import { REVEAL_COPY } from "@/components/reveal/copy";
import buttons from "@/components/ui/buttons.module.css";
import styles from "./NavRow.module.css";

export type NavRowProps = {
  /** True from question 2 on (index > 0). Question 1 has no Previous control. */
  showPrevious: boolean;
  /** Moves to the previous question. */
  onPrevious: () => void;
  /** The main button's label: next, submit, or submitting. */
  mainLabel: string;
  /** True while the main action cannot run (for example, a post is in flight). */
  mainDisabled: boolean;
  /** Runs the main action (advance, or submit on the last question). */
  onMain: () => void;
};

export function NavRow({
  showPrevious,
  onPrevious,
  mainLabel,
  mainDisabled,
  onMain,
}: NavRowProps) {
  return (
    <div className={styles.navRow} data-nav-row="">
      {showPrevious ? (
        <button type="button" className={styles.previous} onClick={onPrevious}>
          {REVEAL_COPY.previousQuestion}
        </button>
      ) : (
        <span className={styles.placeholder} aria-hidden="true" />
      )}
      <button
        type="button"
        className={buttons.primary}
        disabled={mainDisabled}
        onClick={onMain}
      >
        {mainLabel}
      </button>
    </div>
  );
}
