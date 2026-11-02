"use client";

/**
 * The key step of the live Letter_Page (spec 06, design.md "Opening_Flow
 * additions", R17.2, R17.10, R17.12).
 *
 * It renders what the released envelope accepts, read from `state.unlock`:
 * - both a passkey and a backup wrap: the passkey button and the key field;
 * - a passkey wrap only: the passkey button;
 * - a backup wrap only: the backup-only text and the key field, and no passkey
 *   control (R17.10).
 *
 * The passkey button stays disabled until the crypto module has loaded (R17.2).
 * Each notice goes into a `role="status"` region, so a screen reader hears it.
 * The text comes from LIVE_COPY (R19.1).
 *
 * The key field takes a typed or pasted key. It has no paste handler: the
 * pasted text goes to `controls.backup`, which parses it. A mistyped key sends
 * no request and keeps the text in the field (R17.10). The field has the
 * attributes that stop a phone or browser from altering a key.
 *
 * The typed key text is owned by the parent (`OpeningFlow`), not by this view.
 * The view unmounts while the letter is being checked, so keeping the text in
 * local state would lose a wrong key on the round trip back to `awaiting_key`.
 *
 * This file imports no crypto module. The key step only calls the controls the
 * effect runner passes in (`useOpeningFlow`), which owns the crypto load.
 */

import type { FormEvent } from "react";

import type { KeyNotice, UnlockInfo } from "@/components/reveal/opening-machine";
import type { UnlockControls } from "@/components/reveal/unlock";
import { LIVE_COPY } from "./copy";
import styles from "./live.module.css";

export type UnlockViewProps = {
  /** Which factors the released envelope accepts. */
  unlock: UnlockInfo;
  /** The notice for the last attempt, or null when there is none. */
  notice: KeyNotice | null;
  /** The controls the effect runner built for this flow. */
  controls: UnlockControls;
  /** The key text the reader has typed, kept by the parent across retries. */
  keyText: string;
  /** Called with the new text on every edit. */
  onKeyTextChange: (text: string) => void;
};

/**
 * The text for a notice. `wrong_domain` names the header `rpId`, which is the
 * only domain the passkey can be used on (R17.5). The other notices are fixed.
 */
function noticeText(notice: KeyNotice, rpId: string): string {
  switch (notice) {
    case "cancelled":
      return LIVE_COPY.noticeCancelled;
    case "no_prf":
      return LIVE_COPY.noticeNoPrf;
    case "failed":
      return LIVE_COPY.noticeFailed;
    case "wrong_domain":
      return LIVE_COPY.noticeWrongDomain.replace("{domain}", rpId);
    case "mistyped_key":
      return LIVE_COPY.noticeMistyped;
    case "wrong_passkey":
      return LIVE_COPY.noticeWrongPasskey;
    case "wrong_backup":
      return LIVE_COPY.noticeWrongBackup;
  }
}

export function UnlockView({
  unlock,
  notice,
  controls,
  keyText,
  onKeyTextChange,
}: UnlockViewProps) {
  const hasPasskey = unlock.passkey !== null;
  const hasBackup = unlock.backup;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    // The form only submits the key. The page itself does not reload.
    event.preventDefault();
    controls.backup(keyText);
  };

  return (
    <section className={styles.unlock} aria-labelledby="unlock-title">
      <h1 id="unlock-title" className={styles.heading}>
        {LIVE_COPY.unlockTitle}
      </h1>

      {hasPasskey ? (
        <button
          type="button"
          className={styles.primary}
          disabled={!controls.ready}
          onClick={controls.passkey}
        >
          {LIVE_COPY.unlockPasskey}
        </button>
      ) : null}

      {hasBackup ? (
        <form className={styles.field} onSubmit={onSubmit}>
          {hasPasskey ? null : <p className={styles.intro}>{LIVE_COPY.backupOnly}</p>}
          <label className={styles.label} htmlFor="unlock-backup-key">
            {LIVE_COPY.backupLabel}
          </label>
          <p id="unlock-backup-key-hint" className={styles.hint}>
            {LIVE_COPY.backupHint}
          </p>
          <input
            id="unlock-backup-key"
            name="backup-key"
            type="text"
            className={styles.keyField}
            value={keyText}
            onChange={(event) => onKeyTextChange(event.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-describedby="unlock-backup-key-hint"
          />
          <button
            type="submit"
            className={styles.secondary}
            disabled={!controls.ready}
          >
            {LIVE_COPY.backupSubmit}
          </button>
        </form>
      ) : null}

      {controls.ready ? null : (
        <p className={styles.hint}>{LIVE_COPY.unlockPreparing}</p>
      )}

      <div role="status" className={styles.status}>
        {notice === null ? null : noticeText(notice, unlock.passkey?.rpId ?? "")}
      </div>
    </section>
  );
}
