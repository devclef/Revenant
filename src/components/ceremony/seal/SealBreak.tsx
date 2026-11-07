"use client";

// Feature: 05-reveal-ceremony, 07-judge-journey
//
// SealBreak: the Seal_Break view (design.md "Seal_Break", R6, Property 5,
// Property 14, Property 19, Property 20, Property 21). The wax seal is the
// pointer target, through HeldSeal. Under it sit the instruction line and a real
// "Break the seal" button (R6.3, Property 19).
//
// The hold logic lives in `useSealBreak` (task 5). `OpeningFlow` calls that hook
// once and passes the controller here. This view reads the controller's
// `broken` and `progress`, calls its `press`, `breakNow`, `showAll` and `skip`,
// and hands its context values (live region, Calm_Mode, sound, the sealing flag)
// to the controller through `connect`.
//
// Final state first (R17.3, Property 21): the server render and the FIRST
// client render show the INTACT seal, with no cracks, split or flakes. The
// static markup is deterministic: no Math.random and no Date.now in render.
//
// Calm_Mode (Property 20): `planSealBreak({ calm: true })` returns an empty
// plan. In Calm_Mode a break shows the split seal at once and sends ADVANCE with
// no animation.
//
// R15.1: every user-facing string comes from CEREMONY_COPY. R10.1: nothing drawn
// here depends on a value or a direction. Sound and vibration (R14.2) play only
// while the sound toggle is on (SoundEnabledContext).

