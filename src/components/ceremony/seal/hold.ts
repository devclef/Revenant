// Feature: 05-reveal-ceremony
//
// The pure hold model for the Seal_Break (design.md "Seal_Break", R6). Pressing
// and holding the wax seal for SEAL_HOLD_MS breaks it; releasing early lets the
// cracks recede over SEAL_SETTLE_MS and nothing is sent. A drag counts as
// holding: pointer movement never resets or pauses the clock, so the model
// takes only the current timestamp and never reads the contact point.
//
// This module is pure. It owns no DOM, no timers, and no non-determinism: it
// calls neither Math.random nor Date.now. Every timestamp is passed in as an
// argument so the caller (SealBreak) controls the clock and the same inputs
// always produce the same outputs.

import { SEAL_HOLD_MS, SEAL_SETTLE_MS } from "../constants";

/**
 * The hold's phase and how far it has progressed.
 *
 * - `idle`: nothing is happening; `progress` is 0.
 * - `holding`: a press (or drag) is in progress; `progress` grows from 0 to 1
 *   over SEAL_HOLD_MS. Reaching 1 moves to `broken`.
 * - `settling`: the press was released before `progress` reached 1; `progress`
 *   recedes to 0 over SEAL_SETTLE_MS, then the phase returns to `idle`.
 * - `broken`: the seal has broken. Terminal: nothing moves it out of `broken`.
 *
 * `progress` is always clamped to the range 0..1.
 */
export type HoldState = {
  phase: "idle" | "holding" | "settling" | "broken";
  progress: number;
};

/** The resting state: idle with no progress. */
export const IDLE: HoldState = { phase: "idle", progress: 0 };

/**
 * Internal timing anchors. These never leave the module; a caller keeps a
 * `HoldState` and the anchor together is not needed, because the model derives
 * progress purely from `now` and the stored anchors below.
 */
type Anchored = HoldState & {
  /** When `holding` began (ms). */
  start?: number;
  /** When `settling` began (ms), and the progress it started receding from. */
  settleStart?: number;
  settleFrom?: number;
};

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Begin a hold. A press always (re)starts the clock from `now`, unless the seal
 * is already `broken`, which is terminal and ignores further presses. Starting
 * a press from `settling` abandons the recede and holds afresh.
 */
export function onPress(s: HoldState, now: number): HoldState {
  if (s.phase === "broken") return s;
  const next: Anchored = { phase: "holding", progress: 0, start: now };
  return next;
}

/**
 * Advance the clock to `now`.
 *
 * - While `holding`, `progress = (now - start) / SEAL_HOLD_MS`, clamped to
 *   0..1. When it reaches 1 the phase becomes `broken`.
 * - While `settling`, `progress` recedes linearly to 0 over SEAL_SETTLE_MS from
 *   where the release left it; on reaching 0 the phase returns to `idle`.
 * - `idle` and `broken` are unchanged.
 */
export function onTick(s: HoldState, now: number): HoldState {
  const a = s as Anchored;
  if (a.phase === "holding") {
    const start = a.start ?? now;
    const progress = clamp01((now - start) / SEAL_HOLD_MS);
    if (progress >= 1) return { phase: "broken", progress: 1 };
    return { phase: "holding", progress, start } as Anchored;
  }
  if (a.phase === "settling") {
    const settleStart = a.settleStart ?? now;
    const settleFrom = a.settleFrom ?? a.progress;
    const elapsed = SEAL_SETTLE_MS <= 0 ? 1 : (now - settleStart) / SEAL_SETTLE_MS;
    // Once the settle window has elapsed, return idle exactly. Computing the
    // receded value first can leave a tiny positive residue from floating-point
    // rounding (for example 7e-18), which would keep the phase in `settling`.
    // `elapsed` can also land a hair under 1 (for example 0.9999999999999999)
    // when `now` is large, so allow a tiny tolerance before treating it as done.
    if (elapsed >= 1 - 1e-9) return IDLE;
    const progress = settleFrom * (1 - clamp01(elapsed));
    if (progress <= 0) return IDLE;
    return { phase: "settling", progress, settleStart, settleFrom } as Anchored;
  }
  return s;
}

/**
 * Release the press.
 *
 * - From `holding` with `progress < 1`: begin `settling`, receding from the
 *   current progress to 0 over SEAL_SETTLE_MS. Nothing is sent.
 * - From `holding` with `progress >= 1`: the seal is `broken` (a release that
 *   lands exactly at the threshold still breaks it).
 * - `idle`, `settling` and `broken` are unchanged.
 */
export function onRelease(s: HoldState, now: number): HoldState {
  const a = s as Anchored;
  if (a.phase !== "holding") return s;
  const start = a.start ?? now;
  const progress = clamp01((now - start) / SEAL_HOLD_MS);
  if (progress >= 1) return { phase: "broken", progress: 1 };
  return {
    phase: "settling",
    progress,
    settleStart: now,
    settleFrom: progress,
  } as Anchored;
}

/**
 * True exactly once: on the transition into `broken`. `SealBreak` sends
 * `onAdvance()` only when this is true, so the advance fires once and never
 * again while the state stays `broken`.
 */
export function isBreak(prev: HoldState, next: HoldState): boolean {
  return next.phase === "broken" && prev.phase !== "broken";
}
