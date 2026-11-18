"use client";

import { DESK_COPY } from "./copy";
import styles from "./panel.module.css";

/** The two views of the receipt card (spec 14, W10.3). */
export type ReceiptView = "public" | "own";

export interface ReceiptToggleProps {
  /** The view that is shown. */
  view: ReceiptView;
  /** Called with the view the visitor picked. */
  onChange: (view: ReceiptView) => void;
}

const OPTIONS: readonly { view: ReceiptView; label: string }[] = [
  { view: "public", label: DESK_COPY.togglePublic },
  { view: "own", label: DESK_COPY.toggleOwn },
];

/**
 * The two-way toggle of the receipt card: "A public price" first, then "A
 * number of my own". Each button is an `aria-pressed` toggle in one group named
 * by the card heading. Up and down are never involved here, so the toggle has
 * no colour that implies a direction.
 */
export function ReceiptToggle({ view, onChange }: ReceiptToggleProps) {
  return (
    <div
      className={styles.toggle}
      role="group"
      aria-label={DESK_COPY.receiptTitle}
      data-receipt-toggle=""
    >
      {OPTIONS.map((option) => {
        const pressed = view === option.view;
        return (
          <button
            key={option.view}
            type="button"
            className={pressed ? styles.toggleOn : styles.toggleOff}
            aria-pressed={pressed}
            onClick={() => onChange(option.view)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
