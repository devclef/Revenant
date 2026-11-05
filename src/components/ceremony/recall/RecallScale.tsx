"use client";

// Feature: 05-reveal-ceremony, Task 8 (Recall_Scale, RecallScale.tsx).
//
// One logarithmic track per recall question (design.md, "Recall_Scale"). The
// judge drags a marker to the value they remember. The readout above the
// marker shows the string that release (or a key step) sends as EDIT_DRAFT.
//
// The component reads nothing but its own props: the question text (the slider's
// accessible name), the unit label and the current answer. It never reads the
// payload, the figures or the sealed definitions. Zoom depends only on the
// marker's value and the pointer (Property 10).

import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { CEREMONY_COPY } from "../copy";
import styles from "./RecallScale.module.css";
import {
  clampValue,
  edgeValue,
  positionInWindow,
  positionOf,
  snapToStep,
  stepDecade,
  stepFine,
  toPlainDecimal,
  valueAt,
  valueInWindow,
  zoomWindow,
  ZOOM_DWELL_MS,
  type ZoomLevel,
  type ZoomWindow,
} from "./scale-math";

/** How far (px) the pointer may wander and still count as holding still. */
export const ZOOM_DWELL_SLOP_PX = 6;

/** The eight faint decade marks, drawn at level 0 only (design.md). */
const DECADE_VALUES = [0.01, 0.1, 1, 10, 100, 1000, 10000, 100000] as const;

/** The track value the marker starts from when the answer is empty. */
const EMPTY_BASE_POSITION = 0.5;

/** The props `RecallScale` reads. Nothing else reaches the component. */
export type RecallScaleProps = {
  /** The question's id, sent with each EDIT_DRAFT. */
  id: string;
  /** The question text, used as the slider's accessible name. */
  label: string;
  /** The unit label shown beside the readout, for example "USD per gallon". */
  unitLabel: string;
  /** The current answer as a number, or null while the answer is empty. */
  value: number | null;
  /** True when the judge chose "No answer": the Mark is hidden and the slider is disabled. */
  noAnswer: boolean;
  /** Called with the question id and the plain-decimal text to send as EDIT_DRAFT. */
  onEdit: (id: string, text: string) => void;
  /**
   * Text placed before the value in the spoken value, for example "Your answer".
   * Used only when the Mark is shown, in edit and read-only mode alike. It is
   * not drawn on screen.
   */
  spokenPrefix?: string;
};

/**
 * The value a key step moves to from `value`, or null for a key this scale
 * does not use. Left and Down move one unit in the third significant figure
 * down; Right and Up move up; Page Down and Page Up move one decade; Home and
 * End go to the track's ends. Every result is on the track.
 */
export function nextValueForKey(key: string, value: number): number | null {
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      return stepFine(value, -1);
    case "ArrowRight":
    case "ArrowUp":
      return stepFine(value, 1);
    case "PageDown":
      return stepDecade(value, -1);
    case "PageUp":
      return stepDecade(value, 1);
    case "Home":
      return edgeValue("start");
    case "End":
      return edgeValue("end");
    default:
      return null;
  }
}

/**
 * The track value at horizontal position `x` (0 to 1) within `win`. The log
 * track rounds to three significant figures; a zoomed window snaps to its step.
 */
export function valueOnTrack(x: number, win: ZoomWindow): number {
  if (win.scale === "log") return valueAt(x);
  return snapToStep(valueInWindow(x, win), win);
}

/** The readout text for a value. It is the string EDIT_DRAFT sends, or the nearest end. */
export function readoutText(value: number): string {
  if (value === 0) return "0";
  return toPlainDecimal(clampValue(value));
}

/** The handlers `trackDrag` calls while a drag is under way. */
export type DragHandlers = {
  onMove: (clientX: number, clientY: number) => void;
  onEnd: () => void;
};

type CaptureTarget = { setPointerCapture: (pointerId: number) => void };
type ListenerTarget = {
  addEventListener: (type: string, listener: (event: Event) => void) => void;
  removeEventListener: (type: string, listener: (event: Event) => void) => void;
};

