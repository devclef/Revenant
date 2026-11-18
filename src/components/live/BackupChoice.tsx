"use client";

// Feature: 13-the-seal, 14-write-desk
//
// The Backup_Choice on the Seal step (spec 13, P7; spec 14, S4). One fieldset
// with two Backup_Cards and no option selected at the start. Each card is a
// label that wraps a visually hidden native radio: the title is the radio's
// accessible name and the help line is its description. Choosing "skip" is the
// explicit confirmation that product.md requires for an unlock without a backup key.

import { LIVE_COPY } from "./copy";
import type { BackupChoiceValue } from "./write-draft";
import cards from "./backup-choice.module.css";

export interface BackupChoiceProps {
  /** The selected option, or null when none is selected yet (P7.2). */
  value: BackupChoiceValue | null;
  /** The visitor picked an option. */
  onChange: (choice: BackupChoiceValue) => void;
  /** Shown under the fieldset when the visitor has not chosen yet. */
  problem?: string;
  /** The radios are disabled while a passkey prompt or the sealing runs (S4.7). */
  disabled?: boolean;
}

const OPTIONS: readonly {
  value: BackupChoiceValue;
  label: string;
  help: string;
  id: string;
}[] = [
  {
    value: "card",
    label: LIVE_COPY.backupChoiceCard,
    help: LIVE_COPY.backupChoiceCardHelp,
    id: "live-backup-choice-card",
  },
  {
    value: "skip",
    label: LIVE_COPY.backupChoiceSkip,
    help: LIVE_COPY.backupChoiceSkipHelp,
    id: "live-backup-choice-skip",
  },
];

export function BackupChoice({
  value,
  onChange,
  problem,
  disabled = false,
}: BackupChoiceProps) {
  const problemId = "live-backup-choice-problem";
  return (
    <fieldset
      className={cards.backupChoice}
      data-backup-choice=""
      aria-describedby={problem ? problemId : undefined}
    >
      <legend className={cards.legend}>{LIVE_COPY.backupChoiceLegend}</legend>
      <div className={cards.cards}>
        {OPTIONS.map((option) => {
          const helpId = `${option.id}-help`;
          return (
            <label
              key={option.value}
              className={cards.card}
              data-backup-card={option.value}
              htmlFor={option.id}
            >
              <input
                id={option.id}
                type="radio"
                name="live-backup-choice"
                value={option.value}
                className={cards.radio}
                aria-describedby={helpId}
                disabled={disabled}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
              />
              <span className={cards.circle} aria-hidden="true" />
              <span className={cards.title}>{option.label}</span>
              <span id={helpId} className={cards.help}>
                {option.help}
              </span>
            </label>
          );
        })}
      </div>
      <p id={problemId} className={cards.problem}>
        {problem}
      </p>
    </fieldset>
  );
}
