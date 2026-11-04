// Feature: 07-judge-journey
//
// useSealBreak owns the Seal_Break controller (design.md "Seal_Break", task 5).
// The hold logic moved here from SealBreak.tsx; the pure clock stays in
// hold.ts, which is unchanged. OpeningFlow calls this hook once, in reveal
// stage 1, and passes the same controller to the views that show the seal.
//
// The controller:
//   - press(target, pointerId): a pointer hold. Starts the clock, captures the
//     pointer inside a try, and listens on window for pointerup and
//     pointercancel as the fallback that ends the hold.
//   - breakNow(root): the "Break the seal" button. In Calm_Mode it sends ADVANCE
//     at once. In full motion it plays the short crack draw over SEAL_SHORT_MS
//     with Web Animations, then sends ADVANCE. If a Web Animation throws, it
//     sends ADVANCE at once.
//   - skip() and showAll(): the Skip control and "Show everything".
//   - connect(host): SealBreak hands in the context values the hook cannot read
//     itself (live region, sound, Calm_Mode, sealing flag). OpeningFlow is above
//     the providers, so it cannot read them.
//
// ADVANCE is sent once per controller, on the transition into `broken` (R6.5,
// Property 5). Early release settles the cracks, announces "The seal holds."
// and sends nothing (R6.4).
//
// No Math.random and no Date.now here. performance.now() is read only in event
// handlers and the rAF loop, never during render.

import { useCallback, useEffect, useRef, useState } from "react";

import { SEAL_SHORT_MS } from "../constants";
import { CEREMONY_COPY } from "../copy";
import { soundCues } from "../sound/cues";
import { IDLE, isBreak, onPress, onRelease, onTick, type HoldState } from "./hold";
import { TOTAL_LENGTH } from "./cracks";

/** The context values SealBreak hands to the controller. */
export type SealHost = {
  /** Announce a line to the polite live region. */
  announce: (text: string) => void;
  /** Calm_Mode: the break sends ADVANCE at once, with no short crack draw. */
  calm: boolean;
  /** Sound toggle (R14.2). The break cue plays only while this is true. */
  soundOn: boolean;
  /** Report the `sealing` flag up to the local view (design.md "Stage resolution"). */
  onSealingChange?: (sealing: boolean) => void;
};

/** The hook's inputs: the flow's ADVANCE and SHOW_ALL senders. */
export type UseSealBreakOptions = {
  /**
   * Sends ADVANCE. Called exactly once per controller (R6.5). The argument is
   * `true` only when the break played in full motion, so the Ghost leaves
   * with an exit. Calm, Skip and a Web Animation that threw pass `false`, and
   * the Ghost unmounts at once (R12.6, R12.9, R12.10).
   */
  onAdvance: (animated: boolean) => void;
  /** Sends SHOW_ALL ("Show everything"). Optional. */
  onShowAll?: () => void;
};

/** What the seal views read and call. */
export type SealController = {
  /** The pure hold state from hold.ts. */
  hold: HoldState;
  /** True once the seal has broken. */
  broken: boolean;
  /** Hold progress, 0..1. A broken seal reads 1. */
  progress: number;
  /** Pointer press on the seal. `target` is the element that captures the pointer. */
  press: (target: Element | null, pointerId: number) => void;
  /** The button path. `root` is the crack overlay whose paths the short draw animates. */
  breakNow: (root?: Element | null) => void;
  /** "Show everything": the seal renders split and SHOW_ALL is sent. */
  showAll: () => void;
  /** Skip: go to the end state and send ADVANCE once if it has not been sent. */
  skip: () => void;
  /** Hand over the context values. Called from SealBreak after each render. */
  connect: (host: SealHost) => void;
};

const NO_HOST: SealHost = {
  announce: () => undefined,
  calm: false,
  soundOn: false,
};

/** Minimal shape of a Web Animation the short draw needs. */
type ShortAnimation = { finished: Promise<unknown>; cancel: () => void };

