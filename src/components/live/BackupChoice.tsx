"use client";

// Feature: 13-the-seal
//
// The Backup_Choice on the Seal step (spec 13, P7). One fieldset with two native
// radios and no option selected at the start. Choosing "skip" is the explicit
// confirmation that product.md requires for an unlock without a backup key.

import { LIVE_COPY } from "./copy";
import type { BackupChoiceValue } from "./write-draft";
import styles from "./live.module.css";

export interface BackupChoiceProps {
  /** The selected option, or null when none is selected yet (P7.2). */
  value: BackupChoiceValue | null;
  /** The visitor picked an option. */
  onChange: (choice: BackupChoiceValue) => void;
  /** Shown under the fieldset when the visitor has not chosen yet. */
  problem?: string;
}

const OPTIONS: readonly { value: BackupChoiceValue; label: string; id: string }[] = [
  { value: "card", label: LIVE_COPY.backupChoiceCard, id: "live-backup-choice-card" },
  { value: "skip", label: LIVE_COPY.backupChoiceSkip, id: "live-backup-choice-skip" },
];

export function BackupChoice({ value, onChange, problem }: BackupChoiceProps) {
  const problemId = "live-backup-choice-problem";
  return (
    <fieldset
      className={styles.backupChoice}
      data-backup-choice=""
      aria-describedby={problem ? problemId : undefined}
    >
      <legend className={styles.backupChoiceLegend}>{LIVE_COPY.backupChoiceLegend}</legend>
      {OPTIONS.map((option) => (
        <label key={option.value} className={styles.backupChoiceOption} htmlFor={option.id}>
          <input
            id={option.id}
            type="radio"
            name="live-backup-choice"
            value={option.value}
            className={styles.radio}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
      <p id={problemId} className={styles.problem}>
        {problem}
      </p>
    </fieldset>
  );
}
