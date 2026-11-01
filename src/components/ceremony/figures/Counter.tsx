// Feature: 05-reveal-ceremony, Task 5 (task 1 of the then-and-now work)
//
// Counter: a figure's final value, shown as rolling digit strips (design.md
// "Stamps and counter", R9.3, R10.6, R11.2).
//
// The final value is also rendered as plain text, visually hidden, so screen
// readers and any reader without the strips hear the real number. The digit
// strips are drawn over it and are aria-hidden.
//
// Each digit has its own strip of ten digits. The strip ends on the target
// digit, so it rests on that digit both in the static state (Light and Calm
// modes, and reduced motion) and after the roll. Every strip moves the same
// distance in the same direction, so no digit rolls further than another.
//
// Motion (R10.6, R11.2): the roll runs in full motion only. The rest position
// is set in CSS, so the static state needs no animation.
//
// Neutrality: the roll goes upward through the digits for every value. It
// does not depend on whether the figure rose or fell.

import { COUNTER_ROLL_MS, EASE_STAMP } from "../constants";
import type { MotionMode } from "../motion";
import { useMotion } from "../motion";
import type { CSSProperties } from "react";
import styles from "./figures.module.css";

/** Digits on each strip. */
export const COUNTER_STRIP_LENGTH = 10;

/** Steps the strip moves to reach its last digit. Shared by every strip. */
export const COUNTER_ROLL_STEPS = COUNTER_STRIP_LENGTH - 1;

/**
 * The ten digits of one strip, in order. The last item is `target`, so the
 * strip rests on `target`. The strip starts one digit above it and wraps
 * through 0 and 9.
 */
export function stripDigits(target: number): number[] {
  if (!Number.isInteger(target) || target < 0 || target > 9) {
    throw new RangeError(`stripDigits expects a digit from 0 to 9, got ${target}`);
  }
  return Array.from({ length: COUNTER_STRIP_LENGTH }, (_, i) => (target + 1 + i) % 10);
}

/** Whether the digits roll on mount for this motion mode. Only full motion rolls. */
export function rollsOnMount(mode: MotionMode): boolean {
  return mode === "full";
}

const DIGIT = /^[0-9]$/;

export type CounterProps = {
  /** The final value as text, for example "3.412". Only digits roll. */
  value: string;
};

export function Counter({ value }: CounterProps) {
  const { mode } = useMotion();
  const roll = rollsOnMount(mode);

  const stripClass = roll ? `${styles.counterStrip} ${styles.roll}` : styles.counterStrip;
  const stripStyle: Record<string, string> = {
    "--counter-steps": String(COUNTER_ROLL_STEPS),
  };
  if (roll) {
    stripStyle.animationDuration = `${COUNTER_ROLL_MS}ms`;
    stripStyle.animationTimingFunction = EASE_STAMP;
  }

  return (
    <span className={styles.counter}>
      <span className={styles.srOnly}>{value}</span>
      <span className={styles.counterFace} aria-hidden="true">
        {Array.from(value).map((char, index) => {
          if (!DIGIT.test(char)) {
            return (
              <span key={index} className={styles.counterChar}>
                {char}
              </span>
            );
          }
          return (
            <span key={index} className={styles.counterCell} data-counter="digit">
              <span className={stripClass} style={stripStyle as CSSProperties}>
                {stripDigits(Number(char)).map((digit, step) => (
                  <span key={step} className={styles.counterDigit}>
                    {digit}
                  </span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
