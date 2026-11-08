"use client";

import { type RefObject } from "react";
import { flushSync } from "react-dom";

import { LIVE_COPY, promptStarters } from "./copy";
import styles from "./live.module.css";

/** The letter after a starter is inserted, and where the caret goes. */
export interface StarterInsertion {
  text: string;
  caret: number;
}

/**
 * Puts `starter` into `value` in place of the range `start` to `end`. An empty
 * range (start equals end) inserts at the caret. The caret lands at the end of
 * the inserted text. Out-of-range or reversed selection ends are clamped.
 */
export function insertAtSelection(
  value: string,
  start: number,
  end: number,
  starter: string,
): StarterInsertion {
  const clamp = (n: number) => Math.min(Math.max(n, 0), value.length);
  const from = clamp(Math.min(start, end));
  const to = clamp(Math.max(start, end));
  const text = value.slice(0, from) + starter + value.slice(to);
  return { text, caret: from + starter.length };
}

/**
 * The text to insert for `starter` at `from`. A single space comes first when
 * there is text before the insertion point and the character before it is not
 * whitespace, so a starter never runs into the words already in the letter.
 */
export function starterText(
  value: string,
  from: number,
  starter: string,
): string {
  const before = from > 0 ? value.charAt(from - 1) : "";
  const needsSpace = before !== "" && !/\s/.test(before);
  return needsSpace ? ` ${starter}` : starter;
}

export interface PromptStartersProps {
  /** The letter field. Read for the current value and selection. */
  fieldRef: RefObject<HTMLTextAreaElement | null>;
  /** Receives the letter with the starter inserted. */
  onInsert: (text: string) => void;
}

/**
 * Three opening sentences for the Write step (issue #269). A press inserts the
 * sentence at the caret in the letter field, replacing any selected text, then
 * puts the caret after it and returns focus to the field.
 */
export function PromptStarters({ fieldRef, onInsert }: PromptStartersProps) {
  function insert(starter: string) {
    const field = fieldRef.current;
    if (field === null) return;
    const from = Math.min(field.selectionStart, field.selectionEnd);
    const { text, caret } = insertAtSelection(
      field.value,
      field.selectionStart,
      field.selectionEnd,
      starterText(field.value, from, starter),
    );
    // Commit the new value to the DOM before setting the caret, because React
    // would otherwise move the caret to the end of the field.
    flushSync(() => onInsert(text));
    field.focus();
    field.setSelectionRange(caret, caret);
  }

  return (
    <div
      role="group"
      aria-label={LIVE_COPY.starterGroup}
      className={styles.starters}
    >
      {promptStarters.map((starter) => (
        <button
          key={starter}
          type="button"
          className={`${styles.secondary} ${styles.starter}`}
          onClick={() => insert(starter)}
        >
          {starter}
        </button>
      ))}
    </div>
  );
}
