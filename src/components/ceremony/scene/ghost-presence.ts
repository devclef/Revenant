// Feature: 07-judge-journey (task 5)
//
// When the Ghost is mounted (design.md "The dissolve on break", R12.6, R12.8 to
// R12.10). The Ghost holds the envelope while the reader is still holding the
// seal: every pre-reveal Stage and the marks and seal Stages of the reveal. It
// unmounts once the break completes. A completed break in full motion keeps it
// mounted only for the leave (`leaving`), which ends after GHOST_LEAVE_MS.
//
// Pure: no React, no clock. OpeningFlow reads it on every render.

import { GHOST_EXIT_FALLBACK_MS } from "../constants";

/** The inputs that decide whether the Ghost is mounted. */
export type GhostPresenceInput = {
  /** The Opening_Flow state tag, for example `reveal` or `recall`. */
  tag: string;
  /** The reveal stage. Only meaningful when `tag` is `reveal`. */
  stage: 1 | 2 | 3 | null;
  /** True during the leave that follows a completed full-motion break. */
  leaving: boolean;
};

/**
 * True when the Ghost should be mounted. Before the reveal it is always
 * mounted. In the reveal it is mounted only at stage 1 (marks and seal), so a
 * break unmounts it. Calm and Skip never set `leaving`, so the Ghost is gone
 * in the same render as ADVANCE (R12.9, R12.10). Show everything skips stage 2
 * and never sets `leaving`, so no Ghost remains (R12.8).
 */
export function ghostPresent(input: GhostPresenceInput): boolean {
  if (input.leaving) return true;
  if (input.tag !== "reveal") return true;
  return input.stage === 1;
}

// --- Exit lifecycle (spec 07 A11, issue #253) ---
//
// After a completed full-motion break the Ghost leaves, then is removed. The
// removal comes from one of three places: the animationend of the leave, the
// GHOST_EXIT_FALLBACK_MS timer, or at once under Calm_Mode, Skip or Skip_Link.
// PersonaGhost.tsx runs these two rules.

/**
 * CSS modules may prefix keyframe names, so the match is the same as
 * `isRiseName` in useEmergence.ts. Only ghostLeave counts: ghostFade ends first
 * (900 ms against 1,100 ms), so removing on it would cut the last of the move.
 */
const GHOST_LEAVE_NAME = /(?:^|_)ghostLeave(?:_|$)/;

/** True when an animationend on the Ghost's rise element ends its exit. */
export function isGhostExitEnd(animationName: string): boolean {
  return GHOST_LEAVE_NAME.test(animationName);
}

/**
 * How long a leaving Ghost may stay before it is removed anyway. Calm_Mode
 * gives 0, which means remove at once. Full motion gives the fallback, the
 * safety net for an animationend that never fires.
 */
export function ghostExitFallbackMs(calm: boolean): number {
  return calm ? 0 : GHOST_EXIT_FALLBACK_MS;
}
