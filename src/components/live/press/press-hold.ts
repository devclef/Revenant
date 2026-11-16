import { SEAL_PRESS_HOLD_MS, SEAL_PRESS_SETTLE_MS } from "./constants";

/**
 * The press model for the seal on the Seal_Step (spec 13, design section 2).
 *
 * A pure reducer. Time is passed in as `now` (milliseconds). It reads no clock,
 * sets no timers and calls no random source. `hold.ts` is not reused: its
 * completed hold moves to a terminal phase that the Break the seal flow acts on,
 * and a press here must wait for the release.
 *
 * The only effect is `start_prompt`. The caller starts the passkey prompt
 * from it, and only from the pointer handler that delivered the release.
 */

export type PressPhase = "idle" | "holding" | "armed" | "settling" | "pressed";

export type PressState = {
  phase: PressPhase;
  /** From 0 to 1. 1 means the hold is complete. */
  progress: number;
  /** Time the current holding or settling phase began, in milliseconds. */
  since?: number;
  /** Progress at the moment a settling phase began. */
  from?: number;
};

export type PressEvent =
  | { type: "DOWN"; now: number }
  | { type: "TICK"; now: number }
  | { type: "UP"; now: number }
  | { type: "CANCEL"; now: number }
  /** Keyboard, assistive-technology click or instant mode. */
  | { type: "ACTIVATE" }
  | { type: "RESET" };

export type PressEffect = "start_prompt" | null;

export const PRESS_IDLE: PressState = { phase: "idle", progress: 0 };

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Progress of a press that began at `since`, measured at `now`. */
function holdProgress(since: number, now: number): number {
  return clamp01(Math.max(0, now - since) / SEAL_PRESS_HOLD_MS);
}

/** Begins settling from `progress`, starting at `now`. A press released early or cancelled recedes. */
function settle(progress: number, now: number): PressState {
  return { phase: "settling", progress, since: now, from: progress };
}

/** A completed press: the prompt starts once, and the press then ignores everything but RESET. */
function complete(): { state: PressState; effect: PressEffect } {
  return { state: { phase: "pressed", progress: 1 }, effect: "start_prompt" };
}

const UNCHANGED = (
  s: PressState,
): { state: PressState; effect: PressEffect } => ({
  state: s,
  effect: null,
});

/**
 * One step of the press model.
 *
 * - `start_prompt` is returned only on `UP` after a full hold, or on `ACTIVATE`.
 * - It is returned at most once between two `RESET`s, because `pressed` ignores everything but `RESET`.
 * - `TICK` and `CANCEL` never return `start_prompt`.
 * - A release before full progress returns no effect.
 */
export function pressStep(
  s: PressState,
  e: PressEvent,
): { state: PressState; effect: PressEffect } {
  if (e.type === "RESET") {
    return { state: PRESS_IDLE, effect: null };
  }

  switch (s.phase) {
    case "idle":
    case "settling":
      if (e.type === "DOWN") {
        return {
          state: { phase: "holding", progress: 0, since: e.now },
          effect: null,
        };
      }
      if (e.type === "ACTIVATE") {
        return complete();
      }
      if (e.type === "TICK" && s.phase === "settling") {
        const elapsed = Math.max(0, e.now - (s.since ?? e.now));
        if (elapsed >= SEAL_PRESS_SETTLE_MS) {
          return UNCHANGED(PRESS_IDLE);
        }
        const from = s.from ?? s.progress;
        const remaining = 1 - elapsed / SEAL_PRESS_SETTLE_MS;
        return UNCHANGED({ ...s, progress: clamp01(from * remaining) });
      }
      return UNCHANGED(s);

    case "holding":
      if (e.type === "TICK") {
        const progress = holdProgress(s.since ?? e.now, e.now);
        return UNCHANGED(
          progress >= 1
            ? { phase: "armed", progress: 1, since: s.since }
            : { ...s, progress },
        );
      }
      if (e.type === "UP") {
        const progress = holdProgress(s.since ?? e.now, e.now);
        return progress >= 1
          ? complete()
          : { state: settle(progress, e.now), effect: null };
      }
      if (e.type === "CANCEL") {
        const progress = holdProgress(s.since ?? e.now, e.now);
        return { state: settle(progress, e.now), effect: null };
      }
      if (e.type === "ACTIVATE") {
        return complete();
      }
      return UNCHANGED(s);

    case "armed":
      if (e.type === "UP") {
        return complete();
      }
      if (e.type === "CANCEL") {
        return { state: settle(1, e.now), effect: null };
      }
      if (e.type === "ACTIVATE") {
        return complete();
      }
      return UNCHANGED(s);

    case "pressed":
      // Double presses are ignored until RESET (P2.8).
      return UNCHANGED(s);
  }
}
