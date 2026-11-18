// Feature: 14-write-desk (W7.2, T1.3). The numbered orange wax disc that marks
// each question. Orange means "you" (tone.md), so the disc is the one orange
// element in a question row. It is decorative: the question text names it.

import styles from "./wax-disc.module.css";

export interface WaxDiscProps {
  /** The question number, starting at 1. */
  n: number;
}

/** A 30 px wax disc with the question number on it. */
export function WaxDisc({ n }: WaxDiscProps) {
  return (
    <span className={styles.disc} aria-hidden="true" data-wax-disc="">
      {n}
    </span>
  );
}
