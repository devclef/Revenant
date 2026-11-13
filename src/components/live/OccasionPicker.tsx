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
 * L2.1, L2.9). One wrapping row of toggle-style buttons with `aria-pressed`.
 * The legend is visually hidden but stays in the accessibility tree. Each
 * chip shows an [x] marker when pressed. The marker is aria-hidden, and CSS
 * hides it on unpressed chips so the labels line up. Chip heights come from
 * live.module.css (44px below 600px, 32px from 600px). The choice lives in
 * React state only (L2.5).
 */
export function OccasionPicker({ chosen, onChoose }: OccasionPickerProps) {
  return (
    <fieldset className={styles.occasions}>
      <legend className={styles.visuallyHidden}>
        {LIVE_COPY.occasionLegend}
      </legend>
      <div className={styles.occasionRow}>
        {OCCASIONS.map((occasion) => (
          <button
            key={occasion.id}
            type="button"
            aria-pressed={chosen === occasion.id}
            className={`${styles.secondary} ${styles.occasionButton}`}
            onClick={() => onChoose(occasion.id)}
          >
            <span aria-hidden="true" className={styles.occasionMark}>
              [x]
            </span>
            {LIVE_COPY.occasionLabels[occasion.id]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
