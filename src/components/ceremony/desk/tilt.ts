// Feature: 05-reveal-ceremony
//
// Device-orientation tilt for the desk (design.md "Desk", R8.6, R13.3). When
// the phone is tilted, the candle light and the parallax follow it. The result
// goes to the same `--light-*` and `--parallax-*` variables as the pointer, so
// the CSS needs no second path.
//
// iOS asks for permission before it sends orientation events
// (`DeviceOrientationEvent.requestPermission`). That needs a user gesture, so
// the desk shows a "Let the light follow your phone" control only when
// `needsTiltPermission()` is true. The page works without it (R8.6).
//
// Loaded by a dynamic import() from decor-loader.ts, only in `full` motion.
// Tilt is off in `light` and `calm` (R11.3, R13.6). No Math.random or Date.now.

import { lightFromPointer, applyLight, type LightValues } from "./useLight";

/** The tilt, in degrees either side of neutral, that reaches the edge of the light range. */
export const TILT_SPAN_DEG = 30;

/** The `beta` angle when the phone lies flat and upright-ish in the hand. */
export const TILT_NEUTRAL_BETA_DEG = 45;

/** The two angles a deviceorientation event reports. Either can be null. */
export type OrientationReading = {
  readonly beta: number | null;
  readonly gamma: number | null;
};

/** The window facts this module reads, typed narrowly so tests can supply a fake. */
export type TiltWindow = {
  readonly DeviceOrientationEvent?: {
    readonly requestPermission?: () => Promise<string>;
  };
  addEventListener(
    type: "deviceorientation",
    listener: (event: OrientationReading) => void,
  ): void;
  removeEventListener(
    type: "deviceorientation",
    listener: (event: OrientationReading) => void,
  ): void;
};

function finiteOr(n: number | null | undefined, fallback: number): number {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function clampSpan(n: number): number {
  return n < -TILT_SPAN_DEG ? -TILT_SPAN_DEG : n > TILT_SPAN_DEG ? TILT_SPAN_DEG : n;
}

/**
 * The light values for one orientation reading. Pure: no DOM and no time.
 *
 * A reading maps onto a unit box, so the same clamping as the pointer applies.
 * `gamma` (left to right) moves the light across, and `beta` (front to back,
 * measured from the neutral angle) moves it down. A missing or non-finite angle
 * counts as neutral. Values beyond TILT_SPAN_DEG sit at the edge.
 */
export function lightFromOrientation(reading: OrientationReading): LightValues {
  const gamma = clampSpan(finiteOr(reading.gamma, 0));
  const beta = clampSpan(
    finiteOr(reading.beta, TILT_NEUTRAL_BETA_DEG) - TILT_NEUTRAL_BETA_DEG,
  );
  const unitBox = { left: 0, top: 0, width: 1, height: 1 };
  return lightFromPointer(
    unitBox,
    0.5 + gamma / (2 * TILT_SPAN_DEG),
    0.5 + beta / (2 * TILT_SPAN_DEG),
  );
}

/** Whether the browser needs a permission request before it sends tilt events (iOS). */
export function needsTiltPermission(win: TiltWindow): boolean {
  return typeof win.DeviceOrientationEvent?.requestPermission === "function";
}

/**
 * Ask for tilt permission from a user gesture. Resolves `true` only when the
 * browser grants it. A thrown error or a denial resolves `false`, and the
 * control hides while the pointer light stays (design.md, error handling).
 */
export async function requestTiltPermission(win: TiltWindow): Promise<boolean> {
  const ctor = win.DeviceOrientationEvent;
  const request = ctor?.requestPermission;
  if (ctor === undefined || typeof request !== "function") {
    return true;
  }
  try {
    const result = await request.call(ctor);
    return result === "granted";
  } catch {
    return false;
  }
}

/**
 * Start following the phone's tilt on `target`. Returns the function that stops
 * it. Each reading writes the same light variables as the pointer does.
 */
export function startTilt(target: HTMLElement, win: TiltWindow): () => void {
  const onOrientation = (reading: OrientationReading): void => {
    applyLight(target, lightFromOrientation(reading));
  };
  win.addEventListener("deviceorientation", onOrientation);
  return () => {
    win.removeEventListener("deviceorientation", onOrientation);
  };
}

/** The real window, narrowed to the facts this module reads. Called from an effect only. */
export function browserTiltWindow(): TiltWindow {
  return window as unknown as TiltWindow;
}
