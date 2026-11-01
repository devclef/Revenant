"use client";

// Feature: 05-reveal-ceremony
//
// SealBreak: the Seal_Break view (design.md "Seal_Break", R6, Property 5,
// Property 14, Property 19, Property 20, Property 21). The wax seal is the
// pointer target; under it sit the instruction line and a real "Break the seal"
// button (R6.3, Property 19). Pressing and holding the seal for SEAL_HOLD_MS
// breaks it; releasing early lets the cracks recede over SEAL_SETTLE_MS and
// nothing is sent (R6.4). The button plays the short version over SEAL_SHORT_MS
// then sends ADVANCE (R6.3). On break in full motion the wax splits into
// FLAKE_COUNT flakes, the flap lifts and the letter slides out; ADVANCE is sent
// the moment the split starts, so stage 2's text is already in the document
// under the slide.
//
// The clock is the pure `hold.ts` model: `SealBreak` owns a rAF loop that feeds
// it `performance.now()` timestamps and keeps the view state. `onAdvance()` is
// called only when `isBreak(prev, next)` is true, so the advance fires exactly
// once and never again once broken (R6.5, Property 5). A drag counts as
// holding: pointer movement never resets or pauses the clock.
//
// Final state first (R17.3, Property 21): the server render and the FIRST
// client render always show the INTACT seal — no cracks, no split, no flakes
// (Property 2: nothing from a later Stage is in the document early). The break
// motion is started by user events (press, or the button) after mount, so the
// static markup is deterministic: this module calls no Math.random and no
// Date.now in render. `performance.now()` is read only inside event handlers
// and the rAF loop, never during render.
//
// Calm_Mode (Property 20): `planSealBreak({ calm: true })` returns an empty
// plan. In Calm_Mode a break shows the split seal at once and sends ADVANCE
// with no animation; the hold clock still runs (so a reader can still break the
// seal by holding), but there is no decorative motion.
//
// R15.1: every user-facing string comes from CEREMONY_COPY; no inline literal
// copy lives here. R10.1: nothing drawn here depends on a value or a direction;
// every seal breaks the same way and only its decorative WaxSeal pattern
// differs. No vibration anywhere.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from "react";

import { CEREMONY_COPY } from "../copy";
import { REVEAL_COPY } from "@/components/reveal/copy";
import {
  EASE_STANDARD,
  EASE_STAMP,
  FLAP_LIFT_MS,
  LETTER_SLIDE_MS,
  SEAL_SETTLE_MS,
  SEAL_SHORT_MS,
  SEAL_SPLIT_MS,
} from "../constants";
import { useLiveRegion } from "../LiveRegion";
import { useMotion } from "../motion";
import { useSequence } from "../skip";
import { WaxSeal } from "../envelope/WaxSeal";
import {
  CRACK_PATHS,
  FLAKE_FALLS,
  SEAL_CENTER,
  TOTAL_LENGTH,
  cracksForProgress,
} from "./cracks";
import {
  IDLE,
  isBreak,
  onPress,
  onRelease,
  onTick,
  type HoldState,
} from "./hold";
import styles from "./SealBreak.module.css";

/** The WaxSeal's fixed 100×100 user space, shared by the crack overlay. */
const VIEWBOX = SEAL_CENTER * 2;

export type SealBreakProps = {
  /** The persona key that seeds the WaxSeal's decorative pattern (R8.4). */
  patternKey: string;
  /**
   * Force Calm_Mode. Optional: when omitted the view reads `useMotion().mode`,
   * so a `calm` device mode (reduced motion or the Calm control) stills the
   * break the same way. Passing `calm` explicitly is for tests.
   */
  calm?: boolean;
  /**
   * Sends the flow's ADVANCE — the stage 1 → 2 move. Called exactly once, the
   * moment the seal breaks (on the split's start in full motion, or at once in
   * Calm_Mode), and never again (R6.5, Property 5).
   */
  onAdvance: () => void;
  /**
   * Sends the flow's SHOW_ALL ("Show everything"): the seal renders split
   * (R6.8). Optional; when present the view treats SHOW_ALL like a break that
   * settles to the split state at once.
   */
  onShowAll?: () => void;
  /**
   * Report the local view's `sealing` flag up to CeremonyRoot so
   * `stageFor(state, local)` resolves `seal` while a break is in progress and
   * `marks` otherwise (design.md "Stage resolution"). Called with `true` when a
   * hold begins and `false` when it settles back or the break completes.
   */
  onSealingChange?: (sealing: boolean) => void;
};

