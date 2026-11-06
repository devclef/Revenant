"use client";

import { formatCalendarDate } from "@/components/ui/letter-date";

import { REAL_COPY } from "./copy";
import styles from "./live.module.css";

export interface RealDatePickerProps {
  /** The chosen `YYYY-MM-DD`, or null while none is chosen. */
  value: string | null;
  /** The earliest allowed opening date, `YYYY-MM-DD`. Sets the input's min. */
  min: string;
  /** True when the browser's zone is unknown, so the opening is at midnight UTC. */
  timeZoneFallback: boolean;
  /** The validation message for the date, or "" to show none (spec 09, A4.4). */
  problem?: string;
  onChange: (date: string | null) => void;
  /** Called when the judge leaves the date input. */
  onTouch?: () => void;
}

/**
 * The opening date for a Real_Letter. A native date input with `min` set to the
 * earliest allowed date, and the chosen date written in the R15.1 form. The
 * page checks the date again at each press (see real-opening.ts).
 */
export function RealDatePicker({
  value,
  min,
  timeZoneFallback,
  problem = "",
  onChange,
  onTouch = () => {},
}: RealDatePickerProps) {
  return (
    <div className={styles.field}>
      <label htmlFor="real-opens-on" className={styles.label}>
        {REAL_COPY.dateLabel}
      </label>
      <p id="real-opens-on-hint" className={styles.hint}>
        {REAL_COPY.dateHint}
      </p>
      <input
        id="real-opens-on"
        type="date"
        className={styles.dateInput}
        min={min}
        value={value ?? ""}
        aria-describedby="real-opens-on-hint real-opens-on-chosen real-opens-on-problem"
        onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
        onBlur={() => onTouch()}
      />
      {timeZoneFallback ? <p className={styles.count}>{REAL_COPY.utcFallback}</p> : null}
      <p id="real-opens-on-chosen" className={styles.count}>
        {value === null ? "" : REAL_COPY.dateChosen.replace("{date}", formatCalendarDate(value))}
      </p>
      <p id="real-opens-on-problem" className={styles.problem}>
        {problem}
      </p>
    </div>
  );
}
