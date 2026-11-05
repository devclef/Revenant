"use client";

// Feature: 05-reveal-ceremony, Task 8 (Recall_Scale, RecallScale.tsx).
//
// One track per recall question (design.md, "Recall_Scale"). The judge drags a
// marker to the value they remember. The readout above the marker shows the
// string that release (or a key step) sends as EDIT_DRAFT.
//
// The track range comes from the sealed unit (spec 08 R7, `unit-ranges.ts`), the
// same range the marks card uses. A linear range is drawn with its own ticks. Its
// zoom windows are cut to the range. The fallback range is the 10^-2 to 10^5 log
// track, with decade labels and the zoom (Property 10).
//
// The component reads nothing but its own props: the question text (the slider's
// accessible name), the unit label, the range and the current answer. It never
// reads the payload, the figures or the sealed definitions.

import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { CEREMONY_COPY } from "../copy";
import { TICK_CHAR_PX, TRACK_MIN_PX } from "../constants";
import styles from "./RecallScale.module.css";
import {
  clampValue,
  edgeValue,
  fineStepSize,
  positionInWindow,
  positionOfIn,
  snapToStep,
  stepDecade,
  stepFine,
  toPlainDecimalIn,
  valueAtIn,
  valueInWindow,
  zoomWindow,
  ZOOM_DWELL_MS,
  type ZoomLevel,
  type ZoomWindow,
} from "./scale-math";
import { visibleTicks, type VisibleTick } from "./tick-layout";
import { FALLBACK_RANGE, type ScaleRange } from "./unit-ranges";

/** How far (px) the pointer may wander and still count as holding still. */
export const ZOOM_DWELL_SLOP_PX = 6;

/** The eight faint decade marks, drawn at level 0 of the log track only (design.md). */
const DECADE_VALUES = [0.01, 0.1, 1, 10, 100, 1000, 10000, 100000] as const;

/** The track position the marker starts from when the answer is empty. */
const EMPTY_BASE_POSITION = 0.5;

/** The props `RecallScale` reads. Nothing else reaches the component. */
export type RecallScaleProps = {
  /** The question's id, sent with each EDIT_DRAFT. */
  id: string;
  /** The question text, used as the slider's accessible name. */
  label: string;
  /** The unit label shown beside the readout, for example "USD per gallon". */
  unitLabel: string;
  /**
   * The track range for the sealed unit (`scaleRangeFor(unit)`). The track, the
   * tick labels and the Mark all use this one range.
   */
  range: ScaleRange;
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

/** Round to three significant figures and return a number. */
function sig3(value: number): number {
  return Number(value.toPrecision(3));
}

/**
 * One step on a linear range: the third significant figure of the value, up or
 * down, kept inside the range. From 1,710 the step is 10; from 3.47 it is 0.01.
 */
function stepLinear(value: number, direction: 1 | -1, range: ScaleRange): number {
  const base = Math.min(Math.max(value, range.min), range.max);
  const next = sig3(base + direction * fineStepSize(base));
  return Math.min(Math.max(next, range.min), range.max);
}

/**
 * The value a key step moves to from `value` on the log track, or null for a key
 * this scale does not use. Left and Down move one unit in the third significant
 * figure down; Right and Up move up; Page Down and Page Up move one decade; Home
 * and End go to the track's ends. Every result is on the track.
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
 * The value a key step moves to on `range`, or null for a key this scale does
 * not use. A linear range steps by the third significant figure, and Page Up and
 * Page Down move by one tick interval. Home and End go to the range's ends. The
 * log range uses `nextValueForKey`. Every result is inside the range.
 */
export function nextValueForKeyIn(
  key: string,
  value: number,
  range: ScaleRange,
): number | null {
  if (range.scale === "log") return nextValueForKey(key, value);
  const within = (v: number) => Math.min(Math.max(v, range.min), range.max);
  const pageStep =
    range.ticks.length > 1 ? range.ticks[1] - range.ticks[0] : range.max - range.min;
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      return stepLinear(value, -1, range);
    case "ArrowRight":
    case "ArrowUp":
      return stepLinear(value, 1, range);
    case "PageDown":
      return within(sig3(value - pageStep));
    case "PageUp":
      return within(sig3(value + pageStep));
    case "Home":
      return range.min;
    case "End":
      return range.max;
    default:
      return null;
  }
}

/**
 * The zoom window at `level` around `value` on `range`. A linear range's windows
 * are cut to the range, so a zoomed track never shows a value outside it.
 */
export function windowFor(level: ZoomLevel, value: number, range: ScaleRange): ZoomWindow {
  const zoom = zoomWindow(level, value);
  if (range.scale === "log" || level === 0) return zoom;
  return {
    ...zoom,
    min: Math.max(zoom.min, range.min),
    max: Math.min(zoom.max, range.max),
  };
}

/**
 * The track value at horizontal position `x` (0 to 1) within a zoom window. The
 * log track rounds to three significant figures; a zoomed window snaps to its step.
 */
export function valueOnTrack(x: number, win: ZoomWindow): number {
  if (win.scale === "log") return valueAtIn(x, FALLBACK_RANGE);
  return snapToStep(valueInWindow(x, win), win);
}

