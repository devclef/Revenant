"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  AUTHOR_QUESTIONS_MAX,
  focusAfterRemove,
  type FocusAfterRemove,
} from "../author-questions";
import { LIVE_COPY } from "../copy";
import letterField from "../letter-field.module.css";

import { DESK_COPY } from "./copy";
import { QuestionRow } from "./QuestionRow";
import styles from "./question-section.module.css";

export interface QuestionSectionProps {
  /** The question rows as typed, 0 to 3 of them, in order. */
  questions: readonly string[];
  /** Indices of rows over 200 code points. Their message is shown (W7.7). */
  tooLongIndices?: readonly number[];
  /**
   * True when the Write_Check reports nothing to testify, after the rows or
   * receipts were touched or the Fold_Button was pressed (W6.5). The line shows
   * here and nowhere else.
   */
  nothingToTestify?: boolean;
  /** Called with the row index and its new text on every change. */
  onChange: (index: number, text: string) => void;
  /** Called with the row index when its Remove control is pressed. */
  onRemove: (index: number) => void;
  /**
   * The suggestion pills (spec 14, W8). Shown under the rows while fewer than
   * three rows exist, and always rendered in the pills area, so the area is
   * there even with no rows (W6.6). With three rows the limit line shows instead.
   */
  pills?: ReactNode;
}

/**
 * The P.S. Question_Section on the Letter_Sheet (spec 14, W6 and W7): a fieldset
 * with the legend, the intro, the Question_Rows 22 px apart, the
 * nothing-to-testify line, and the pills area. Removing a row moves focus as
 * spec 13 W4.3 states (focusAfterRemove).
 */
export function QuestionSection({
  questions,
  tooLongIndices = [],
  nothingToTestify = false,
  onChange,
  onRemove,
  pills,
}: QuestionSectionProps) {
  const inputRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());
  const pillsRef = useRef<HTMLDivElement | null>(null);
  // Where focus goes after the next render: the row that takes over after a
  // removal, or the first pill when no row remains.
  const [pendingFocus, setPendingFocus] = useState<FocusAfterRemove | null>(
    null,
  );
  // The removal announced to screen readers.
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (pendingFocus === null) return;
    if (pendingFocus.kind === "row") {
      inputRefs.current.get(pendingFocus.index)?.focus();
    } else {
      pillsRef.current?.querySelector("button")?.focus();
    }
    setPendingFocus(null);
  }, [pendingFocus, questions.length]);

  function pressRemove(index: number) {
    setAnnouncement(
      LIVE_COPY.authorQuestionRemoved.replace("{n}", String(index + 1)),
    );
    setPendingFocus(focusAfterRemove(questions.length, index));
    onRemove(index);
  }

  const showPills = questions.length < AUTHOR_QUESTIONS_MAX;

  return (
    <fieldset className={styles.questions} data-question-section="">
      <legend className={`${styles.legend} ${letterField.sheetSerif}`}>
        {DESK_COPY.psLegend}
      </legend>
      <p className={styles.intro}>{DESK_COPY.psIntro}</p>

      <ol className={styles.rows}>
        {questions.map((text, index) => (
          <QuestionRow
            key={index}
            index={index}
            text={text}
            problem={
              tooLongIndices.includes(index)
                ? LIVE_COPY.questionTooLong
                : undefined
            }
            onChange={(next) => onChange(index, next)}
            onRemove={() => pressRemove(index)}
            inputRef={(el) => {
              if (el) inputRefs.current.set(index, el);
              else inputRefs.current.delete(index);
            }}
          />
        ))}
      </ol>

      {nothingToTestify ? (
        <p id="live-figures-problem" className={styles.problem}>
          {LIVE_COPY.nothingToTestify}
        </p>
      ) : null}

      <div ref={pillsRef} className={styles.pills} data-pills-area="">
        {showPills ? (
          pills
        ) : (
          <p className={styles.limit}>{DESK_COPY.questionsFull}</p>
        )}
      </div>

      <p role="status" aria-live="polite" className={styles.visuallyHidden}>
        {announcement}
      </p>
    </fieldset>
  );
}