/** The hook. Call it once, in reveal stage 1. */
export function useSealBreak({ onAdvance, onShowAll }: UseSealBreakOptions): SealController {
  const [hold, setHoldState] = useState<HoldState>(IDLE);

  // Refs the rAF loop and the handlers read without re-subscribing. `holdRef`
  // mirrors `hold` so the loop always ticks the current state. `advancedRef`
  // guards ADVANCE to exactly once (R6.5, Property 5).
  const holdRef = useRef<HoldState>(IDLE);
  const rafRef = useRef<number | null>(null);
  const advancedRef = useRef(false);
  const hostRef = useRef<SealHost>(NO_HOST);
  const captureRef = useRef<{ el: Element; id: number } | null>(null);
  const windowUpRef = useRef<(() => void) | null>(null);
  const shortTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shortAnimsRef = useRef<ShortAnimation[]>([]);

  // Latest senders, read from refs so handlers never close over a stale prop.
  const onAdvanceRef = useRef(onAdvance);
  const onShowAllRef = useRef(onShowAll);
  useEffect(() => {
    onAdvanceRef.current = onAdvance;
    onShowAllRef.current = onShowAll;
  }, [onAdvance, onShowAll]);

  const setHold = useCallback((next: HoldState) => {
    holdRef.current = next;
    setHoldState(next);
  }, []);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const cancelShort = useCallback(() => {
    if (shortTimerRef.current !== null) {
      clearTimeout(shortTimerRef.current);
      shortTimerRef.current = null;
    }
    for (const anim of shortAnimsRef.current) anim.cancel();
    shortAnimsRef.current = [];
  }, []);

  const removeWindowListeners = useCallback(() => {
    const handler = windowUpRef.current;
    if (handler !== null) {
      window.removeEventListener("pointerup", handler);
      window.removeEventListener("pointercancel", handler);
      windowUpRef.current = null;
    }
  }, []);

  const releaseCapture = useCallback(() => {
    const capture = captureRef.current;
    if (capture !== null) {
      try {
        capture.el.releasePointerCapture(capture.id);
      } catch {
        // Already released or never captured. Nothing to do.
      }
    }
    captureRef.current = null;
  }, []);

  // Break the seal: show the split, send ADVANCE at most once (R6.5).
  const doBreak = useCallback(
    (animated: boolean) => {
      stopRaf();
      cancelShort();
      setHold({ phase: "broken", progress: 1 });
      const host = hostRef.current;
      host.onSealingChange?.(false);
      host.announce(CEREMONY_COPY.sealBroken);
      if (!advancedRef.current) {
        advancedRef.current = true;
        // The break cue plays once per break and only while sound is on (R14.2).
        void soundCues.sealBreak(host.soundOn);
        onAdvanceRef.current(animated);
      }
    },
    [cancelShort, setHold, stopRaf],
  );

  // The rAF loop: advance the clock, apply isBreak exactly once, and settle.
  const loop = useCallback(() => {
    const now = performance.now();
    const prev = holdRef.current;
    const next = onTick(prev, now);

    if (isBreak(prev, next)) {
      doBreak(!hostRef.current.calm);
      return;
    }

    setHold(next);

    if (next.phase === "holding" || next.phase === "settling") {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    // Settled back to idle after an early release: nothing was sent (R6.4).
    rafRef.current = null;
    if (next.phase === "idle") {
      hostRef.current.onSealingChange?.(false);
    }
  }, [doBreak, setHold]);

  const startLoop = useCallback(() => {
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(loop);
    }
  }, [loop]);

  const endHold = useCallback(() => {
    // A release while holding settles the cracks back and sends nothing (R6.4).
    // A release at full progress breaks the seal.
    const now = performance.now();
    const next = onRelease(holdRef.current, now);
    setHold(next);
    releaseCapture();
    removeWindowListeners();
    if (next.phase === "settling") {
      hostRef.current.announce(CEREMONY_COPY.sealHolds);
      startLoop();
    } else if (next.phase === "broken") {
      doBreak(!hostRef.current.calm);
    }
  }, [doBreak, releaseCapture, removeWindowListeners, setHold, startLoop]);

  const press = useCallback(
    (target: Element | null, pointerId: number) => {
      if (holdRef.current.phase === "broken" || advancedRef.current) return;
      // Calm_Mode: a hold would draw the cracks over its length, which is
      // decorative motion. The button breaks the seal at once instead (R19.2,
      // R19.3), so a press starts nothing.
      if (hostRef.current.calm) return;
      setHold(onPress(holdRef.current, performance.now()));
      hostRef.current.onSealingChange?.(true);

      // Keep the pointer stream on the target even if the finger drifts off it.
      // setPointerCapture can throw; then the window listeners below still end
      // the hold on release.
      captureRef.current = null;
      if (target !== null) {
        try {
          target.setPointerCapture(pointerId);
          captureRef.current = { el: target, id: pointerId };
        } catch {
          captureRef.current = null;
        }
      }
      removeWindowListeners();
      const handler = () => endHold();
      windowUpRef.current = handler;
      window.addEventListener("pointerup", handler);
      window.addEventListener("pointercancel", handler);
      startLoop();
    },
    [endHold, removeWindowListeners, setHold, startLoop],
  );

  const breakNow = useCallback(
    (root?: Element | null) => {
      if (holdRef.current.phase === "broken" || advancedRef.current) return;
      const host = hostRef.current;
      if (host.calm) {
        // Calm_Mode: the split shows at once and ADVANCE is sent with no motion.
        doBreak(false);
        return;
      }
      // Full motion: the short crack draw runs, then the break completes.
      host.onSealingChange?.(true);
      const finish = () => {
        shortAnimsRef.current = [];
        shortTimerRef.current = null;
        // A cancelled draw (Skip or Show everything) has already broken the seal.
        if (holdRef.current.phase === "broken") return;
        doBreak(true);
      };
      if (root === undefined || root === null) {
        shortTimerRef.current = setTimeout(finish, SEAL_SHORT_MS);
        return;
      }
      try {
        const paths = Array.from(root.querySelectorAll("path"));
        const anims: ShortAnimation[] = [];
        shortAnimsRef.current = anims;
        for (const path of paths) {
          if (typeof path.animate !== "function") {
            throw new Error("Web Animations are not available");
          }
          anims.push(
            path.animate(
              [
                { strokeDashoffset: `${TOTAL_LENGTH}` },
                { strokeDashoffset: "0" },
              ],
              { duration: SEAL_SHORT_MS, fill: "forwards" },
            ) as ShortAnimation,
          );
        }
        void Promise.all(anims.map((anim) => anim.finished)).then(finish, finish);
      } catch {
        // A Web Animation threw. Send ADVANCE once at once so the reader is not stuck.
        cancelShort();
        doBreak(false);
      }
    },
    [cancelShort, doBreak],
  );

  const showAll = useCallback(() => {
    if (holdRef.current.phase !== "broken") {
      stopRaf();
      cancelShort();
      setHold({ phase: "broken", progress: 1 });
    }
    onShowAllRef.current?.();
  }, [cancelShort, setHold, stopRaf]);

  const skip = useCallback(() => {
    stopRaf();
    cancelShort();
    if (holdRef.current.phase !== "broken") {
      // Skip jumps straight to the end state, so the Ghost does not leave.
      doBreak(false);
    }
  }, [cancelShort, doBreak, stopRaf]);

  const connect = useCallback((host: SealHost) => {
    hostRef.current = host;
  }, []);

  // Tidy the rAF loop, timers, animations and window listeners on unmount.
  useEffect(() => {
    return () => {
      stopRaf();
      cancelShort();
      removeWindowListeners();
    };
  }, [cancelShort, removeWindowListeners, stopRaf]);

  const broken = hold.phase === "broken";
  return {
    hold,
    broken,
    progress: broken ? 1 : hold.progress,
    press,
    breakNow,
    showAll,
    skip,
    connect,
  };
}