import {
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";

import { CEREMONY_COPY } from "../copy";
import {
  EASE_STANDARD,
  EASE_STAMP,
  FLAP_AT_MS,
  FLAP_LIFT_MS,
  HOLD_PROGRESS_SEGMENTS,
  LETTER_SLIDE_AT_MS,
  LETTER_SLIDE_MS,
  SEAL_SETTLE_MS,
  SEAL_SHORT_MS,
  SEAL_SPLIT_MS,
} from "../constants";
import { useLiveRegion } from "../LiveRegion";
import { useMotion } from "../motion";
import { useSequence } from "../skip";
import { SoundEnabledContext } from "../sound/SoundEnabledContext";
import { WaxSeal } from "@/components/ui/WaxSeal";
import {
  CRACK_PATHS,
  FLAKE_FALLS,
  SEAL_CENTER,
  TOTAL_LENGTH,
  cracksForProgress,
} from "./cracks";
import { HeldSeal } from "./HeldSeal";
import { activateSkipLink, skipLinkVisible } from "./skip-link";
import { holdSegmentsLit } from "./hold";
import type { SealController } from "./useSealBreak";
import styles from "./SealBreak.module.css";

/** The WaxSeal's fixed 100×100 user space, shared by the crack overlay. */
const VIEWBOX = SEAL_CENTER * 2;

/** The ring sits just outside the disc: radius 50 in the same user space. */
const RING_RADIUS = 50;
const RING_VIEWBOX = "-6 -6 112 112";
const TAU_RING = Math.PI * 2;
const RING_GAP_RAD = 0.08;

/**
 * One arc path per hold segment (spec 09 P8.2), fixed by index: segment k
 * covers its share of the circle, minus a small gap. Angles run clockwise from
 * the top. Pure, so the server and the client draw the same ring.
 */
function ringSegmentPath(index: number, count: number): string {
  const a0 = (index / count) * TAU_RING + RING_GAP_RAD / 2;
  const a1 = ((index + 1) / count) * TAU_RING - RING_GAP_RAD / 2;
  const point = (a: number) =>
    `${(VIEWBOX / 2 + RING_RADIUS * Math.sin(a)).toFixed(3)} ${(
      VIEWBOX / 2 -
      RING_RADIUS * Math.cos(a)
    ).toFixed(3)}`;
  return `M ${point(a0)} A ${RING_RADIUS} ${RING_RADIUS} 0 0 1 ${point(a1)}`;
}

const RING_PATHS: readonly string[] = Array.from({ length: HOLD_PROGRESS_SEGMENTS }, (_, i) =>
  ringSegmentPath(i, HOLD_PROGRESS_SEGMENTS),
);

export type SealBreakProps = {
  /** The persona key that seeds the WaxSeal's decorative pattern (R8.4). */
  patternKey: string;
  /** The seal controller from `useSealBreak`, owned by OpeningFlow. */
  seal: SealController;
  /**
   * Force Calm_Mode. Optional: when omitted the view reads `useMotion().mode`,
   * so a `calm` device mode (reduced motion or the Calm control) stills the
   * break the same way. Passing `calm` explicitly is for tests.
   */
  calm?: boolean;
  /** Show the "Show everything" control (R6.8). */
  showAll?: boolean;
  /**
   * Report the local view's `sealing` flag up to CeremonyRoot so
   * `stageFor(state, local)` resolves `seal` while a break is in progress and
   * `marks` otherwise (design.md "Stage resolution").
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
  "--flap-at-ms": `${FLAP_AT_MS}ms`,
  "--flap-lift-ms": `${FLAP_LIFT_MS}ms`,
  "--letter-slide-at-ms": `${LETTER_SLIDE_AT_MS}ms`,
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
 * button. The hold itself is the controller's job.
 *
 * The seal is `aria-hidden` and not focusable — the button is the accessible
 * control (R6.3, Property 19). The crack overlay and the flakes are drawn in
 * the seal's fixed 100×100 user space, laid exactly over the disc. The overlay
 * tracks the controller's `progress`; the flakes appear only once broken.
 */
export function SealBreak({
  patternKey,
  seal,
  calm: calmProp,
  showAll = false,
  onSealingChange,
}: SealBreakProps): ReactElement {
  const { mode } = useMotion();
  const calm = calmProp ?? mode === "calm";

  const { register } = useSequence();
  const { announce } = useLiveRegion();
  // Whether the sound toggle is on (R14.2).
  const soundOn = useContext(SoundEnabledContext);

  const { broken, progress, breakNow, skip } = seal;

  // The crack overlay root. The button's short draw animates its paths.
  const overlayRef = useRef<SVGSVGElement | null>(null);

  // Hand the context values the controller cannot read itself to it. Runs after
  // each render, so the controller always has the latest values at press time.
  useEffect(() => {
    seal.connect({ announce, calm, soundOn, onSealingChange });
  });

  // The seal is only a sequence while it breaks. `breaking` is set by the button
  // press, and the registration ends once the seal has broken. Skipping during
  // the draw goes to the end state and sends ADVANCE once (Property 19). While
  // the seal waits at its marks nothing is registered, so the Top_Bar shows no
  // Skip.
  const [breaking, setBreaking] = useState(false);
  const skipArmed = breaking && !broken;
  useEffect(
    () => (skipArmed ? register(() => skip()) : undefined),
    [skipArmed, register, skip],
  );

  const onButton = () => {
    setBreaking(true);
    breakNow(overlayRef.current);
  };

  // The crack overlay tracks the controller's progress. The pure model is the
  // only input, so the overlay reads the same on the server and the client for
  // a given progress (Property 6, Property 21).
  const cracks = cracksForProgress(progress);

  // The hold ring: each segment lights by opacity only (spec 09 P8.2).
  const ringLit = holdSegmentsLit(seal.hold);

  return (
    <section className={styles.stage} style={TIMING_VARS} data-broken={broken}>
      <HeldSeal controller={seal} className={styles.sealTarget} primary>
        <WaxSeal patternKey={patternKey} className={styles.seal} />
        <svg
          className={styles.ring}
          viewBox={RING_VIEWBOX}
          aria-hidden="true"
          focusable="false"
          data-hold-ring=""
        >
          {RING_PATHS.map((d, index) => (
            <path
              key={index}
              className={styles.ringSegment}
              d={d}
              style={{ opacity: ringLit[index] ? 1 : 0 }}
            />
          ))}
        </svg>
        <svg
          ref={overlayRef}
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
      </HeldSeal>
      <p className={styles.instruction}>{CEREMONY_COPY.sealInstruction}</p>
      <button
        type="button"
        className={styles.button}
        data-primary-control=""
        onClick={onButton}
      >
        {CEREMONY_COPY.sealButton}
      </button>
      {skipLinkVisible(showAll, broken) ? (
        <button
          type="button"
          className={styles.textLink}
          data-skip-link=""
          onClick={() => activateSkipLink(seal)}
        >
          {CEREMONY_COPY.skipToReceipts}
        </button>
      ) : null}
    </section>
  );
}