/**
 * Keep a drag going. The pointer is captured on the track, inside a `try`. If
 * the browser refuses the capture (it throws), the drag carries on with
 * listeners on the window instead. Returns a function that removes any
 * window listeners it added; it is a no-op when the capture worked.
 */
export function trackDrag(
  target: CaptureTarget,
  pointerId: number,
  win: ListenerTarget,
  handlers: DragHandlers,
): () => void {
  try {
    target.setPointerCapture(pointerId);
    return () => undefined;
  } catch {
    const move = (event: Event) => {
      const pointer = event as MouseEvent;
      handlers.onMove(pointer.clientX, pointer.clientY);
    };
    const end = () => handlers.onEnd();
    win.addEventListener("pointermove", move);
    win.addEventListener("pointerup", end);
    win.addEventListener("pointercancel", end);
    return () => {
      win.removeEventListener("pointermove", move);
      win.removeEventListener("pointerup", end);
      win.removeEventListener("pointercancel", end);
    };
  }
}

/** Insert thousands separators into the integer part of a plain decimal. */
function groupThousands(plain: string): string {
  return plain.replace(/^\d+/, (digits) =>
    digits.replace(/\B(?=(\d{3})+(?!\d))/g, ","),
  );
}

/** A drag in progress. Kept in a ref so timers and listeners read the latest values. */
type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  level: ZoomLevel;
  win: ZoomWindow;
  value: number;
  timer: ReturnType<typeof setTimeout> | null;
  detach: () => void;
};

