// The recorded scale on the marks card (spec 08 design.md, "The marks card";
// R6). It shows the judge's recorded answer as a record: a rail, the fixed tick
// labels for the sealed unit, and one Mark. Nothing listens for input.
//
// The component has no state and no handlers. It has no slider role, no
// tabindex and no pointer or key handler, so Tab skips it, clicks do nothing and
// the cursor stays the default (R6.1, R6.2, R6.4). A rescale note (C8) for a
// per-1,000-litres unit sits under the scale, linked by aria-describedby.

import type { CSSProperties } from "react";

import { CEREMONY_COPY } from "../copy";
import { TICK_CHAR_PX, TRACK_MIN_PX } from "../constants";
import styles from "./RecallScale.module.css";
import { answerText } from "./answer-text";
import { positionOfIn } from "./scale-math";
import { visibleTicks } from "./tick-layout";
import {
  displayUnitFor,
  rescaleNoteFor,
  scaleRangeFor,
} from "./unit-ranges";

/** The props `RecordedScale` reads. Nothing else reaches the component. */
export type RecordedScaleProps = {
  /** The question's id. Used to give the rescale note its element id. */
  id: string;
  /** The metric's display name, shown above the scale (spec 09 A9). */
  name: string;
  /** The question text, the start of the accessible name. */
  label: string;
  /** The sealed unit string. It picks the displayed unit, the range and the note. */
  unitLabel: string;
  /**
   * The recorded answer as its canonical plain-decimal text, or null when no
   * answer was recorded. Its digits are shown as recorded.
   */
  value: string | null;
};

/** Insert thousands separators into the integer part of a tick label. */
function groupThousands(plain: string): string {
  return plain.replace(/^\d+/, (digits) =>
    digits.replace(/\B(?=(\d{3})+(?!\d))/g, ","),
  );
}

/** Format a tick value for display, for example 3000 as "3,000". */
function tickText(tick: number): string {
  return groupThousands(String(tick));
}

export function RecordedScale({ id, name, label, unitLabel: sealedUnit, value }: RecordedScaleProps) {
  // The judge's answer is shown in the displayed unit (C8): the range, the unit
  // and the note all come from the sealed unit string. The value is shown as
  // recorded, with no conversion.
  const unitLabel = displayUnitFor(sealedUnit);
  const range = scaleRangeFor(unitLabel);
  const note = rescaleNoteFor(sealedUnit);
  const noteId = `recall-${id}-unit-help`;

  const recorded = value === null ? null : Number(value);
  const hasMark = recorded !== null && Number.isFinite(recorded);
  // A value past either end of the range sits on the nearer edge (R7.6).
  // positionOfIn clamps, so the Mark keeps the same shape at both edges.
  const markPosition = hasMark ? positionOfIn(recorded, range) : 0;

  const shownAnswer = value === null ? "" : answerText(value);
  const markText = hasMark ? `${shownAnswer} ${unitLabel}` : CEREMONY_COPY.lineNoAnswer;
  const ticks = visibleTicks(range, TRACK_MIN_PX, (tick) => tickText(tick).length * TICK_CHAR_PX);

  return (
    <div className={styles.recorded} data-recorded-scale="">
      <p className={styles.recordedName}>
        {name}
      </p>
      <div
        role="img"
        aria-label={`${label}: ${markText}`}
        aria-describedby={note === null ? undefined : noteId}
        className={styles.recordedTrack}
        style={{ "--pos-mark": String(markPosition) } as CSSProperties}
      >
        <div className={styles.rail} aria-hidden="true" />

        {hasMark ? (
          <>
            <span className={styles.recordedMark} aria-hidden="true" />
            <span className={`${styles.recordedReadout} ${readoutEdgeClass(markPosition)}`} aria-hidden="true">
              {shownAnswer}
              <span className={styles.unit}>{unitLabel}</span>
            </span>
          </>
        ) : (
          <span className={styles.recordedNone} aria-hidden="true">
            {CEREMONY_COPY.lineNoAnswer}
          </span>
        )}

        <div className={styles.recordedTicks} aria-hidden="true" data-tick-labels="">
          {ticks.map((tick) => (
            <span
              key={tick.value}
              data-tick-label=""
              className={`${styles.recordedTick} ${tickAnchorClass(tick.anchor)}`}
              style={{ "--pos-tick": String(tick.position) } as CSSProperties}
            >
              {tickText(tick.value)}
            </span>
          ))}
        </div>
      </div>

      {note === null ? null : (
        <p id={noteId} className={`${styles.unitHelp} ${styles.recordedHelp}`}>
          {note}
        </p>
      )}
    </div>
  );
}

/**
 * The readout is centred on the Mark, so near either end of the track it would
 * hang past the paper onto the desk, where the ink is unreadable. Such a readout
 * anchors to the track edge it is next to instead.
 */
export function readoutEdgeClass(position: number): string {
  if (position < 0.12) return styles.recordedReadoutStart;
  if (position > 0.88) return styles.recordedReadoutEnd;
  return "";
}

function tickAnchorClass(anchor: "start" | "centre" | "end"): string {
  if (anchor === "start") return styles.tickStart;
  if (anchor === "end") return styles.tickEnd;
  return styles.tickCentre;
}
