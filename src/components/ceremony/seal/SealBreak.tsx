"use client";

// Feature: 05-reveal-ceremony
//
// SealBreak: the Seal_Break view (design.md "Seal_Break", R6). The wax seal is
// the pointer target; under it sit the instruction line and a real "Break the
// seal" button (R6.3, Property 19). On break the wax splits into FLAKE_COUNT
// flakes, the flap lifts and the letter slides out.
//
// This file is introduced here (task 5) as the one non-test importer of
// `SealBreak.module.css`, so the module's rules ship (css-imported.test.ts) and
// the stylesheet is exercised against the component that owns it. It renders
// the settled, FINAL state: the whole seal, the fully-drawn cracks and the
// flakes at rest, driven only by the pure `cracks.ts` model at progress 1. The
// pointer-hold clock, the early-release settle, the flap lift and the letter
// slide are wired in the next task on top of this surface. Keeping the final
// state as the first render follows the Ceremony's "Final state first" rule and
// keeps the static (server) markup identical to the client's first paint
// (Property 21): this module calls no Math.random and no Date.now in render.
//
// R15.1: every user-facing string comes from CEREMONY_COPY; no inline literal
// copy lives here. R10.1: nothing drawn here depends on a value or a direction;
// every seal breaks the same way and only its decorative WaxSeal pattern
// differs.

import type { CSSProperties, ReactElement } from "react";

import { CEREMONY_COPY } from "../copy";
import {
  FLAP_LIFT_MS,
  LETTER_SLIDE_MS,
  SEAL_SETTLE_MS,
  SEAL_SPLIT_MS,
} from "../constants";
import { WaxSeal } from "../envelope/WaxSeal";
import {
  CRACK_PATHS,
  FLAKE_FALLS,
  SEAL_CENTER,
  TOTAL_LENGTH,
  cracksForProgress,
} from "./cracks";
import styles from "./SealBreak.module.css";

/** The WaxSeal's fixed 100×100 user space, shared by the crack overlay. */
const VIEWBOX = SEAL_CENTER * 2;

export type SealBreakProps = {
  /** The persona key that seeds the WaxSeal's decorative pattern (R8.4). */
  patternKey: string;
};

/**
 * The timing custom properties this view passes to its stylesheet. The
 * stylesheet reads only these variables for the durations Property 14 checks,
 * so the numbers live in constants.ts, never in the CSS. Values are written as
 * `${n}ms` strings; the constant easings stay literal in the CSS.
 */
const timingVars = {
  "--seal-split-ms": `${SEAL_SPLIT_MS}ms`,
  "--seal-settle-ms": `${SEAL_SETTLE_MS}ms`,
  "--flap-lift-ms": `${FLAP_LIFT_MS}ms`,
  "--letter-slide-ms": `${LETTER_SLIDE_MS}ms`,
} as CSSProperties;

/**
 * SealBreak renders the seal, the instruction line and the "Break the seal"
 * button. The seal is `aria-hidden` and not focusable — the button is the
 * accessible control (R6.3, Property 19). The crack overlay and the flakes are
 * drawn in the seal's fixed user space, laid exactly over the disc.
 *
 * Here the view shows its settled final state: the cracks fully drawn (the pure
 * model at progress 1) and the flakes at their resting offsets. The hold clock
 * and the break sequence are added in the next task.
 */
export function SealBreak({ patternKey }: SealBreakProps): ReactElement {
  // The settled cracks: the pure model at full progress, so every path is drawn
  // and the overlay reads the same on the server and the client (Property 6,
  // Property 21). The contact point is never an input.
  const cracks = cracksForProgress(1);

  return (
    <section className={styles.stage} style={timingVars}>
      <span className={styles.sealTarget} aria-hidden="true">
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
        <span className={styles.flakeLayer}>
          {FLAKE_FALLS.map((flake) => (
            <span
              key={flake.index}
              className={styles.flake}
              style={
                {
                  "--flake-x": `${flake.x}%`,
                  "--flake-y": `${flake.y}%`,
                  "--flake-dx": `${Math.sin((flake.angleDeg / 360) * Math.PI * 2) * flake.distance}%`,
                  "--flake-dy": `${-Math.cos((flake.angleDeg / 360) * Math.PI * 2) * flake.distance}%`,
                  "--flake-rot": `${flake.rotateDeg}deg`,
                  "--flake-delay": `${Math.round(flake.delay * SEAL_SPLIT_MS)}ms`,
                } as CSSProperties
              }
            />
          ))}
        </span>
      </span>
      <p className={styles.instruction}>{CEREMONY_COPY.sealInstruction}</p>
      <button type="button" className={styles.button}>
        {CEREMONY_COPY.sealButton}
      </button>
    </section>
  );
}
