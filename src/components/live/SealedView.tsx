"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { DemoLabel } from "@/components/demo/DemoLabel";

import { BackupKeyCard } from "./BackupKeyCard";
import { COUNTDOWN_TICK_MS } from "./constants";
import { LIVE_COPY } from "./copy";
import { formatLocalDateTime } from "./format";
import { goToLetterReady, remainingSeconds } from "./clock";
import styles from "./live.module.css";
import { SealedKeepsakes } from "./SealedKeepsakes";
import type { SealState } from "./seal-machine";

/**
 * The sealed-success view for the live Seal_Page (spec 06-lock-and-unlock,
 * design.md "Seal_Page"; R15.13, R16.2–R16.5, R19.1). It renders the `sealed`
 * state of the SealState union and nothing else.
 *
 * It shows:
 *
 *  - the sealed statement (sealedTitle, sealedBody);
 *  - the local opening time, from formatLocalDateTime(opensAt) through
 *    LIVE_COPY.opensAt;
 *  - the live countdown, from remainingSeconds(opensAtMs, nowMs, offsetMs)
 *    through LIVE_COPY.countdown until it reaches zero, then
 *    LIVE_COPY.countdownDone (R16.2–R16.4);
 *  - the letter link as TEXT (`${appOrigin}/l/${letterId}`) with a Copy control
 *    (copyLink);
 *  - a "Go to your letter" control (goToLetter): a next/link to the RELATIVE
 *    path `/l/${letterId}`, never built from APP_ORIGIN, enabled only once the
 *    countdown reaches zero (R16.3–R16.5);
 *  - the keep-the-link note (keepLink);
 *  - and, for a backup or both seal, the backup-key reminder (keyReminder);
 *  - and the keepsakes (SealedKeepsakes): the printable letter card and the
 *    calendar download (spec 06, task 11). Their controls are outside the
 *    `.noPrint` group, so a print shows the card and nothing else.
 *
 * It renders NO letter text and NO figure (R15.13).
 *
 * The countdown TEXT updates on a COUNTDOWN_TICK_MS interval. Under calm motion
 * (prefers-reduced-motion) there is no decorative motion — but this view has
 * none to suppress, and the countdown text still updates, so calm changes
 * nothing a reader can see here beyond the (absent) decoration.
 *
 * Every reader string comes from LIVE_COPY (R19.1); there are no literals here.
 * The clock is injected via `nowMs` so a test is deterministic; it defaults to
 * Date.now.
 */

export type SealedState = Extract<SealState, { tag: "sealed" }>;

export interface SealedViewProps {
  /** The sealed state, carrying the letter id, opening time, offset and factors. */
  state: SealedState;
  /** The app origin (APP_ORIGIN) without a trailing slash, from SealPage. */
  appOrigin: string;
  /** The clock used for the countdown. Defaults to Date.now; a test fixes it. */
  nowMs?: () => number;
  /**
   * Reads the printed backup key from the seal flow. It is called during render,
   * so the key is never passed as state. Returns null for a passkey-only letter,
   * or when the key is no longer held.
   */
  getBackupKeyText?: () => string | null;
}