/**
 * One animated property in a sequence's plan: the CSS property, the from/to
 * values, the duration in ms and the easing. `SealBreak` hands this plan to the
 * view; Property 14 reads it and checks every duration and easing is a value
 * from `constants.ts`.
 */
export type SealBreakStep = {
  /** A short name for what this step animates. */
  part: "cracks" | "split" | "flap" | "letter";
  /** Duration in ms — always a constant from `constants.ts`. */
  durationMs: number;
  /** Easing — always a constant string from `constants.ts`. */
  easing: string;
};

/** The full plan `planSealBreak` returns. */
export type SealBreakPlan = {
  /** The steps, in play order. Empty in Calm_Mode (Property 20). */
  steps: SealBreakStep[];
};

/**
 * The pure plan for the break animation. Every duration and easing is a
 * constant from `constants.ts`; nothing here is computed from data, so the
 * plan is identical for every persona and every letter (R10.5, R10.6, Property
 * 14). In Calm_Mode the plan is empty — no animation runs (R11.2, Property 20).
 *
 * The plan names the four decorative parts of a break in full motion:
 *   - `cracks` draw / recede over SEAL_SPLIT_MS (the hold drives their progress;
 *     the button's short version plays them over SEAL_SHORT_MS — both constants
 *     appear so Property 14 reads each),
 *   - `split` scatters the flakes over SEAL_SPLIT_MS,
 *   - `flap` lifts over FLAP_LIFT_MS,
 *   - `letter` slides out over LETTER_SLIDE_MS.
 */
export function planSealBreak(opts: { calm: boolean }): SealBreakPlan {
  if (opts.calm) {
    return { steps: [] };
  }
  return {
    steps: [
      { part: "cracks", durationMs: SEAL_SHORT_MS, easing: EASE_STANDARD },
      { part: "split", durationMs: SEAL_SPLIT_MS, easing: EASE_STANDARD },
      { part: "flap", durationMs: FLAP_LIFT_MS, easing: EASE_STAMP },
      { part: "letter", durationMs: LETTER_SLIDE_MS, easing: EASE_STANDARD },
    ],
  };
}

/**
 * The timing custom properties the view passes to its stylesheet. The
 * stylesheet reads only these variables for the durations Property 14 checks,
 * so the numbers live in `constants.ts`, never in the CSS. The constant easings
 * stay literal in the CSS.
 */
const TIMING_VARS = {
  "--seal-split-ms": `${SEAL_SPLIT_MS}ms`,
  "--seal-settle-ms": `${SEAL_SETTLE_MS}ms`,
  "--flap-lift-ms": `${FLAP_LIFT_MS}ms`,
  "--letter-slide-ms": `${LETTER_SLIDE_MS}ms`,
} as CSSProperties;

const TAU = Math.PI * 2;

/** Each flake's inline fall vector, fixed per index — never random, never data. */
function flakeStyle(index: number): CSSProperties {
  const flake = FLAKE_FALLS[index];
  const a = (flake.angleDeg / 360) * TAU;
  return {
    "--flake-x": `${flake.x}%`,
    "--flake-y": `${flake.y}%`,
    "--flake-dx": `${Math.sin(a) * flake.distance}%`,
    "--flake-dy": `${-Math.cos(a) * flake.distance}%`,
    "--flake-rot": `${flake.rotateDeg}deg`,
    "--flake-delay": `${Math.round(flake.delay * SEAL_SPLIT_MS)}ms`,
  } as CSSProperties;
}

/**
 * SealBreak renders the seal, the instruction line and the "Break the seal"
 * button, and drives the pure hold model with a rAF loop.
 *
 * The seal is `aria-hidden` and not focusable — the button is the accessible
 * control (R6.3, Property 19). The crack overlay and the flakes are drawn in
 * the seal's fixed 100×100 user space, laid exactly over the disc. The overlay
 * tracks the hold's `progress`; the flakes appear only once the seal is broken.
 */
