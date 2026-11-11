"use client";

import { LIVE_COPY } from "./copy";
import styles from "./live.module.css";
import { OCCASIONS, type OccasionId } from "./occasions";

export interface OccasionPickerProps {
  /** The Occasion last chosen, shown as pressed, or null before any choice. */
  chosen: OccasionId | null;
  /** The visitor pressed an Occasion button. */
  onChoose: (id: OccasionId) => void;
}

/**
 * The Occasion buttons above the letter field on the Write step (spec 11,
 * L2.1, L2.9). A row of toggle-style buttons with `aria-pressed`. The buttons
 * wrap on a phone rather than scroll, and each keeps the 44 by 44 CSS pixel
 * minimum from .secondary. The choice lives in React state only (L2.5).
 */
export function OccasionPicker({ chosen, onChoose }: OccasionPickerProps) {
  return (
    <fieldset className={styles.occasions}>
      <legend className={styles.legend}>{LIVE_COPY.occasionLegend}</legend>
      <div className={styles.occasionRow}>
        {OCCASIONS.map((occasion) => (
          <button
            key={occasion.id}
            type="button"
            aria-pressed={chosen === occasion.id}
            className={`${styles.secondary} ${styles.occasionButton}`}
            onClick={() => onChoose(occasion.id)}
          >
            {LIVE_COPY.occasionLabels[occasion.id]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
