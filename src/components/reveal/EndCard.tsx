import type { ReactNode } from "react";
import styles from "./receipts.module.css";

/**
 * The end card of the receipts column (spec 15 R12.2). It closes the column
 * with the end actions the reveal already draws, the Close. The Close holds the
 * end copy ("Your testimony sits beside the record…", "That is the whole
 * letter…"), so this card adds no copy of its own. That keeps each line on the
 * screen once.
 *
 * The card reads no state and adds no figure, grade or summary.
 */
export type EndCardProps = {
  /** The end actions, for example the Close. */
  children?: ReactNode;
};

export function EndCard({ children }: EndCardProps) {
  return (
    <section className={styles.endCard} data-end-card="">
      {children}
    </section>
  );
}
