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
 * The Occasion options above the letter field on the Write step (spec 11,
 * L2.1, L2.9; spec 12, W2). One wrapping row of plain text options: no box,
 * tick or check mark. The chosen option has `aria-pressed="true"` and shows
 * underlined and heavier. The legend is visually hidden but stays in the
 * accessibility tree. Chip heights come from live.module.css (44px below
 * 600px, 32px from 600px). The choice lives in React state only (L2.5).
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
            className={styles.occasionButton}
            onClick={() => onChoose(occasion.id)}
          >
            {LIVE_COPY.occasionLabels[occasion.id]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
