// Feature: 14-write-desk
//
// Pure functions for the Press_Status_Line and the Press_Envelope caption on
// the Seal step (spec 14, design section 1.5). No React here, so the table
// can be tested as plain data.

import { LIVE_COPY } from "../copy";
import { PRESS_COPY } from "../press/copy";
import type { BackupChoiceValue } from "../write-draft";

/** The motion setting: "calm" when the Calm control is on, "reduced" when only the media query matches. */
export type MotionSetting = "full" | "reduced" | "calm";

export type PressStatus = { text: string; tone: "muted" | "accent" };

/** The seal states that can reach the Seal step before the letter is stored. */
export type PressStatusTag = "write" | "creating" | "created" | "confirming" | "preparing" | "sealing";

/**
 * The Press_Status_Line for every seal state before the letter is stored.
 * Never empty. The line keeps the `write` text for every motion setting while
 * the crypto module has not loaded, so the line says what the seal is for.
 */
export function pressStatusLine(input: {
  tag: PressStatusTag;
  backupChoice: BackupChoiceValue | null;
  motion: MotionSetting;
}): PressStatus {
  switch (input.tag) {
    case "write":
      if (input.backupChoice === null) {
        return { text: PRESS_COPY.chooseFirst, tone: "muted" };
      }
      return {
        text: input.motion === "full" ? PRESS_COPY.holdToSeal : PRESS_COPY.pressToSeal,
        tone: "accent",
      };
    case "creating":
      return { text: LIVE_COPY.stepCreating, tone: "muted" };
    case "created":
      return { text: PRESS_COPY.setting, tone: "muted" };
    case "confirming":
      return { text: LIVE_COPY.stepConfirming, tone: "muted" };
    case "preparing":
      return { text: LIVE_COPY.stepPreparing, tone: "muted" };
    case "sealing":
      return { text: LIVE_COPY.stepSealing, tone: "muted" };
  }
}

/** "To me, on opening day · {n} questions on top", singular for 1, the bare phrase for 0. */
export function envelopeCaption(questionCount: number): string {
  const base = "To me, on opening day";
  if (questionCount === 0) return base;
  if (questionCount === 1) return `${base} · 1 question on top`;
  return `${base} · ${questionCount} questions on top`;
}
