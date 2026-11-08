"use client";

/**
 * The Wait, Testify and Receipts content of the live stepper (spec 09, D5).
 *
 * On the Wait card it shows the opening time, the countdown and "Go to your
 * letter" below. When the countdown reaches zero it mounts the embedded
 * Opening_Flow in place of the countdown. Mounting the flow makes the one
 * letter request, so the request is made once, at zero (D5.2). The flow then
 * shows the unlock control in place (D5.3). The stepper moves to Testify and
 * then Receipts only when the flow reports those phases (D5.4). The page never
 * navigates by itself, and the passkey assertion runs only on the reader's
 * press, as the flow already enforces.
 *
 * The child positions stay the same across Wait, Testify and Receipts, so the
 * flow keeps its state when the stepper moves on.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import type { GhostSink } from "@/components/ceremony/scene/Ghost";
import { useCalmInForce } from "@/components/ceremony/motion";
import { DemoLabel } from "@/components/demo/DemoLabel";
import { OpeningFlow } from "@/components/reveal/OpeningFlow";
import type { AuthenticatorPort } from "@/components/live/unlock";

import { BackupKeyCard } from "../BackupKeyCard";
import { COUNTDOWN_TICK_MS } from "../constants";
import { LIVE_COPY } from "../copy";
import { formatLocalDateTime } from "../format";
import { remainingSeconds } from "../clock";
import styles from "../live.module.css";
import { SealedKeepsakes } from "../SealedKeepsakes";
import type { SealedState } from "../SealedView";

import { LiveGhost } from "./LiveGhost";
import { flowMounted, stepForFlowPhase, type LiveStep } from "./live-steps";

export interface LiveWaitStepProps {
  /** The sealed state from the seal flow: letter id, opening time and factors. */
  state: SealedState;
  /** The app origin (APP_ORIGIN) without a trailing slash. */
  appOrigin: string;
  /** The stepper's current step. Wait, Testify and Receipts all use this card. */
  step: LiveStep;
  /** Moves the stepper forward to a later step. */
  advanceTo: (step: LiveStep) => void;
  /** The clock for the countdown. Defaults to Date.now; a test fixes it. */
  nowMs?: () => number;
  /** Reads the printed backup key from the seal flow, if it is still held. */
  getBackupKeyText?: () => string | null;
  /** The authenticator port for the flow. Defaults to the browser's. */
  port?: AuthenticatorPort;
}

/**
 * Seconds left until the opening time, ticking on COUNTDOWN_TICK_MS. The value
 * is never negative and stops ticking at zero (the same rule as SealedView).
 */
function useSecondsLeft(opensAtMs: number, nowMs: () => number, offsetMs: number): number {
  const nowRef = useRef(nowMs);
  nowRef.current = nowMs;
  const [seconds, setSeconds] = useState(() =>
    remainingSeconds(opensAtMs, nowRef.current(), offsetMs),
  );
  useEffect(() => {
    setSeconds(remainingSeconds(opensAtMs, nowRef.current(), offsetMs));
    if (opensAtMs <= nowRef.current() + offsetMs) return;
    const id = setInterval(() => {
      const left = remainingSeconds(opensAtMs, nowRef.current(), offsetMs);
      setSeconds(left);
      if (left <= 0) clearInterval(id);
    }, COUNTDOWN_TICK_MS);
    return () => clearInterval(id);
  }, [opensAtMs, offsetMs]);
  return seconds;
}

export function LiveWaitStep({
  state,
  appOrigin,
  step,
  advanceTo,
  nowMs = Date.now,
  getBackupKeyText = () => null,
  port,
}: LiveWaitStepProps) {
  const opensAtMs = Date.parse(state.opensAt);
  const seconds = useSecondsLeft(opensAtMs, nowMs, state.offsetMs);
  const done = seconds <= 0;
  const waiting = step === "wait";
  const [showBackupCard, setShowBackupCard] = useState(false);

  const showKeyReminder = state.factors === "backup" || state.factors === "both";
  const backupKeyText = getBackupKeyText();
  const offerBackupCard =
    showKeyReminder && backupKeyText !== null && backupKeyText.length > 0;

  // The Ghost's sink (spec 09 D1.2 to D1.4). It sinks with the Envelope while
  // the countdown runs. Calm shows the settled sunk pose with no motion. At zero
  // it goes idle, so the CSS rise plays again: the Emergence on unlock in place.
  const calm = useCalmInForce();
  const sink: GhostSink = done ? "idle" : calm ? "sunk" : "sinking";

  return (
    <div className={styles.panel} data-live-wait>
      <DemoLabel />

      {waiting ? <LiveGhost sink={sink} /> : null}

      {waiting ? (
        <>
          <p className={styles.intro}>
            {LIVE_COPY.opensAt.replace("{time}", formatLocalDateTime(state.opensAt))}
          </p>
          {done ? null : (
            <p className={styles.status} role="status" data-live-countdown="ticking">
              {LIVE_COPY.countdown.replace("{seconds}", String(seconds))}
            </p>
          )}
          {/* The key reminder sits with the unlock control it describes (D1.5). */}
          {showKeyReminder ? (
            <p className={`${styles.intro} ${styles.noPrint}`}>{LIVE_COPY.keyReminder}</p>
          ) : null}
        </>
      ) : null}

      {flowMounted(step, done) ? (
        <div className={styles.letterColumn}>
          <OpeningFlow
            mode="live"
            letterId={state.letterId}
            personaName={LIVE_COPY.regionLabel}
            port={port}
            embedded={{
              onPhase: (tag) => {
                const next = stepForFlowPhase(tag);
                if (next !== null) advanceTo(next);
              },
            }}
          />
        </div>
      ) : null}

      {waiting ? (
        <>
          <div className={`${styles.actions} ${styles.noPrint}`}>
            {done ? (
              <Link href={`/l/${state.letterId}`} className={styles.primary} data-live-goto>
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
          {offerBackupCard && backupKeyText !== null ? (
            showBackupCard ? (
              <div className={styles.backupCard}>
                <BackupKeyCard letterId={state.letterId} appOrigin={appOrigin} keyText={backupKeyText} />
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
          <SealedKeepsakes
            letterId={state.letterId}
            appOrigin={appOrigin}
            opensAt={state.opensAt}
            envelopeHash={state.envelopeHash}
          />
        </>
      ) : null}
    </div>
  );
}
