"use client";

// The column that holds the open letter on the receipts. It carries the
// `[data-letter-stage]` wrapper the reveal already uses. In the receipts split
// the column can scroll on its own; when its content overflows, it becomes a
// labelled, keyboard-reachable scroll region.

import { useRef } from "react";

import { REVEAL_COPY } from "./copy";
import { LetterPaper, type LetterPaperProps } from "./LetterPaper";
import { useOwnScroll } from "./own-scroll";
import receiptsStyles from "./receipts.module.css";
import styles from "./reveal.module.css";

export type LetterColumnProps = {
  /** True when the letter sits beside the figures in the receipts split. */
  split: boolean;
  /** True when the letter mounts settled, with no unfold. */
  still: boolean;
  /** The paper's props. `still` is set by this column. */
  paper: Omit<LetterPaperProps, "still">;
};

export function LetterColumn({ split, still, paper }: LetterColumnProps) {
  const ref = useRef<HTMLDivElement>(null);
  const scrolls = useOwnScroll(ref, split);

  return (
    <div
      ref={ref}
      className={`${styles.stage} ${styles.fade} ${styles.letterCol} ${receiptsStyles.letterColumn}`}
      data-letter-stage=""
      data-split={split ? "" : undefined}
      tabIndex={scrolls ? 0 : undefined}
      role={scrolls ? "region" : undefined}
      aria-label={scrolls ? REVEAL_COPY.stage2Title : undefined}
      data-letter-scroll={scrolls ? "" : undefined}
    >
      <LetterPaper {...paper} still={still} />
    </div>
  );
}
