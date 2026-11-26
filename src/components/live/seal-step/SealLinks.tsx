"use client";

// Feature: 14-write-desk (spec 14, S5).
//
// The two text controls under the Backup_Choice on the Seal step: the
// cross-device question, which toggles one plain line, and the Back link. Both
// are text controls, never orange (S5.4). Back stays in place and is disabled
// while no onBack is given (S5.6).

import { useId, useState } from "react";

import { LIVE_COPY } from "../copy";
import styles from "./seal-step.module.css";

export type SealLinksProps = {
  /** Present only while the Write step can go back. Absent means Back is disabled. */
  onBack?: () => void;
  /** Simulated_Mode: hide the cross-device question (spec 20, Requirement 11.8). */
  simulated?: boolean;
};

export function SealLinks({ onBack, simulated = false }: SealLinksProps) {
  const [open, setOpen] = useState(false);
  const crossId = useId();

  // Simulated_Mode has no passkey on a device, so the cross-device question is
  // left out and only the Back link remains (Requirement 11.8).
  return (
    <>
      <p className={styles.links} data-seal-links="">
        {simulated ? null : (
          <button
            type="button"
            className={styles.textLink}
            aria-expanded={open}
            aria-controls={crossId}
            data-cross-device=""
            onClick={() => setOpen((value) => !value)}
          >
            {LIVE_COPY.crossDeviceQuestion}
          </button>
        )}
        <button
          type="button"
          className={styles.textLink}
          data-back-to-letter=""
          disabled={onBack === undefined}
          onClick={onBack}
        >
          <span aria-hidden="true">← </span>
          {LIVE_COPY.backToLetter}
        </button>
      </p>
      {open && !simulated ? (
        <p id={crossId} className={styles.crossDevice}>
          {LIVE_COPY.crossDevice}
        </p>
      ) : null}
    </>
  );
}