export function SealedView({
  state,
  appOrigin,
  nowMs = Date.now,
  getBackupKeyText = () => null,
}: SealedViewProps) {
  const opensAtMs = Date.parse(state.opensAt);
  const [showBackupCard, setShowBackupCard] = useState(false);
  const nowRef = useRef(nowMs);
  nowRef.current = nowMs;

  // The first render (server and first client render) reads the clock once, so
  // the initial seconds are deterministic for a fixed `nowMs`.
  const [seconds, setSeconds] = useState(() =>
    remainingSeconds(opensAtMs, nowRef.current(), state.offsetMs),
  );
  // "Go to your letter" is enabled only when goToLetterReady says the countdown
  // has ended (Property 19). It is kept in state, updated on the same tick.
  const [ready, setReady] = useState(() =>
    goToLetterReady(opensAtMs, nowRef.current(), state.offsetMs),
  );

  useEffect(() => {
    // Refresh the countdown text on the tick. Stops ticking once it reaches
    // zero: the value is non-increasing and ends at zero (Property 16).
    setSeconds(remainingSeconds(opensAtMs, nowRef.current(), state.offsetMs));
    setReady(goToLetterReady(opensAtMs, nowRef.current(), state.offsetMs));
    if (opensAtMs <= nowRef.current() + state.offsetMs) {
      return;
    }
    const id = setInterval(() => {
      const left = remainingSeconds(opensAtMs, nowRef.current(), state.offsetMs);
      setSeconds(left);
      setReady(goToLetterReady(opensAtMs, nowRef.current(), state.offsetMs));
      if (left <= 0) {
        clearInterval(id);
      }
    }, COUNTDOWN_TICK_MS);
    return () => clearInterval(id);
  }, [opensAtMs, state.offsetMs]);

  const done = seconds <= 0;
  const linkText = `${appOrigin}/l/${state.letterId}`;
  const relativeHref = `/l/${state.letterId}`;
  const showKeyReminder = state.factors === "backup" || state.factors === "both";
  // The card is offered only for a letter with a Backup_Wrap, and only while
  // the printed key is still held. A passkey-only letter has no key to show.
  const backupKeyText = getBackupKeyText();
  const offerBackupCard = showKeyReminder && backupKeyText !== null && backupKeyText.length > 0;

  function onCopyLink(): void {
    void navigator.clipboard?.writeText(linkText);
  }

  return (
    <div className={styles.panel} data-live-sealed={state.factors}>
      <div className={styles.noPrint}>
        <DemoLabel />
        <h1 className={styles.heading}>{LIVE_COPY.sealedTitle}</h1>
        <p className={styles.intro}>{LIVE_COPY.sealedBody}</p>

        <p className={styles.intro}>
          {LIVE_COPY.opensAt.replace("{time}", formatLocalDateTime(state.opensAt))}
        </p>

        <p className={styles.status} role="status" data-live-countdown={done ? "done" : "ticking"}>
          {done
            ? LIVE_COPY.countdownDone
            : LIVE_COPY.countdown.replace("{seconds}", String(seconds))}
        </p>

        <p className={styles.hint}>{LIVE_COPY.linkLabel}</p>
        <p className={styles.intro}>
          <span className={styles.linkText} data-live-link>
            {linkText}
          </span>
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={onCopyLink}>
            {LIVE_COPY.copyLink}
          </button>
        </div>

        <div className={styles.actions}>
          {ready ? (
            <Link href={relativeHref} className={styles.primary} data-live-goto>
              {LIVE_COPY.goToLetter}
            </Link>
          ) : (
            <span
              className={`${styles.primary} ${styles.primaryDisabled}`}
              aria-disabled="true"
              data-live-goto
              data-disabled="true"
            >
              {LIVE_COPY.goToLetter}
            </span>
          )}
        </div>

        <p className={styles.hint}>{LIVE_COPY.keepLink}</p>
        {showKeyReminder ? <p className={styles.intro}>{LIVE_COPY.keyReminder}</p> : null}
      </div>

      <SealedKeepsakes
        letterId={state.letterId}
        appOrigin={appOrigin}
        opensAt={state.opensAt}
        envelopeHash={state.envelopeHash}
      />

      {offerBackupCard && backupKeyText !== null ? (
        showBackupCard ? (
          <div className={styles.backupCard}>
            <BackupKeyCard
              letterId={state.letterId}
              appOrigin={appOrigin}
              keyText={backupKeyText}
            />
          </div>
        ) : (
          <div className={`${styles.backupOffer} ${styles.noPrint}`}>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setShowBackupCard(true)}
              data-live-backup-offer
            >
              {LIVE_COPY.backupCardShow}
            </button>
          </div>
        )
      ) : null}
    </div>
  );
}
