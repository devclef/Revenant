"use client";

import { LIVE_COPY } from "../copy";
import { OCCASIONS, type OccasionId } from "../occasions";

import { DESK_COPY } from "./copy";
import styles from "./desk.module.css";

export interface OccasionPillsProps {
  /** The Occasion chosen last. "A blank page" is chosen at first (W3.2). */
  chosen: OccasionId;
  /** The visitor pressed a pill. */
  onChoose: (id: OccasionId) => void;
}

/**
 * The Occasion_Row on the Write desk (spec 14, W3.1, W3.2, W3.5): a fieldset
 * with the visible legend "Start from" and five pills in the order of
 * OCCASIONS. The chosen pill has `aria-pressed="true"` and is solid white;
 * the others have `aria-pressed="false"`. Below 600 px the pills scroll
 * sideways on one line. The choice lives in React state only (L2.5).
 */
export function OccasionPills({ chosen, onChoose }: OccasionPillsProps) {
  return (
    <fieldset className={styles.occasions} data-occasions="">
      <legend className={styles.occasionLegend}>{DESK_COPY.startFrom}</legend>
      <div className={styles.pills}>
        {OCCASIONS.map((occasion) => (
          <button
            key={occasion.id}
            type="button"
            className={styles.pill}
            aria-pressed={occasion.id === chosen}
            data-occasion-pill={occasion.id}
            onClick={() => onChoose(occasion.id)}
          >
            {LIVE_COPY.occasionLabels[occasion.id]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
