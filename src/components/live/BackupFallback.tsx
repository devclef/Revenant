"use client";

import { useState } from "react";

import { DemoLabel } from "@/components/demo/DemoLabel";

import { LIVE_COPY } from "./copy";
import styles from "./live.module.css";

/**
 * The backup-key screen for the live Seal_Page (spec 06-lock-and-unlock,
 * design.md "Backup_Fallback"; R20.1–R20.6, R19.1). It is shown in the
 * `fallback_key` state, after the judge chooses the backup key on a cannot_lock
 * screen.
 *
 * It shows:
 *
 *  - the key from formatBackupKey, in groups of four, with a Copy control;
 *  - the fallbackWarning text, plainly worded;
 *  - an "I have saved this key" checkbox;
 *  - a seal control, disabled until the checkbox is ticked;
 *  - a Not now action that declines the fallback.
 *
 * The key arrives as text from the flow. It is never logged and never sent to
 * the server. Sealing uses the key bytes held in the flow's ref. This component
 * only renders the printed form. Copy uses the browser clipboard and nothing
 * else.
 *
 * Every reader string comes from LIVE_COPY (R19.1).
 */

export interface BackupFallbackProps {
  /** The printed key from formatBackupKey: 27 characters in groups of four. */
  keyText: string;
  /** Seals with this key. Called only once the checkbox is ticked. */
  onSealPress: () => void;
  /** Declines the fallback. Seals nothing and sends nothing. */
  onDecline: () => void;
}

/**
 * Splits the printed key into its groups of four, dropping the hyphens. The
 * final group may be shorter. Empty groups are removed.
 */
export function keyGroups(keyText: string): string[] {
  return keyText.split("-").filter((group) => group.length > 0);
}

export function BackupFallback({ keyText, onSealPress, onDecline }: BackupFallbackProps) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  function onCopy(): void {
    void navigator.clipboard?.writeText(keyText).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  }

  return (
    <div className={styles.panel} data-live-fallback="backup">
      <DemoLabel />
      <h1 className={styles.heading}>{LIVE_COPY.fallbackTitle}</h1>
      <p className={styles.intro}>{LIVE_COPY.fallbackIntro}</p>

      <div className={styles.keyBox} data-live-key>
        {keyGroups(keyText).map((group, index) => (
          <span key={index} className={styles.keyGroup}>
            {group}
          </span>
        ))}
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={onCopy}>
          {copied ? LIVE_COPY.copied : LIVE_COPY.copyKey}
        </button>
      </div>

      <div className={styles.warning}>
        <p>{LIVE_COPY.fallbackWarning}</p>
      </div>

      <label className={styles.warningLabel}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={saved}
          onChange={(event) => setSaved(event.target.checked)}
        />
        <span>{LIVE_COPY.savedLabel}</span>
      </label>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={!saved}
          onClick={onSealPress}
        >
          {LIVE_COPY.sealWithKey}
        </button>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={onDecline}>
          {LIVE_COPY.notNow}
        </button>
      </div>
    </div>
  );
}
