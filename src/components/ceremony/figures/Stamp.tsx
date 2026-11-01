// Feature: 05-reveal-ceremony, Task 4 (task 2 of the number-line work)
//
// Stamp: one figure framed as a pressed stamp (design.md "Stamps and counter",
// R9.1, R9.2, R9.8, R12.6). It frames the existing FigureLine unchanged, so the
// label, value, unit, period, region and the collapsed source details come
// from #49's own component. The stamp adds two things as text: the face value
// (the same formatValue FigureLine uses, followed by the unit) and the source
// name.
//
// Motion (R10.6, R11.2): the stamp drops vertically on mount in full motion
// only. Light and Calm modes draw it in its final place. The reduced-motion
// media query in figures.module.css is a second guard for the same rule.
//
// Neutrality: the then and now stamps share one class and one drop. Nothing
// here depends on the direction of the change.

import type { FigureV1 } from "@/lib/seal-format";
import type { DisplayRescale } from "@/lib/figures";
import { formatValue, rescaleForDisplay } from "@/lib/figures";
import { FigureLine } from "@/components/reveal/FigureLine";
import { EASE_STAMP, STAMP_DROP_MS } from "../constants";
import type { MotionMode } from "../motion";
import { useMotion } from "../motion";
import { Counter } from "./Counter";
import styles from "./figures.module.css";

export type StampProps = {
  /** The sealed figure, shown with its full provenance. */
  figure: Readonly<FigureV1>;
  /** Whether this is the "then" stamp or the "now" stamp. */
  role: "then" | "now";
  /** The series' display rescale, when one applies (display-only). */
  displayRescale?: Readonly<DisplayRescale>;
};

/**
 * Whether a stamp drops on mount for this motion mode. Only full motion drops
 * (R10.6, R11.2). Light and Calm draw the stamp in place.
 */
export function dropsOnMount(mode: MotionMode): boolean {
  return mode === "full";
}

export function Stamp({ figure, role, displayRescale }: StampProps) {
  const { mode } = useMotion();
  const drop = dropsOnMount(mode);

  // Face: the figure's value as FigureLine shows it, rescaled only when the
  // series says so. The stored value is never changed.
  const faceValue =
    displayRescale === undefined
      ? formatValue(figure.value, figure.region)
      : formatValue(
          rescaleForDisplay(figure.value, displayRescale.divisor),
          figure.region,
        );
  const faceUnit =
    displayRescale === undefined ? figure.unit : displayRescale.unit;

  const className = drop ? `${styles.stamp} ${styles.drop}` : styles.stamp;
  const dropStyle = drop
    ? { animationDuration: `${STAMP_DROP_MS}ms`, animationTimingFunction: EASE_STAMP }
    : undefined;

  return (
    <div className={className} style={dropStyle} data-role={role}>
      {/* The value rolls through Counter's digit strips. The unit stays outside
          Counter: its letters are split into flex cells, which would lose the
          spaces between words. The accessible value is FigureLine's text below. */}
      <span className={styles.face} aria-hidden="true">
        <Counter value={faceValue} /> {faceUnit}
      </span>
      <span className={styles.sourceName}>{figure.source}</span>
      <FigureLine figure={figure} role={role} displayRescale={displayRescale} />
    </div>
  );
}
