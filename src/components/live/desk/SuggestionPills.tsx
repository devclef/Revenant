"use client";

import { useId } from "react";

import type { OccasionId } from "../occasions";
import letterField from "../letter-field.module.css";

import { DESK_COPY } from "./copy";
import styles from "./question-section.module.css";
import { suggestionsFor } from "./suggestions";

export interface SuggestionPillsProps {
  /** The Occasion last chosen. Its suggestions come first (W8.1). */
  occasion: OccasionId;
  /** The question rows as typed. Suggestions equal to a row are skipped (W8.5). */
  questions: readonly string[];
  /** Called with the suggestion's text, or "" for "+ Write my own". */
  onAdd: (text: string) => void;
}

/**
 * The Suggestion_Pills of the Question_Section (spec 14, W8.1, W8.2, W8.7):
 * "Ask another:", up to two pills from suggestionsFor, then "+ Write my own".
 * The "+ " prefix is hidden from assistive technology, and each pill's
 * accessible name comes from aria-label. Each pill carries data-add-row so the
 * section moves focus to the row the pill adds (W8.3, W8.4).
 */
export function SuggestionPills({
  occasion,
  questions,
  onAdd,
}: SuggestionPillsProps) {
  const labelId = useId();
  const suggestions = suggestionsFor(occasion, questions).slice(0, 2);

  return (
    <div role="group" aria-labelledby={labelId}>
      <p id={labelId} className={styles.askLabel}>
        {DESK_COPY.askAnother}
      </p>
      <ul className={styles.pillList}>
        {suggestions.map((text) => (
          <li key={text}>
            <button
              type="button"
              className={`${styles.pill} ${letterField.sheetSerif}`}
              aria-label={DESK_COPY.addSuggestion.replace("{text}", text)}
              data-add-row=""
              onClick={() => onAdd(text)}
            >
              <span aria-hidden="true">+ </span>
              {text}
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            className={`${styles.pill} ${styles.writeOwn}`}
            aria-label={DESK_COPY.writeOwn}
            data-add-row=""
            onClick={() => onAdd("")}
          >
            <span aria-hidden="true">+ </span>
            {DESK_COPY.writeOwn}
          </button>
        </li>
      </ul>
    </div>
  );
}
