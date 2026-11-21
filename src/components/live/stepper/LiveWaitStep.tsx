"use client";

/**
 * The Wait, Testify and Receipts content of the live stepper (spec 09, D5).
 *
 * The Wait card is one card (spec 15, R9.4 to R9.7). While the countdown runs it
 * shows the countdown. At zero it offers one action, "Open your letter", which
 * moves the stepper to Testify on the same page. The embedded Opening_Flow is
 * mounted only from Testify on, into the Reveal_Host below the card (spec 12,
 * X1), so the letter request and the unlock control come after that press. The
 * opening time appears once, on the letter card in the Keep_Section. No link
 * leaves the page, and the passkey assertion runs only on the reader's press,
 * as the flow already enforces.
 *
 * The position of this component stays the same across Wait, Testify and
 * Receipts, and so does the Reveal_Host, so the flow keeps its state when the
 * stepper moves on.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";

import { useCalmInForce } from "@/components/ceremony/motion";
import { DemoLabel } from "@/components/demo/DemoLabel";
import type { AuthenticatorPort } from "@/components/live/unlock";

import { BackupKeyCard } from "../BackupKeyCard";
import { COUNTDOWN_TICK_MS } from "../constants";
import { LIVE_COPY } from "../copy";
import { remainingSeconds } from "../clock";
import styles from "../live.module.css";
import { SealedKeepsakes } from "../SealedKeepsakes";
import type { SealedState } from "../SealedView";

import { LiveGhost } from "./LiveGhost";
import { SealedEnvelopeView } from "./SealedEnvelopeView";
import { heldGhostSink } from "./HeldGhost";
import { flowPortalTarget, stepForFlowPhase, type LiveStep } from "./live-steps";

/**
 * The opening flow, loaded when the Wait card mounts. It is split out of the
 * /demo/live first-load bundle, so the flow's code arrives only once a letter
 * is sealed and the stepper can show it (spec 15, R9.5). The export keeps the
 * name `OpeningFlow`, so the portal below reads the same as before.
 */
const OpeningFlow = dynamic(
  () =>
    import("@/components/reveal/OpeningFlow").then((mod) => mod.OpeningFlow),
);

/**
 * The box that holds the Ghost on the Testify step (spec 13, F4). The held Ghost
 * fills this box and is clipped to it. The box is in the page flow above the
 * flow's content, so it takes its own height and nothing below it is covered.
 */
const TESTIFY_GHOST_BOX: CSSProperties = {
  position: "relative",
  width: "min(100%, 16rem)",
  height: "clamp(9rem, 24vh, 13rem)",
  margin: "0 auto",
  overflow: "hidden",
  pointerEvents: "none",
};

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
  /** Shows the rehearsal line next to the countdown. Set only on /demo/live. */
  rehearsal?: boolean;
  /**
   * The Reveal_Host (spec 12, X1). The embedded Opening_Flow is portalled into
   * it once the flow is mounted. Null until the stepper's host has mounted.
   */
  host?: HTMLElement | null;
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
  rehearsal = false,
  host = null,
}: LiveWaitStepProps) {
  const opensAtMs = Date.parse(state.opensAt);
  const seconds = useSecondsLeft(opensAtMs, nowMs, state.offsetMs);
  const done = seconds <= 0;
  const waiting = step === "wait";
  const [showBackupCard, setShowBackupCard] = useState(false);
  // The flow's portal target: the Reveal_Host once the flow is mounted (D5.2).
  const flowTarget = flowPortalTarget(host, step, done);

  const showKeyReminder = state.factors === "backup" || state.factors === "both";
  const backupKeyText = getBackupKeyText();
  const offerBackupCard =
    showKeyReminder && backupKeyText !== null && backupKeyText.length > 0;

  // The held Ghost's sink (spec 09 D1.2 to D1.4). It sinks while the countdown
  // runs. Calm shows the settled sunk pose with no motion. At zero it goes idle,
  // so the CSS rise plays: the Emergence on unlock in place.
  const calm = useCalmInForce();
  const sink = heldGhostSink(done, calm);

  return (
    <div className={waiting ? styles.panel : styles.deskPanel} data-live-wait>
      <DemoLabel />

      {/* The Ghost on the Testify step (spec 13, F4.1). It stands in the first
          viewport above the flow, as the persona Testify step draws it. Its box
          has a fixed height, so the question, the answer control and the verdict
          line below it are never covered (F4.3). Calm_Mode and reduced motion
          show the risen pose with no rise (F4.4). */}
      {step === "testify" ? (
        <div style={TESTIFY_GHOST_BOX} data-live-testify-ghost="">
          <LiveGhost sink={heldGhostSink(true, calm)} />
        </div>
      ) : null}

      {waiting ? (
        <SealedEnvelopeView
          envelopeHash={state.envelopeHash}
          ghost={<LiveGhost sink={sink} />}
        >
          {done ? (
            <p className={styles.status} role="status" data-live-countdown="ready">
              {LIVE_COPY.countdownDone}
            </p>
          ) : (
            <p className={styles.status} role="status" data-live-countdown="ticking">
              {LIVE_COPY.countdown.replace("{seconds}", String(seconds))}
            </p>
          )}
          {rehearsal ? (
            <p className={styles.intro} data-live-rehearsal="">
              {LIVE_COPY.rehearsalLine}
            </p>
          ) : null}
        </SealedEnvelopeView>
      ) : null}

      {flowTarget !== null ? (
        createPortal(
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
          />,
          flowTarget,
        )
      ) : null}

      {waiting ? (
        <>
          {/* The key reminder sits with the unlock control it describes (D1.5). */}
          {showKeyReminder ? (
            <p className={`${styles.intro} ${styles.noPrint}`}>{LIVE_COPY.keyReminder}</p>
          ) : null}
          {done ? (
            <div className={`${styles.actions} ${styles.noPrint}`}>
              <button
                type="button"
                className={styles.primary}
                onClick={() => advanceTo("testify")}
                data-live-open=""
              >
                {LIVE_COPY.openLetter}
              </button>
            </div>
          ) : null}
          {/* The Keep_Section (U6): the letter card, its calendar file, and the
              backup key card offer. It sits below the envelope view. */}
          <section className={styles.keepSection} data-live-keep-section="">
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
          </section>
        </>
      ) : null}
    </div>
  );
}