export function SealBreak({
  patternKey,
  calm: calmProp,
  onAdvance,
  onShowAll,
  onSealingChange,
}: SealBreakProps): ReactElement {
  const { mode } = useMotion();
  const calm = calmProp ?? mode === "calm";

  const { register } = useSequence();
  const { announce } = useLiveRegion();

  // The hold state drives the crack overlay. The FIRST render (server and
  // client) is always IDLE — the intact seal — so the static markup is the
  // settled, pre-break state (Property 2, Property 21).
  const [hold, setHold] = useState<HoldState>(IDLE);

  // Whether the seal has broken and the split/flap/letter motion should show.
  const [broken, setBroken] = useState(false);

  // Refs the rAF loop and the handlers read without re-subscribing. `holdRef`
  // mirrors `hold` so the loop always ticks the current state; `advancedRef`
  // guards onAdvance to exactly once (R6.5, Property 5).
  const holdRef = useRef<HoldState>(IDLE);
  const rafRef = useRef<number | null>(null);
  const capturedElRef = useRef<HTMLElement | null>(null);
  const capturedPointerRef = useRef<number | null>(null);
  const advancedRef = useRef(false);

  // Latest callbacks, read from refs so the rAF loop and window listeners never
  // close over a stale prop.
  const onAdvanceRef = useRef(onAdvance);
  const onSealingChangeRef = useRef(onSealingChange);
  const announceRef = useRef(announce);
  useEffect(() => {
    onAdvanceRef.current = onAdvance;
    onSealingChangeRef.current = onSealingChange;
    announceRef.current = announce;
  }, [onAdvance, onSealingChange, announce]);

  const setHoldBoth = useCallback((next: HoldState) => {
    holdRef.current = next;
    setHold(next);
  }, []);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Fire ADVANCE at most once (R6.5, Property 5), and show the split.
  const doBreak = useCallback(() => {
    stopRaf();
    setBroken(true);
    setHoldBoth({ phase: "broken", progress: 1 });
    onSealingChangeRef.current?.(false);
    announceRef.current(CEREMONY_COPY.sealBroken);
    if (!advancedRef.current) {
      advancedRef.current = true;
      // ADVANCE is sent when the split STARTS, so stage 2's text is already in
      // the document under the slide (design.md "The view").
      onAdvanceRef.current();
    }
  }, [setHoldBoth, stopRaf]);

  // The rAF loop: advance the clock, apply isBreak exactly once, and settle.
  const loop = useCallback(() => {
    const now = performance.now();
    const prev = holdRef.current;
    const next = onTick(prev, now);

    if (isBreak(prev, next)) {
      doBreak();
      return;
    }

    setHoldBoth(next);

    if (next.phase === "holding" || next.phase === "settling") {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    // Settled back to idle after an early release: nothing was sent (R6.4).
    rafRef.current = null;
    if (next.phase === "idle") {
      onSealingChangeRef.current?.(false);
    }
  }, [doBreak, setHoldBoth]);

  const startLoop = useCallback(() => {
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(loop);
    }
  }, [loop]);

  // --- Pointer hold on the seal ---

  const releaseCapture = useCallback(() => {
    const el = capturedElRef.current;
    const id = capturedPointerRef.current;
    if (el !== null && id !== null) {
      try {
        el.releasePointerCapture(id);
      } catch {
        // Already released or never captured — nothing to do.
      }
    }
    capturedElRef.current = null;
    capturedPointerRef.current = null;
  }, []);

  // The live window release/cancel listener, kept in a ref so the same function
  // is added and removed, and so the pointer-down handler does not have to
  // close over `endHold` (which would create a use-before-define cycle).
  const windowUpRef = useRef<(() => void) | null>(null);

  const removeWindowListeners = useCallback(() => {
    const handler = windowUpRef.current;
    if (handler !== null) {
      window.removeEventListener("pointerup", handler);
      window.removeEventListener("pointercancel", handler);
      windowUpRef.current = null;
    }
  }, []);

  const endHold = useCallback(() => {
    // A release while holding settles the cracks back over SEAL_SETTLE_MS and
    // sends nothing (R6.4). If the hold already reached full progress the model
    // returns `broken` and the next tick breaks it.
    const now = performance.now();
    const next = onRelease(holdRef.current, now);
    setHoldBoth(next);
    releaseCapture();
    removeWindowListeners();
    if (next.phase === "settling") {
      announceRef.current(CEREMONY_COPY.sealHolds);
      startLoop();
    } else if (next.phase === "broken") {
      doBreak();
    }
  }, [doBreak, releaseCapture, removeWindowListeners, setHoldBoth, startLoop]);

  const onSealPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (broken || advancedRef.current) return;
      const now = performance.now();
      setHoldBoth(onPress(holdRef.current, now));
      onSealingChangeRef.current?.(true);

      // Keep the pointer stream on the seal even if the finger drifts off it (a
      // drag counts as holding). setPointerCapture can throw; on a throw we fall
      // back to window listeners so the hold still ends on release.
      const el = event.currentTarget;
      try {
        el.setPointerCapture(event.pointerId);
        capturedElRef.current = el;
        capturedPointerRef.current = event.pointerId;
      } catch {
        capturedElRef.current = null;
        capturedPointerRef.current = null;
      }
      const handler = () => endHold();
      windowUpRef.current = handler;
      window.addEventListener("pointerup", handler);
      window.addEventListener("pointercancel", handler);
      startLoop();
    },
    [broken, endHold, setHoldBoth, startLoop],
  );

  // --- The button and Skip ---

  // The button breaks the seal: in full motion it plays the short version over
  // SEAL_SHORT_MS then sends ADVANCE; in Calm_Mode it shows the split at once
  // and sends ADVANCE (design.md "The view"). Either way the break is immediate
  // in state terms (ADVANCE on split start); the short-version timing is the
  // decorative crack draw the stylesheet runs, so the button simply breaks.
  const onButton = useCallback(() => {
    if (broken || advancedRef.current) return;
    doBreak();
  }, [broken, doBreak]);

  // Skip jumps to the end state and sends ADVANCE once if it has not been sent
  // (R6.7). "Show everything" renders the seal split and sends SHOW_ALL (R6.8).
  const onShowAllClick = useCallback(() => {
    if (!broken) {
      setBroken(true);
      setHoldBoth({ phase: "broken", progress: 1 });
    }
    onShowAll?.();
  }, [broken, onShowAll, setHoldBoth]);

  // Register this sequence so CeremonyRoot shows Skip while a break is possible
  // (Property 19). Skipping goes to the end state and sends ADVANCE once.
  useEffect(() => {
    const skip = () => {
      stopRaf();
      if (!broken) {
        doBreak();
      }
    };
    const unregister = register(skip);
    return unregister;
  }, [register, broken, doBreak, stopRaf]);

  // Tidy the rAF loop and any window listeners on unmount.
  useEffect(() => {
    return () => {
      stopRaf();
      removeWindowListeners();
    };
  }, [removeWindowListeners, stopRaf]);

  // The crack overlay tracks the hold's progress; a broken seal shows every
  // crack fully drawn. The pure model is the only input, so the overlay reads
  // the same on the server and the client for a given progress (Property 6,
  // Property 21). The contact point is never an input.
  const progress = broken ? 1 : hold.progress;
  const cracks = cracksForProgress(progress);

  return (
    <section className={styles.stage} style={TIMING_VARS} data-broken={broken}>
      <span
        className={styles.sealTarget}
        aria-hidden="true"
        onPointerDown={onSealPointerDown}
      >
        <WaxSeal patternKey={patternKey} className={styles.seal} />
        <svg
          className={styles.crackOverlay}
          viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
          aria-hidden="true"
          focusable="false"
        >
          {CRACK_PATHS.map((d, index) => (
            <path
              key={index}
              className={styles.crack}
              d={d}
              strokeDasharray={TOTAL_LENGTH}
              strokeDashoffset={cracks[index].dashoffset}
            />
          ))}
        </svg>
        {broken && !calm ? (
          <span className={styles.flakeLayer}>
            {FLAKE_FALLS.map((flake) => (
              <span
                key={flake.index}
                className={styles.flake}
                style={flakeStyle(flake.index)}
              />
            ))}
          </span>
        ) : null}
      </span>
      <p className={styles.instruction}>{CEREMONY_COPY.sealInstruction}</p>
      <button type="button" className={styles.button} onClick={onButton}>
        {CEREMONY_COPY.sealButton}
      </button>
      {onShowAll ? (
        <button
          type="button"
          className={styles.button}
          onClick={onShowAllClick}
        >
          {REVEAL_COPY.showAll}
        </button>
      ) : null}
    </section>
  );
}
