"use client";

import { useEffect, useId, useRef, useState } from "react";

import { DEFAULT_QUESTION } from "./occasions";
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
 * Sets a textarea to the height of its text. The reset to `auto` lets it shrink
 * when text is deleted. The border is added back because the height is
 * border-box.
 */
function fitHeight(el: HTMLTextAreaElement): void {
  el.style.height = "auto";
  const border = el.offsetHeight - el.clientHeight;
  el.style.height = `${el.scrollHeight + border}px`;
}

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
  const textareaRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());
  // The row to focus after the next render, set by Add.
  const [pendingFocus, setPendingFocus] = useState<number | null>(null);
  // The removal announced to screen readers after a row is removed.
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (pendingFocus === null) return;
    textareaRefs.current.get(pendingFocus)?.focus();
    setPendingFocus(null);
  }, [pendingFocus, questions.length]);

  // Each textarea grows with its text. Re-fit on every text change and when the
  // width changes, since a narrower row wraps the same text onto more lines.
  useEffect(() => {
    const fitAll = () => {
      for (const el of textareaRefs.current.values()) fitHeight(el);
    };
    fitAll();
    window.addEventListener("resize", fitAll);
    return () => window.removeEventListener("resize", fitAll);
  }, [questions]);

  function pressAdd() {
    setPendingFocus(questions.length);
    onAdd();
  }

  function pressRemove(index: number) {
    setAnnouncement(withNumber(LIVE_COPY.authorQuestionRemoved, index + 1));
    onRemove(index);
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
            {...(text !== DEFAULT_QUESTION
              ? { "data-user-content": "" }
              : {})}
          >
            <label htmlFor={inputId} className={styles.label}>
              {withNumber(LIVE_COPY.authorQuestionLabel, n)}
            </label>
            <textarea
              id={inputId}
              rows={1}
              className={styles.textarea}
              value={text}
              aria-describedby={isTooLong ? problemId : undefined}
              aria-invalid={isTooLong || undefined}
              ref={(el) => {
                if (el) textareaRefs.current.set(index, el);
                else textareaRefs.current.delete(index);
              }}
              onChange={(event) => onChange(index, event.target.value)}
            />
            <button
              type="button"
              className={styles.removeIcon}
              aria-label={withNumber(LIVE_COPY.authorQuestionRemove, n)}
              onClick={() => pressRemove(index)}
            >
              <span aria-hidden="true">{LIVE_COPY.removeIconGlyph}</span>
            </button>
            {isTooLong ? (
              <p id={problemId} className={styles.problem}>
                {LIVE_COPY.questionTooLong}
              </p>
            ) : null}
          </div>
        );
      })}
      <p role="status" className={styles.visuallyHidden}>
        {announcement}
      </p>

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