/** The readout text for a value on the log track. It is the string EDIT_DRAFT sends, or the nearest end. */
export function readoutText(value: number): string {
  if (value === 0) return "0";
  return toPlainDecimalIn(clampValue(value), FALLBACK_RANGE);
}

/**
 * The readout for a value on `range`. A value inside a linear range is the plain
 * decimal the record accepts. A value outside it is shown as typed, to three
 * significant figures, and the Mark sits at the nearer edge.
 */
function readoutFor(value: number, range: ScaleRange): string {
  if (range.scale === "log") return readoutText(value);
  if (value === 0) return "0";
  if (value >= range.min && value <= range.max) return toPlainDecimalIn(value, range);
  return typedText(value);
}

/** A typed value to three significant figures as plain text, with no range check. */
function typedText(value: number): string {
  const rounded = sig3(value);
  const decimals = Math.max(0, 2 - Math.floor(Math.log10(rounded)));
  let text = rounded.toFixed(decimals);
  if (text.includes(".")) {
    text = text.replace(/0+$/, "").replace(/\.$/, "");
  }
  return text;
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

function tickAnchorClass(anchor: VisibleTick["anchor"]): string {
  if (anchor === "start") return styles.tickStart;
  if (anchor === "end") return styles.tickEnd;
  return styles.tickCentre;
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
  range,
  value,
  noAnswer,
  onEdit,
  spokenPrefix,
}: RecallScaleProps) {
  const [level, setLevel] = useState<ZoomLevel>(0);
  // The value the zoomed window is built around. Set on each zoom-in and key step.
  const [anchor, setAnchor] = useState<number>(() => valueAtIn(EMPTY_BASE_POSITION, range));
  const [dragValue, setDragValue] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);

  const shownValue = dragValue ?? value;
  const base = shownValue ?? valueAtIn(EMPTY_BASE_POSITION, range);
  const win: ZoomWindow =
    drag.current !== null
      ? drag.current.win
      : windowFor(level, level === 0 ? base : anchor, range);

  const hasMark = !noAnswer && shownValue !== null;
  const markPosition =
    level === 0 ? positionOfIn(base, range) : positionInWindow(base, win);
  const readout = !noAnswer && shownValue !== null ? readoutFor(shownValue, range) : "";
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

  /** The value at a pointer's x on `scaleWindow`: the range at level 0, a zoom window otherwise. */
  function valueFor(x: number, scaleWindow: ZoomWindow): number {
    return scaleWindow.level === 0 ? valueAtIn(x, range) : valueOnTrack(x, scaleWindow);
  }

  function valueAtClientX(clientX: number, scaleWindow: ZoomWindow): number | null {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return null;
    return valueFor((clientX - rect.left) / rect.width, scaleWindow);
  }

  function zoomIn(state: DragState) {
    state.timer = null;
    if (state.level >= 2) return;
    const next = (state.level + 1) as ZoomLevel;
    state.level = next;
    state.win = windowFor(next, state.value, range);
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
    onEdit(id, toPlainDecimalIn(state.value, range));
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
    const next = nextValueForKeyIn(event.key, base, range);
    if (next === null) return;
    event.preventDefault();
    setAnchor(next);
    onEdit(id, toPlainDecimalIn(next, range));
  }

  function showWholeScale() {
    setLevel(0);
  }

  // The plain control for the hold-still zoom (R11, every gesture has a
  // control). It zooms one level around the current value, the same step the
  // dwell takes, so a keyboard or pointer user who does not hold still still
  // reaches each zoom level. Shown while the judge can edit the Mark.
  function lookCloser() {
    if (level >= 2) return;
    setLevel((level + 1) as ZoomLevel);
    setAnchor(base);
  }
  const canLookCloser = hasMark && level < 2;

  const ariaValueNow = Math.round(positionOfIn(base, range) * 1000);

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

      {range.scale === "linear" ? (
        <div className={styles.labels} aria-hidden="true">
          {visibleTicks(range, TRACK_MIN_PX, (tick) => groupThousands(String(tick)).length * TICK_CHAR_PX).map(
            (tick) => (
              <span
                key={tick.value}
                data-tick-label=""
                className={`${styles.tick} ${tickAnchorClass(tick.anchor)}`}
                style={{ "--pos-label": String(tick.position) } as CSSProperties}
              >
                {groupThousands(String(tick.value))}
              </span>
            ),
          )}
        </div>
      ) : level === 0 ? (
        <div className={styles.labels} aria-hidden="true">
          {DECADE_VALUES.map((decade) => (
            <span
              key={decade}
              className={styles.label}
              style={{ "--pos-label": String(positionOfIn(decade, range)) } as CSSProperties}
            >
              {groupThousands(toPlainDecimalIn(decade, range))}
            </span>
          ))}
        </div>
      ) : (
        <div className={styles.labels} aria-hidden="true">
          <span className={styles.endStart}>{toPlainDecimalIn(win.min, range)}</span>
          <span className={styles.endEnd}>{toPlainDecimalIn(win.max, range)}</span>
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
