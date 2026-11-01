// Feature: 05-reveal-ceremony, Task 4 (task 2 of the number-line work)
//
// NumberLine: the drawn range for one comparable figure pair (design.md
// "Number_Line geometry", "What the Number_Line draws", R10.6, R12.1-R12.4).
//
// The geometry comes from number-line.ts. This component only places things:
//  - the axis, ascending left to right, with no numbers of its own (R12.4);
//  - a pin from the then Stamp (above) and from the now Stamp (below);
//  - the Mark, when the judge gave an answer. With no answer there is no Mark
//    element at all (R12.1).
//
// The three positions reach the markup only through --pos-then, --pos-now and
// --pos-mark (Property 11, R10.3). The Mark's position is clamped to the
// range by number-line.ts. The markup has no edge flag, so a Mark beyond
// either end renders the same as one at the other end (R12.3, Property 12).
//
// The axis, pins and Mark stroke are aria-hidden. The Mark's hidden text
// carries the meaning for screen readers (R11.9). Nothing here is a colour
// that implies a direction (neutrality.md).

import type { CSSProperties } from "react";

import { CEREMONY_COPY } from "../copy";
import { numberLineGeometry } from "./number-line";
import styles from "./figures.module.css";

export type NumberLineProps = {
  /** The then value, as the figure's value string. Drives the range. */
  thenValue: string;
  /** The now value, as the figure's value string. Drives the range. */
  nowValue: string;
  /**
   * The Mark's value, as the judge typed it (the Recall_Record answer), or
   * `undefined` for "No answer". With `undefined` no Mark element is drawn.
   */
  markValue?: string;
  /** The figure's unit, shown in the Mark's hidden text. */
  unit: string;
};

export function NumberLine({ thenValue, nowValue, markValue, unit }: NumberLineProps) {
  const geometry = numberLineGeometry(thenValue, nowValue, markValue);

  // Only the three position variables. Set --pos-mark only when there is a Mark.
  const style: Record<string, string> = {
    "--pos-then": String(geometry.posThen),
    "--pos-now": String(geometry.posNow),
  };
  if (geometry.posMark !== undefined) {
    style["--pos-mark"] = String(geometry.posMark);
  }

  const markText =
    markValue === undefined
      ? undefined
      : CEREMONY_COPY.markAnswer.replace("{value}", markValue).replace("{unit}", unit);

  return (
    <div className={styles.numberLine} style={style as CSSProperties}>
      <span className={styles.axis} aria-hidden="true" />
      <span className={styles.pinThen} aria-hidden="true" />
      <span className={styles.pinNow} aria-hidden="true" />
      {markText === undefined ? null : (
        <span className={styles.markWrap}>
          <span className={styles.markStroke} aria-hidden="true" />
          <span className={styles.srOnly}>{markText}</span>
        </span>
      )}
    </div>
  );
}
