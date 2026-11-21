import type { ReactNode } from "react";
import { FiguresFadeUp } from "@/components/ceremony/figures/FiguresFadeUp";
import styles from "./reveal.module.css";

/**
 * The figures part of the receipts column (spec 15 R12.4). Each figure keeps
 * its own receipt (Then, Now, the reader's answer, the change line, the formula
 * and the source), drawn by `FiguresThenNow` or `SelfReportedOnly`. This wrapper
 * places that content after the letter and fades it up once, by the number of
 * sealed figures only (R14.7, R14.8).
 *
 * The wrapper holds the stage classes and the `data-figures-panel` hook that
 * the reveal tests and the focus rule read. It computes nothing.
 */
export type FigureReceiptProps = {
  /** The number of sealed figures. Sets the fade-up's timing. */
  count: number;
  children: ReactNode;
};

export function FigureReceipt({ count, children }: FigureReceiptProps) {
  return (
    <div
      className={`${styles.stage} ${styles.fade} ${styles.figuresCol}`}
      data-figures-panel=""
    >
      <FiguresFadeUp count={count}>{children}</FiguresFadeUp>
    </div>
  );
}
