"use client";

import { useEffect, useId, useRef, useState } from "react";

import { AUTHOR_QUESTIONS_MAX } from "./author-questions";
import { LIVE_COPY } from "./copy";
import styles from "./live.module.css";

export interface AuthorQuestionsProps {
  /** The rows as typed, 0 to 3 of them, in order. */
  questions: readonly string[];
  /** Indices of rows over 200 code points. Their message is shown. */
  tooLongIndices?: readonly number[];
  /** Adds an empty row. Only offered while fewer than 3 rows exist. */
  onAdd: () => void;
  onChange: (index: number, text: string) => void;
  onRemove: (index: number) => void;
}

/** Replaces `{n}` in a copy string with a number. */
const withNumber = (template: string, n: number): string =>
  template.replace("{n}", String(n));

/**
 * The Author_Question rows on the Write step (spec 10, C2.1 to C2.5). Each row
 * is a text field with a visible label and a remove button. The Question
 * Starters retired in spec 11 (L2.7), so only Add moves focus to a new row.
 */
export function AuthorQuestions({
  questions,
  tooLongIndices = [],
  onAdd,
  onChange,
  onRemove,
}: AuthorQuestionsProps) {
  const baseId = useId();
  const inputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  // The row to focus after the next render, set by Add.
  const [pendingFocus, setPendingFocus] = useState<number | null>(null);

  useEffect(() => {
    if (pendingFocus === null) return;
    inputRefs.current.get(pendingFocus)?.focus();
    setPendingFocus(null);
  }, [pendingFocus, questions.length]);

  function pressAdd() {
    setPendingFocus(questions.length);
    onAdd();
  }

  const canAdd = questions.length < AUTHOR_QUESTIONS_MAX;

  return (
    <fieldset className={styles.field}>
      <legend className={styles.legend}>
        {LIVE_COPY.authorQuestionsLegend}
      </legend>
      {questions.map((text, index) => {
        const n = index + 1;
        const inputId = `${baseId}-q${index}`;
        const problemId = `${baseId}-q${index}-problem`;
        const isTooLong = tooLongIndices.includes(index);
        return (
          <div
            key={index}
            className={styles.questionRow}
            {...(text !== LIVE_COPY.livePrefill
              ? { "data-user-content": "" }
              : {})}
          >
            <div className={styles.questionHead}>
              <label htmlFor={inputId} className={styles.label}>
                {withNumber(LIVE_COPY.authorQuestionLabel, n)}
              </label>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => onRemove(index)}
              >
                {withNumber(LIVE_COPY.authorQuestionRemove, n)}
              </button>
            </div>
            <input
              id={inputId}
              type="text"
              className={styles.textarea}
              value={text}
              aria-describedby={isTooLong ? problemId : undefined}
              aria-invalid={isTooLong || undefined}
              ref={(el) => {
                if (el) inputRefs.current.set(index, el);
                else inputRefs.current.delete(index);
              }}
              onChange={(event) => onChange(index, event.target.value)}
            />
            {isTooLong ? (
              <p id={problemId} className={styles.problem}>
                {LIVE_COPY.questionTooLong}
              </p>
            ) : null}
          </div>
        );
      })}

      {canAdd ? (
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={pressAdd}>
            {LIVE_COPY.authorQuestionAdd}
          </button>
        </div>
      ) : null}

      <p className={styles.hint}>{LIVE_COPY.authorQuestionsHint}</p>
    </fieldset>
  );
}
