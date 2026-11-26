"use client";

// Feature: 13-the-seal
//
// PressEnvelope: the one control that presses the seal on the Seal step
// (spec 13, design section 2). It is a native button, so Space and Enter give
// one click with detail 0. The press logic lives in usePressEnvelope.
//
// - Accessible name: "Press the seal". Its description is the one plain line.
// - aria-disabled="true" until a Backup_Choice is made (P1.5). A disabled
//   press starts nothing and reports the attempt through onAttempt.
// - inert: the control accepts no press (failure and cancel screens, P4.3).
//
// PressEnvelope owns the hooks and the props. PressEnvelopeView owns the
// markup and takes the press binding and the line id from its caller.

import { useId } from "react";

import { PRESS_COPY } from "./copy";
import type { SealPose } from "./press-pose";
import { usePressSkip } from "./press-skip";
import styles from "./press.module.css";
import { usePressEnvelope, type UsePressEnvelope } from "./usePressEnvelope";

export type PressEnvelopeProps = {
  /** `write` starts the sealing prompt on a hold or activation. `setting` is the one plain press of the Setting_State. */
  mode?: "write" | "setting";
  /** True until a Backup_Choice is made and the input is valid. */
  disabled?: boolean;
  /** Reduced motion or Calm_Mode: no hold, one activation runs the press (P2.7). */
  instant?: boolean;
  /** Renders the envelope with no press at all (the lifted seal on failure, P4.3). */
  inert?: boolean;
  /** The wax and Signet pose. Set by the caller from the seal state. */
  pose?: SealPose;
  /** A passkey prompt or sealing is running (creating, confirming, preparing, sealing). The wax stays whole while blocked. */
  running?: boolean;
  /** Replaces the default plain line under the envelope. */
  line?: string;
  /** The colour of the status line (spec 14, S6.7). Defaults to muted. */
  tone?: "muted" | "accent";
  /** Display-only caption at the bottom left of the envelope (spec 14, S6.2). Not part of the accessible name. */
  caption?: string;
  /** True when a choice is made, crypto is loaded and no prompt is open: full opacity with the halo (spec 14, S6.5). */
  ready?: boolean;
  /** True while the Signet or Setting_State animation runs. Registers the page Skip (P2.6). */
  animating?: boolean;
  /** Moves the running animation to its final frame. Never answers a prompt. */
  onSkip?: () => void;
  onCreatePress?: () => void;
  onConfirmPress?: () => void;
  onAttempt?: () => void;
};

const NOOP = (): void => undefined;

export function PressEnvelope({
  mode = "write",
  disabled = false,
  instant = false,
  inert = false,
  pose = "unpressed",
  running = false,
  line,
  tone = "muted",
  caption,
  ready = false,
  animating = false,
  onSkip = NOOP,
  onCreatePress = NOOP,
  onConfirmPress = NOOP,
  onAttempt = NOOP,
}: PressEnvelopeProps) {
  const lineId = useId();
  const press = usePressEnvelope({
    mode: inert ? "inert" : mode,
    disabled,
    instant,
    onCreatePress,
    onConfirmPress,
    onAttempt,
  });
  usePressSkip(animating && !inert, onSkip);

  const blocked = disabled || inert;
  // The inert (failure) control shows no line. The setting press shows the
  // one Setting_State line; the disabled press shows the choose-first line.
  let description = "";
  if (line !== undefined) {
    description = line;
  } else if (!inert && disabled) {
    description = PRESS_COPY.chooseFirst;
  } else if (!inert && mode === "setting") {
    description = PRESS_COPY.setting;
  }

  return (
    <PressEnvelopeView
      press={press}
      lineId={lineId}
      mode={mode}
      inert={inert}
      blocked={blocked}
      pose={pose}
      running={running}
      ready={ready}
      tone={tone}
      caption={caption}
      description={description}
    />
  );
}

export type PressEnvelopeViewProps = {
  /** The press binding from usePressEnvelope: handlers, element ref and pool stage. */
  press: UsePressEnvelope;
  /** The id the status line uses; the control points to it with aria-describedby. */
  lineId: string;
  mode: "write" | "setting";
  inert: boolean;
  /** True when the control is disabled or inert (aria-disabled). */
  blocked: boolean;
  pose: SealPose;
  running: boolean;
  ready: boolean;
  tone: "muted" | "accent";
  caption?: string;
  /** The plain line under the envelope. */
  description: string;
};

export function PressEnvelopeView({
  press,
  lineId,
  mode,
  inert,
  blocked,
  pose,
  running,
  ready,
  tone,
  caption,
  description,
}: PressEnvelopeViewProps) {
  const { handlers, elementRef, stage } = press;

  return (
    <div className={styles.wrap}>
      <button
        ref={elementRef}
        type="button"
        className={styles.press}
        aria-label={PRESS_COPY.name}
        aria-describedby={lineId}
        aria-disabled={blocked ? "true" : "false"}
        data-seal-pose={pose}
        data-press-target=""
        data-pool-stage={stage ?? undefined}
        data-press-mode={inert ? "inert" : mode}
        data-press-running={running && !inert ? "" : undefined}
        data-ready={ready && !blocked ? "" : undefined}
        onPointerDown={handlers.onPointerDown}
        onClick={handlers.onClick}
        onContextMenu={handlers.onContextMenu}
      >
        <span className={styles.envelope} aria-hidden="true">
          <span className={styles.flap} />
          <span className={styles.wax} data-wax="">
            <svg
              className={styles.relief}
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
              data-wax-relief=""
            >
              <path d="M12 3a6.5 6.5 0 0 0-6.5 6.5V20l2.2-1.8L9.5 20l2.5-1.8 2.5 1.8 1.8-1.8 2.2 1.8V9.5A6.5 6.5 0 0 0 12 3Zm-2.4 6.6a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Zm4.8 0a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Z" />
            </svg>
          </span>
          {caption !== undefined ? (
            <span className={styles.caption}>{caption}</span>
          ) : null}
        </span>
      </button>
      <p
        id={lineId}
        className={styles.line}
        data-press-line=""
        data-tone={tone}
        role="status"
      >
        {description}
      </p>
    </div>
  );
}
