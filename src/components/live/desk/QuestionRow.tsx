"use client";

import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  type RefObject,
} from "react";

import letterField from "../letter-field.module.css";
import { LIVE_COPY } from "../copy";

import { DESK_COPY } from "./copy";
import { LockIcon, PencilIcon } from "./icons";
import { WaxDisc } from "./WaxDisc";
import styles from "./question-section.module.css";

export interface QuestionRowProps {
  /** The row's place in the list, starting at 0. The number shown is index + 1. */
  index: number;
  /** The question as typed. */
  text: string;
  /** The row's problem message, or undefined when the row is fine (W7.7). */
  problem?: string;
  /** The author's answer to this question (spec 15, R7.1). */
  answer?: string;
  /** The answer's problem message (spec 15, R7.3), or undefined when fine. */
  answerProblem?: string;
  /** Called with the new answer text on every change. */
  onAnswerChange?: (text: string) => void;
  /** Called with the new text on every change. */
  onChange: (text: string) => void;
  /** Called when the Remove control is pressed. */
  onRemove: () => void;
  /** Optional ref to the textarea, for focus from the parent (W8.4, W7.6). */
  inputRef?:
    | RefObject<HTMLTextAreaElement | null>
    | ((el: HTMLTextAreaElement | null) => void);
}

/** Replaces `{n}` in a copy string with a number. */
const withNumber = (template: string, n: number): string =>
  template.replace("{n}", String(n));

/**
 * Sets the textarea to the height of its text (W7.3). The reset to `auto` lets
 * it shrink when text is deleted. The border is added back because the height
 * is border-box.
 */
function fitHeight(el: HTMLTextAreaElement): void {
  el.style.height = "auto";
  const border = el.offsetHeight - el.clientHeight;
  el.style.height = `${el.scrollHeight + border}px`;
}

/**
 * One question on the P.S. Question_Section (spec 14, W7). It is an `li` with
 * the wax disc, a one-row input that grows with its text, the Lock_Line
 * underneath and a Remove text button. The Edit control is decorative: it is
 * aria-hidden and not focusable, so it never adds a stop to the tab order.
 */
export function QuestionRow({
  index,
  text,
  problem,
  answer = "",
  answerProblem,
  onAnswerChange = () => {},
  onChange,
  onRemove,
  inputRef,
}: QuestionRowProps) {
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const answerId = `${baseId}-answer`;
  const answerProblemId = `${baseId}-answer-problem`;
  const lockId = `${baseId}-lock`;
  const problemId = `${baseId}-problem`;
  const n = index + 1;

  const ownRef = useRef<HTMLTextAreaElement | null>(null);
  const answerRef = useRef<HTMLTextAreaElement | null>(null);

  // Keeps the parent's ref and this row's own ref on the same node.
  const setRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      ownRef.current = el;
      if (typeof inputRef === "function") inputRef(el);
      else if (inputRef) inputRef.current = el;
    },
    [inputRef],
  );

  // Grow with the text. The layout effect runs before paint, so the field never
  // flashes at one line.
  useLayoutEffect(() => {
    const el = ownRef.current;
    if (el === null) return;
    fitHeight(el);
  }, [text]);

  // The answer grows with its text in the same way.
  useLayoutEffect(() => {
    const el = answerRef.current;
    if (el === null) return;
    fitHeight(el);
  }, [answer]);

  // Refit when the width changes, since a narrower row wraps the same text
  // onto more lines.
  useLayoutEffect(() => {
    const refit = () => {
      if (ownRef.current !== null) fitHeight(ownRef.current);
      if (answerRef.current !== null) fitHeight(answerRef.current);
    };
    window.addEventListener("resize", refit);
    return () => window.removeEventListener("resize", refit);
  }, []);

  // Edit focuses the field and puts the caret after the last character (W7.4).
  function focusEnd() {
    const el = ownRef.current;
    if (el === null) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
  }

  const describedBy = problem ? `${lockId} ${problemId}` : lockId;
  const answerDescribedBy = answerProblem ? answerProblemId : undefined;

  return (
    <li className={styles.row} data-question-row="">
      <WaxDisc n={n} />
      <div className={styles.qBody}>
        <label htmlFor={inputId} className={styles.visuallyHidden}>
          {withNumber(LIVE_COPY.authorQuestionLabel, n)}
        </label>
        <div className={styles.qLine}>
          <textarea
            id={inputId}
            ref={setRef}
            rows={1}
            className={`${styles.qInput} ${letterField.sheetSerif}`}
            placeholder={DESK_COPY.questionPlaceholder}
            value={text}
            aria-describedby={describedBy}
            aria-invalid={problem ? "true" : undefined}
            onChange={(event) => onChange(event.target.value)}
          />
          <span className={styles.edit} aria-hidden="true" onClick={focusEnd}>
            <PencilIcon />
            {DESK_COPY.edit}
          </span>
        </div>
        <div className={styles.answerBlock}>
          <label htmlFor={answerId} className={styles.answerLabel}>
            {DESK_COPY.answerLabel}
          </label>
          <textarea
            id={answerId}
            ref={answerRef}
            rows={1}
            className={`${styles.answerInput} ${letterField.sheetSerif}`}
            placeholder={DESK_COPY.answerPlaceholder}
            aria-label={withNumber(DESK_COPY.answerLabelFor, n)}
            data-answer-input=""
            value={answer}
            aria-describedby={answerDescribedBy}
            aria-invalid={answerProblem ? "true" : undefined}
            onChange={(event) => onAnswerChange(event.target.value)}
          />
          {answerProblem ? (
            <p id={answerProblemId} className={styles.problem}>
              {answerProblem}
            </p>
          ) : null}
        </div>
        <p id={lockId} className={styles.lock}>
          <LockIcon />
          {DESK_COPY.lockLine}
        </p>
        {problem ? (
          <p id={problemId} className={styles.problem}>
            {problem}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        className={styles.remove}
        aria-label={withNumber(LIVE_COPY.authorQuestionRemove, n)}
        onClick={onRemove}
      >
        {LIVE_COPY.authorQuestionRemoveText}
      </button>
    </li>
  );
}
