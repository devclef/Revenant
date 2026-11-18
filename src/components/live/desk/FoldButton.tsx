"use client";

import { DESK_COPY } from "./copy";
import styles from "./panel.module.css";

export interface FoldButtonProps {
  /** Runs the Write_Check and, when it passes, moves to the Seal step. */
  onFold: () => void;
  /** True after a failed fold, until the Write_Check passes (W13.3). */
  failed: boolean;
}

/**
 * The Fold_Button (spec 14, W13): the one Accent-filled control on the Write
 * step. After a failed fold it shows one line that points back at the note
 * above. The arrow is decoration and is hidden from assistive tech.
 */
export function FoldButton({ onFold, failed }: FoldButtonProps) {
  return (
    <div className={styles.foldGroup}>
      <button
        type="button"
        className={styles.fold}
        data-fold-button=""
        onClick={onFold}
      >
        {DESK_COPY.fold}
        <span aria-hidden="true"> →</span>
      </button>
      {failed ? (
        <p className={styles.foldSummary} data-fold-summary="">
          {DESK_COPY.foldFailed}
        </p>
      ) : null}
    </div>
  );
}