export function RecallScale({
  id,
  label,
  unitLabel,
  value,
  noAnswer,
  onEdit,
  spokenPrefix,
}: RecallScaleProps) {
  const [level, setLevel] = useState<ZoomLevel>(0);
  // The value the zoomed window is built around. Set on each zoom-in and key step.
  const [anchor, setAnchor] = useState<number>(() => valueAt(EMPTY_BASE_POSITION));
  const [dragValue, setDragValue] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);

  const shownValue = dragValue ?? value;
  const base = shownValue ?? valueAt(EMPTY_BASE_POSITION);
  const win: ZoomWindow =
    drag.current !== null
      ? drag.current.win
      : zoomWindow(level, level === 0 ? base : anchor);

  const hasMark = !noAnswer && shownValue !== null;
  const markPosition = positionInWindow(base, win);
  const readout = !noAnswer && shownValue !== null ? readoutText(shownValue) : "";
  const markText = hasMark ? `${readout} ${unitLabel}` : CEREMONY_COPY.recallNoMarkYet;
  // The Mark is announced as the judge's answer, not as a position: with a
  // prefix ("Your answer") the spoken value is the answer and its unit. The
  // prefix applies in edit and read-only mode alike (R11, Mark wording).
  const spokenValue =
    hasMark && spokenPrefix !== undefined
      ? `${spokenPrefix}: ${markText}`
      : markText;

  const trackStyle = {
    "--pos-mark": String(markPosition),
    touchAction: "none",
  } as CSSProperties;

  function valueAtClientX(clientX: number, scaleWindow: ZoomWindow): number | null {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return null;
    return valueOnTrack((clientX - rect.left) / rect.width, scaleWindow);
  }

  function zoomIn(state: DragState) {
    state.timer = null;
    if (state.level >= 2) return;
    const next = (state.level + 1) as ZoomLevel;
    state.level = next;
    state.win = zoomWindow(next, state.value);
    setLevel(next);
    setAnchor(state.value);
    armDwell(state);
  }

  function armDwell(state: DragState) {
    if (state.level >= 2) return;
    state.timer = setTimeout(() => zoomIn(state), ZOOM_DWELL_MS);
  }

  function cancelDwell(state: DragState) {
    if (state.timer !== null) clearTimeout(state.timer);
    state.timer = null;
  }

  function moveDrag(clientX: number, clientY: number) {
    const state = drag.current;
    if (!state) return;
    const moved = valueAtClientX(clientX, state.win);
    if (moved !== null) {
      state.value = moved;
      setDragValue(moved);
    }
    if (Math.hypot(clientX - state.startX, clientY - state.startY) > ZOOM_DWELL_SLOP_PX) {
      state.startX = clientX;
      state.startY = clientY;
      cancelDwell(state);
      armDwell(state);
    }
  }

  function endDrag() {
    const state = drag.current;
    if (!state) return;
    cancelDwell(state);
    state.detach();
    drag.current = null;
    setDragValue(null);
    onEdit(id, toPlainDecimal(state.value));
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (noAnswer || drag.current !== null) return;
    const start = valueAtClientX(event.clientX, win);
    if (start === null) return;
    const state: DragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      level,
      win,
      value: start,
      timer: null,
      detach: () => undefined,
    };
    drag.current = state;
    state.detach = trackDrag(event.currentTarget, event.pointerId, window, {
      onMove: moveDrag,
      onEnd: endDrag,
    });
    setDragValue(start);
    armDwell(state);
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (noAnswer) return;
    const next = nextValueForKey(event.key, base);
    if (next === null) return;
    event.preventDefault();
    setAnchor(next);
    onEdit(id, toPlainDecimal(next));
  }

  function showWholeScale() {
    setLevel(0);
  }

  // The plain control for the hold-still zoom (R11, every gesture has a
  // control). It zooms one level around the current value, the same step the
  // dwell takes, so a keyboard or pointer user who does not hold still still
  // reaches each zoom level. Shown only while the judge can edit the Mark.
  function lookCloser() {
    if (level >= 2) return;
    setLevel((level + 1) as ZoomLevel);
    setAnchor(base);
  }
  const canLookCloser = hasMark && level < 2;

  const ariaValueNow = Math.round(positionOf(base) * 1000);

  return (
    <div className={styles.scale}>
      <div
        ref={trackRef}
        className={styles.track}
        style={trackStyle}
        onPointerDown={onPointerDown}
        onPointerMove={(event) => moveDrag(event.clientX, event.clientY)}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className={styles.readout}>
          {hasMark ? (
            <>
              <span data-readout="readout">{readout}</span>
              <span className={styles.unit}>{unitLabel}</span>
            </>
          ) : (
            <span className={styles.unit}>{CEREMONY_COPY.recallNoMarkYet}</span>
          )}
        </span>
        <div className={styles.rail} aria-hidden="true" />
        <div
          role="slider"
          tabIndex={noAnswer ? -1 : 0}
          aria-label={label}
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={1000}
          aria-valuenow={ariaValueNow}
          aria-valuetext={spokenValue}
          aria-disabled={noAnswer ? "true" : undefined}
          className={hasMark ? styles.mark : `${styles.mark} ${styles.markFaded}`}
          onKeyDown={onKeyDown}
        />
      </div>

      {level === 0 ? (
        <div className={styles.labels} aria-hidden="true">
          {DECADE_VALUES.map((decade) => (
            <span
              key={decade}
              className={styles.label}
              style={{ "--pos-label": String(positionOf(decade)) } as CSSProperties}
            >
              {groupThousands(toPlainDecimal(decade))}
            </span>
          ))}
        </div>
      ) : (
        <div className={styles.labels} aria-hidden="true">
          <span className={styles.endStart}>{toPlainDecimal(win.min)}</span>
          <span className={styles.endEnd}>{toPlainDecimal(win.max)}</span>
        </div>
      )}

      {canLookCloser ? (
        <div className={styles.zoomRow}>
          <button type="button" className={styles.wholeScale} onClick={lookCloser}>
            {CEREMONY_COPY.recallLookCloser}
          </button>
        </div>
      ) : null}

      {level > 0 ? (
        <div className={styles.zoomRow}>
          <p className={styles.zoomHint}>{CEREMONY_COPY.recallZoomHint}</p>
          <button type="button" className={styles.wholeScale} onClick={showWholeScale}>
            {CEREMONY_COPY.recallWholeScale}
          </button>
        </div>
      ) : null}
    </div>
  );
}
