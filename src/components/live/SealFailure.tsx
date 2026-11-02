"use client";

import { CATALOGUE } from "@/lib/figures/catalogue";

import { LIVE_COPY } from "./copy";
import styles from "./live.module.css";
import { RECALL_SUBJECTS } from "./recall-subjects";
import type { SealState } from "./seal-machine";

/**
 * The failure screens for the live Seal_Page (spec 06-lock-and-unlock,
 * design.md "Seal_Page"; R15.6–R15.8, R19.1). One component renders the three
 * terminal failure tags of the SealState union:
 *
 * - `cannot_lock`: this device cannot lock with a passkey.
 * - `cancelled`: the prompt was closed or timed out.
 * - `failed`: one body per SealFailureKind.
 *
 * No screen states or implies the letter was sealed (R15.6–R15.8): none of
 * them carries the sealed title, the countdown, or the go-to-letter copy. Every
 * reader string comes from LIVE_COPY (R19.1); there are no literals here.
 *
 * `onRetry` moves the flow back to the write step (the RETRY event). The
 * `onFallbackStart` placeholder is accepted so SealPage can wire it, but the
 * fallback control is rendered DISABLED with no behaviour until task 7.
 */

/**
 * Name the series behind a missing_then failure. The recall subject is
 * preferred (it reads as a phrase, e.g. "a gallon of regular gasoline"); if the
 * metric has none, the catalogue display name is used, and if the id is in
 * neither the id itself is shown. The number itself is never invented or
 * estimated — only the series is named (data-integrity.md).
 */
export function seriesName(metricId: string): string {
  const subject = RECALL_SUBJECTS[metricId];
  if (subject !== undefined) return subject;

  const entry = CATALOGUE.find((series) => series.metric.id === metricId);
  if (entry !== undefined) return entry.metric.display_name;

  return metricId;
}

export interface SealFailureProps {
  /** A terminal failure state: cannot_lock, cancelled or failed. */
  state: Extract<SealState, { tag: "cannot_lock" | "cancelled" | "failed" }>;
  /** Called by the "Try again" button; the parent dispatches RETRY. */
  onRetry: () => void;
  /**
   * Placeholder for the backup-key fallback (task 7 wires it). The control is
   * rendered disabled, so this is never called here.
   */
  onFallbackStart?: () => void;
}

function failedBody(
  state: Extract<SealState, { tag: "failed" }>,
): string {
  switch (state.kind) {
    case "clock":
      return LIVE_COPY.clockBody;
    case "busy":
      return LIVE_COPY.busyBody;
    case "missing_then":
      return LIVE_COPY.missingThenBody.replace(
        "{name}",
        seriesName(state.metricId ?? ""),
      );
    case "network":
    case "server":
      return LIVE_COPY.failedBody;
  }
}

export function SealFailure({ state, onRetry }: SealFailureProps) {
  if (state.tag === "cannot_lock") {
    return (
      <div className={styles.panel} data-live-failure="cannot_lock">
        <h1 className={styles.heading}>{LIVE_COPY.cannotLockTitle}</h1>
        <p className={styles.intro}>{LIVE_COPY.cannotLockBody}</p>
        <p className={styles.intro}>{LIVE_COPY.cannotLockNext1}</p>
        <p className={styles.intro}>{LIVE_COPY.cannotLockNext2}</p>
        {state.passkeyCreated ? (
          <p className={styles.intro}>{LIVE_COPY.passkeyDeleteNote}</p>
        ) : null}
        <div className={styles.actions}>
          <button type="button" className={styles.primary} disabled>
            {LIVE_COPY.fallbackButton}
          </button>
        </div>
        <p>
          <a className={styles.backLink} href="/demo">
            {LIVE_COPY.backToDemo}
          </a>
        </p>
      </div>
    );
  }

  if (state.tag === "cancelled") {
    return (
      <div className={styles.panel} data-live-failure="cancelled">
        <h1 className={styles.heading}>{LIVE_COPY.cancelledTitle}</h1>
        <p className={styles.intro}>{LIVE_COPY.cancelledBody}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={onRetry}>
            {LIVE_COPY.tryAgain}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel} data-live-failure={`failed-${state.kind}`}>
      <p className={styles.intro}>{failedBody(state)}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={onRetry}>
          {LIVE_COPY.tryAgain}
        </button>
      </div>
    </div>
  );
}
