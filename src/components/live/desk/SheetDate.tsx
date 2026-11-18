"use client";

import styles from "./sheet.module.css";
import { useLocalDay } from "./use-local-day";

/**
 * The visitor's local date on the Letter_Sheet (spec 14, W4.2, W4.3).
 *
 * The server HTML and the first client render hold an empty slot of the same
 * height (`.date` sets its min-height), so hydration sees the same markup. The
 * date is filled in after mount. The date is display only: it is never part of
 * the Letter_Field value, counted or sealed.
 */
export function SheetDate() {
  const { sheetDate } = useLocalDay();
  return (
    <span className={styles.date} data-sheet-date="">
      {sheetDate}
    </span>
  );
}
