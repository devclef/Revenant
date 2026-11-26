"use client";

// Feature: 14-write-desk (spec 14, S3, S5, S6).
//
// The Seal step body, rendered by WriteForm for section `seal`. Two columns at
// 900 px and wider: the text column (heading, paragraph, Warning_Text, the
// Backup_Choice, the PRF fallback and the links) beside the Press_Envelope. One
// column below 900 px, text first. The step owns its own dark surface, so its
// text colours never come from the paper panel.

import { useEffect, useId, useState, type ReactNode } from "react";

import { useCalmInForce } from "@/components/ceremony/motion";

import { BackupChoice } from "../BackupChoice";
import { LIVE_COPY } from "../copy";
import {
  PressEnvelopeView,
  type PressEnvelopeViewModel,
} from "../press/PressEnvelope";
import { usePressEnvelope } from "../press/usePressEnvelope";
import type { BackupChoiceValue } from "../write-draft";
import { SealButton } from "./SealButton";
import { SealLinks } from "./SealLinks";
import { SealSteps } from "./SealSteps";
import { sealButtonLabel } from "./seal-button";
import {
  envelopeCaption,
  pressStatusLine,
  type MotionSetting,
  type PressStatusTag,
} from "./press-status";
import styles from "./seal-step.module.css";

export type SealStepProps = {
  /** The seal state tag the step is in (the Seal step's states only). */
  tag: PressStatusTag;
  backupChoice: BackupChoiceValue | null;
  onBackupChoice: (choice: BackupChoiceValue) => void;
  /** Shown under the Backup_Choice after a press attempt with no choice (S4.5). */
  backupChoiceProblem?: string;
  /** True while the press is blocked (aria-disabled, 40 % seal). */
  pressBlocked: boolean;
  /** True when the press can be used: no prompt is open and the input is valid (S6.5). */
  ready: boolean;
  /** `setting` is the one plain press of the Setting_State (P5). */
  mode: "write" | "setting";
  /** Non-empty question rows, for the envelope caption. */
  questionCount: number;
  /** The PRF check failed at sealing, so the backup key is required. */
  prfMissing: boolean;
  /** Starts the PRF-missing fallback. Absent means the fallback is not offered. */
  onBackupStart?: () => void;
  /** Present only while the Write step can go back (S5.6). */
  onBack?: () => void;
  /** False when the page holds the step's h1 (any step but Seal). Default true. */
  showHeading?: boolean;
  onCreatePress: () => void;
  onConfirmPress: () => void;
  onAttempt: () => void;
  /** Real_Mode (spec 19): the real wording and the skip-help rule. Default false. */
  real?: boolean;
  /** Real_Mode with no opening date yet: the press line asks for one. */
  needsDate?: boolean;
  /** Rendered first in the text column, above the Backup_Choice and the press. */
  opening?: ReactNode;
};

/** The motion setting from the Calm control and the reduced-motion media query (S6.9). */
function useMotionSetting(): MotionSetting {
  const calm = useCalmInForce();
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  if (calm) return "calm";
  return reduced ? "reduced" : "full";
}

export function SealStep({
  tag,
  backupChoice,
  onBackupChoice,
  backupChoiceProblem,
  pressBlocked,
  ready,
  mode,
  questionCount,
  prfMissing,
  onBackupStart,
  onBack,
  showHeading = true,
  onCreatePress,
  onConfirmPress,
  onAttempt,
  real = false,
  needsDate = false,
  opening,
}: SealStepProps) {
  const motion = useMotionSetting();
  // pressStatusLine alone chooses the line: it never reads "choose first" once
  // a choice exists (P1.5).
  const status = pressStatusLine({ tag, backupChoice, motion, needsDate });
  const running =
    tag === "creating" ||
    tag === "confirming" ||
    tag === "preparing" ||
    tag === "sealing";

  const lineId = useId();
  const press = usePressEnvelope({
    mode,
    disabled: pressBlocked,
    instant: motion !== "full",
    onCreatePress,
    onConfirmPress,
    onAttempt,
  });
  const { reset } = press;
  // Each return to the write state starts a fresh press, so a press from before
  // a retry or a Back never carries over.
  useEffect(() => {
    if (tag === "write") reset();
  }, [tag, reset]);

  const view: PressEnvelopeViewModel = {
    ...press,
    mode,
    inert: false,
    blocked: pressBlocked,
    pose: "unpressed",
    running,
    ready,
    tone: status.tone,
    caption: envelopeCaption(questionCount),
    description: status.text,
  };

  return (
    <div data-seal-step="" className={styles.step} data-content-column="">
      <div data-seal-intro="" className={styles.intro}>
        {showHeading ? (
          <h1 className={styles.heading} data-step-heading="" tabIndex={-1}>
            {LIVE_COPY.sealHeading}
          </h1>
        ) : null}
        <p className={styles.body}>{LIVE_COPY.sealParagraph}</p>
        <p className={styles.body} data-warning-text="">
          {LIVE_COPY.warning}
        </p>
      </div>
      <div data-seal-text="" className={styles.text}>
        {/* The opening and the Backup_Choice share one child slot, so the
            links after them keep the child index React uses for useId. */}
        <>
          {opening !== undefined ? (
            <div data-seal-opening="">{opening}</div>
          ) : null}
          <BackupChoice
            value={backupChoice}
            onChange={onBackupChoice}
            problem={backupChoiceProblem}
            disabled={tag !== "write"}
            skipHelp={!real}
          />
        </>
        {prfMissing ? (
          <p className={styles.body} role="status">
            {LIVE_COPY.prfHint}
          </p>
        ) : null}
        {prfMissing && onBackupStart !== undefined ? (
          <button
            type="button"
            className={styles.fallback}
            onClick={onBackupStart}
          >
            {LIVE_COPY.fallbackButton}
          </button>
        ) : null}
        <SealLinks onBack={onBack} />
      </div>
      <div data-press-column="" className={styles.press}>
        <PressEnvelopeView press={view} lineId={lineId} />
        <SealButton
          label={sealButtonLabel(tag)}
          blocked={pressBlocked}
          lineId={lineId}
          onActivate={press.activate}
        />
        <SealSteps tag={tag} backupChoice={backupChoice} real={real} />
      </div>
    </div>
  );
}
