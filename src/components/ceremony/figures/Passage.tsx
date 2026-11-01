// Feature: 05-reveal-ceremony, Task 5 (task 2 of the then-and-now work)
//
// Passage: the time-passing transition between the then and now Steps (design.md
// "The stage 3 sequence", R10.6, R11.2).
//
// It plays for PASSAGE_MS whatever the span between then and now. The duration
// never depends on the figures, so a gap of six months and a gap of six years
// look the same (R10.6). Three paper sheets turn and the light layer drifts.
//
// Motion (R11.2): the sheets turn and the light drifts in full motion only. In
// light and Calm modes the scene is drawn still. The sequence (ThenNowSequence)
// decides when Passage is shown, so Calm never mounts it at all.
//
// Accessibility: the decorative scene is aria-hidden. The one line of text is a
// polite live region outside the aria-hidden scene, because aria-hidden on the
// whole element would also hide the announcement from a screen reader.
//
// Every string comes from copy.ts and every duration from constants.ts.

import { CEREMONY_COPY } from "../copy";
import { EASE_LINEAR, EASE_STANDARD, PASSAGE_MS } from "../constants";
import type { MotionMode } from "../motion";
import { useMotion } from "../motion";
import type { CSSProperties } from "react";
import styles from "./figures.module.css";

/** The paper sheets that turn during the passage. */
export const PASSAGE_SHEET_COUNT = 3;

/** The inline animation for the scene, or none when the scene is drawn still. */
export type PassageAnimation = {
  duration: string;
  easing: string;
};

/**
 * Whether, and how, the passage animates for a motion mode. Only full motion
 * turns the sheets and drifts the light. The duration is always `PASSAGE_MS`,
 * never a value from the data.
 */
export function passageAnimationFor(mode: MotionMode): PassageAnimation | undefined {
  if (mode !== "full") return undefined;
  return { duration: `${PASSAGE_MS}ms`, easing: EASE_STANDARD };
}

/** The inline style for a sheet. Every sheet turns over the same span. */
export function sheetStyle(animation: PassageAnimation | undefined): CSSProperties {
  if (animation === undefined) return {};
  return {
    animationDuration: animation.duration,
    animationTimingFunction: animation.easing,
  };
}

/** The inline style for the light layer. It drifts linearly over the same span. */
export function lightStyle(animation: PassageAnimation | undefined): CSSProperties {
  if (animation === undefined) return {};
  return {
    animationDuration: animation.duration,
    animationTimingFunction: EASE_LINEAR,
  };
}

export function Passage() {
  const { mode } = useMotion();
  const animation = passageAnimationFor(mode);
  const sheets = Array.from({ length: PASSAGE_SHEET_COUNT }, (_, index) => index);

  return (
    <div className={styles.passage}>
      <div className={styles.passageScene} aria-hidden="true">
        <span
          className={animation === undefined ? styles.passageLight : `${styles.passageLight} ${styles.drift}`}
          style={lightStyle(animation)}
        />
        {sheets.map((index) => (
          <span
            key={index}
            className={animation === undefined ? styles.passageSheet : `${styles.passageSheet} ${styles.turn}`}
            style={sheetStyle(animation)}
          />
        ))}
      </div>
      <p className={styles.passageLive} role="status" aria-live="polite">
        {CEREMONY_COPY.passageLive}
      </p>
    </div>
  );
}
