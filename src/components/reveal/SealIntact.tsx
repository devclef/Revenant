"use client";

import { ParchmentSurface } from "@/components/ui";
import { REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

/**
 * The verification statement view (R7.5), shown for the `verified` state. The
 * letter has opened, decrypted and its seal has been checked against the stored
 * hash -- but nothing from inside it is shown yet. This screen holds only the
 * "seal is intact" statement and a single "Begin" button; the recall questions
 * render only after "Begin" moves the flow to the `recall` state.
 *
 * This ordering is a non-negotiable: the reader sees that the seal held BEFORE
 * they see any sealed content, and they answer the recall questions before the
 * letter or figures are revealed (data-integrity.md: "Show the user that
 * verification passed"; product.md: "Recall first").
 *
 * No sealed payload field is rendered here. Both strings come from copy.ts
 * (R15.1).
 */

export type SealIntactProps = {
  /** Dispatches `BEGIN`, moving from the statement to the recall step. */
  onBegin: () => void;
};

export function SealIntact({ onBegin }: SealIntactProps) {
  return (
    <ParchmentSurface as="section" className={styles.intact}>
      <p>{REVEAL_COPY.sealIntact}</p>
      <button type="button" className={styles.button} onClick={onBegin}>
        {REVEAL_COPY.begin}
      </button>
    </ParchmentSurface>
  );
}
