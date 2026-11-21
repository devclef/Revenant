/**
 * Pure helpers for the Press_Test (spec 16, Requirements 1.11 and 1.12). No
 * browser, no network. `press-test.test.ts` drives Chromium and passes the
 * measured scroll positions and timings here, and these functions decide.
 */
import { CEREMONY_COPY } from "../../components/ceremony/copy";

/** The two viewports the Press_Test runs at (Requirement 1.11). */
export const PRESS_SIZES = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
] as const;

export type PressSize = (typeof PRESS_SIZES)[number];

/** Hold time for a press: the pointer is down this long before it is released. */
export const PRESS_HOLD_MS = 600;

/** How long after pointer up "Press the seal" may take to become the current step. */
export const STEP_CHANGE_BUDGET_MS = 2_000;

/** Phrase the step track shows for the Press the seal step. */
export const PRESS_STEP_PATTERN = /press the seal/i;

/**
 * The presses the Press_Test makes at each size (Requirement 1.12). The id
 * names the target in the findings, and the label is shown to the reader of
 * the run record.
 */
export const PRESS_TARGETS = [
  { id: "occasion-pill", label: "an Occasion pill" },
  { id: "suggestion-pill", label: "a Suggestion_Pill" },
  { id: "write-my-own", label: "Write my own" },
  { id: "receipt-toggle", label: "a receipt toggle" },
  { id: "remove", label: "Remove" },
  { id: "fold", label: "the Fold_Button" },
] as const;

export type PressTargetId = (typeof PRESS_TARGETS)[number]["id"];

/**
 * True when the scroll position did not move between two reads. A press that
 * scrolls the page (for example by focusing a control that is off screen) makes
 * the difference non-zero.
 */
export function scrollHeld(before: number, after: number): boolean {
  return after - before === 0;
}

/** A Press_Test check result. `ok` is the verdict; `message` is the printed line. */
export type PressCheck = { ok: boolean; message: string };

/** Judge one press: the scroll position at pointer down against the one at pointer up. */
export function checkPressScroll(input: {
  target: string;
  before: number;
  after: number;
}): PressCheck {
  const label = `scrollY unchanged across a press of ${input.target}`;
  if (scrollHeld(input.before, input.after)) {
    return { ok: true, message: `PASS ${label} (${input.before})` };
  }
  return {
    ok: false,
    message: `FAIL ${label}: scrollY ${input.before} at pointer down, ${input.after} at pointer up`,
  };
}

/**
 * Judge the step change: "Press the seal" must be the current step within
 * STEP_CHANGE_BUDGET_MS of pointer up. `currentStep` is the text of the current
 * Step_Indicator item, or null when no item is current. `elapsedMs` is the time
 * from pointer up until the step was first seen as current, or null when it
 * never was within the wait.
 */
export function checkPressStepChange(input: {
  currentStep: string | null;
  elapsedMs: number | null;
}): PressCheck {
  const label = `"Press the seal" is the current step within ${STEP_CHANGE_BUDGET_MS} ms of pointer up`;
  const isPressSeal =
    input.currentStep !== null && PRESS_STEP_PATTERN.test(input.currentStep);
  if (
    isPressSeal &&
    input.elapsedMs !== null &&
    input.elapsedMs <= STEP_CHANGE_BUDGET_MS
  ) {
    return { ok: true, message: `PASS ${label} (${input.elapsedMs} ms)` };
  }
  const shown =
    input.currentStep === null ? "no current step" : `"${input.currentStep}"`;
  const when =
    input.elapsedMs === null
      ? "never within the wait"
      : `after ${input.elapsedMs} ms`;
  return {
    ok: false,
    message: `FAIL ${label}: the current step is ${shown}, reached ${when}`,
  };
}

/** The Calm states the Press_Test runs in (Requirement 1.11). */
export const CALM_STATES = [true, false] as const;

/**
 * The Calm control's label names the action it performs. While motion is on
 * the label is "Stop motion" (calmOn); once calm is on it reads "Turn motion
 * back on" (calmOff). Returns whether the label shows calm is currently on.
 */
export function isCalmOnFromLabel(label: string): boolean {
  return label.trim() === CEREMONY_COPY.calmOff;
}

/**
 * Whether the Calm control must be pressed to reach the wanted state. Pressing
 * it toggles the state, so it is pressed only when the current state differs.
 */
export function calmToggleNeeded(label: string, wantCalm: boolean): boolean {
  return isCalmOnFromLabel(label) !== wantCalm;
}

/** A readable name for one Press_Test run, used as the test title. */
export function pressRunLabel(
  size: PressSize,
  calm: boolean,
  extra?: string,
): string {
  const motion = calm ? "calm on" : "calm off";
  return `${size.width}x${size.height}, ${motion}${extra ? `, ${extra}` : ""}`;
}
