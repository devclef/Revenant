"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

import { LIVE_COPY } from "../copy";
import { countCodePoints } from "../form";
import { deskLetterHeightPx } from "../phone";

import { DESK_COPY } from "./copy";
import { SheetDate } from "./SheetDate";
import styles from "./sheet.module.css";

export interface LetterSheetProps {
  /** The letter text. The only thing in the textarea value (W4.3). */
  value: string;
  /** The Occasion placeholder, shown only while `value` is empty (W5.4). */
  placeholder: string;
  /** The letter problem message, or "" when there is none (W5.5). */
  problem: string;
  /** Called with the new letter text on every change. */
  onChange: (value: string) => void;
  /** Called when the field loses focus, so the parent can mark it touched. */
  onBlur?: () => void;
  /** Optional ref to the textarea, for focus from the parent. */
  fieldRef?: RefObject<HTMLTextAreaElement | null>;
}

/** The letter count as the Letter_Sheet shows it (W4.4): grouped, e.g. "1,234 of 5,000 characters". */
function letterCountText(value: string): string {
  const grouped = new Intl.NumberFormat("en-US").format(countCodePoints(value));
  return LIVE_COPY.letterCount.replace("{count}", grouped);
}

/**
 * The Letter_Sheet on the Write desk (spec 14, W4 and W5): a sheet of warm
 * paper with the salutation and the visitor's date on top, the ruled
 * Letter_Field, the sign-off and the count underneath, and the problem line.
 *
 * The salutation, the sign-off and the date are display only. The textarea's
 * value is `value` and nothing else. The field has no maxlength, so a letter
 * over 5,000 characters is shown as too long, not cut short (W5.5).
 */
export function LetterSheet({
  value,
  placeholder,
  problem,
  onChange,
  onBlur,
  fieldRef,
}: LetterSheetProps) {
  const ownRef = useRef<HTMLTextAreaElement | null>(null);
  const field = fieldRef ?? ownRef;

  // Grow the field with its text, between the 296 px floor and the phone cap
  // for the visual viewport (W5.3). Past the cap the field scrolls inside itself.
  useLayoutEffect(() => {
    const node = field.current;
    if (node === null) return;
    node.style.height = "auto";
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    node.style.height = `${deskLetterHeightPx(node.scrollHeight, viewportHeight)}px`;
  }, [value, field]);

  return (
    <section className={styles.sheet} data-letter-sheet="">
      <div className={styles.topRow}>
        <p className={styles.salutation}>{DESK_COPY.salutation}</p>
        <SheetDate />
      </div>

      <label htmlFor="live-letter" className={styles.visuallyHidden}>
        {LIVE_COPY.letterLabel}
      </label>
      <textarea
        id="live-letter"
        ref={field}
        className={styles.letter}
        placeholder={placeholder}
        value={value}
        aria-describedby="live-letter-count live-letter-problem"
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />

      <div className={styles.bottomRow}>
        <p className={styles.signOff}>{DESK_COPY.signOff}</p>
        <p id="live-letter-count" className={styles.count}>
          {letterCountText(value)}
        </p>
      </div>

      <p id="live-letter-problem" className={styles.problem}>
        {problem}
      </p>
    </section>
  );
}
