// Pure math for the Recall_Scale (design.md, "Recall_Scale"). No React imports.
//
// The track is one logarithmic scale from 10^-2 to 10^5. A track position x in
// [0, 1] maps to a value rounded to three significant figures. Zoomed windows
// are linear. Every string this module produces comes from `toPlainDecimal`,
// so it always matches the record's number pattern (R3.3).

/** Smallest value on the track. */
export const SCALE_MIN_VALUE = 0.01;
/** Largest value on the track. */
export const SCALE_MAX_VALUE = 100000;
/** Exponent of the track's lowest value (10^-2). */
export const SCALE_MIN_EXP = -2;
/** Exponent of the track's highest value (10^5). */
export const SCALE_MAX_EXP = 5;
/** Significant figures kept for every value the track produces. */
export const SCALE_SIG_FIGS = 3;
/** Holding the pointer still this long zooms in one level (design.md). */
export const ZOOM_DWELL_MS = 450;

/** Zoom levels: 0 is the whole log track, 1 and 2 are linear windows. */
export type ZoomLevel = 0 | 1 | 2;

/** The part of the scale shown at one zoom level. */
export interface ZoomWindow {
  level: ZoomLevel;
  min: number;
  max: number;
  scale: "log" | "linear";
  /** Linear step for levels 1 and 2 (10^(k-1)); null at level 0. */
  step: number | null;
}

/** Exact power of ten, avoiding the float noise of `Math.pow` for small k. */
function pow10(k: number): number {
  return Number(`1e${k}`);
}

/** Round to `sig` significant figures and return a number. */
function roundSig(value: number, sig: number): number {
  return Number(value.toPrecision(sig));
}

/** Clamp a number into the track range. NaN counts as the lowest value. */
export function clampValue(value: number): number {
  if (Number.isNaN(value)) return SCALE_MIN_VALUE;
  return Math.min(Math.max(value, SCALE_MIN_VALUE), SCALE_MAX_VALUE);
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.min(Math.max(x, 0), 1);
}

/** The decade k with 10^k <= value < 10^(k+1), for a value in track range. */
function decadeOf(value: number): number {
  let k = Math.floor(Math.log10(value));
  if (pow10(k + 1) <= value) k += 1;
  else if (pow10(k) > value) k -= 1;
  return k;
}

/**
 * The track value at position `x`, rounded to three significant figures.
 * `x` is clamped to [0, 1].
 */
export function valueAt(x: number): number {
  const exponent = SCALE_MIN_EXP + (SCALE_MAX_EXP - SCALE_MIN_EXP) * clamp01(x);
  return roundSig(Math.pow(10, exponent), SCALE_SIG_FIGS);
}

/**
 * The track position of a value, in [0, 1]. Values below 0.01 (including 0)
 * sit at 0, and values above 100,000 sit at 1.
 */
export function positionOf(value: number): number {
  const clamped = clampValue(value);
  const exponent = Math.log10(clamped);
  return clamp01((exponent - SCALE_MIN_EXP) / (SCALE_MAX_EXP - SCALE_MIN_EXP));
}

/**
 * A finite, non-negative number written as a plain decimal string. It is
 * rounded to three significant figures, has no exponent, and drops trailing
 * fractional zeros. Output always matches `^[0-9]+(\.[0-9]+)?$` and is at most
 * 40 characters.
 *
 * Accepts 0 and values in [0.01, 100,000], which is the track range. Anything
 * else throws a RangeError, so the scale never writes a value the record rejects.
 */
export function toPlainDecimal(value: number): string {
  if (value === 0) return "0";
  if (
    !Number.isFinite(value) ||
    value < SCALE_MIN_VALUE ||
    value > SCALE_MAX_VALUE
  ) {
    throw new RangeError(`toPlainDecimal: ${value} is outside the scale`);
  }

  const rounded = roundSig(value, SCALE_SIG_FIGS);
  const decimals = Math.max(0, SCALE_SIG_FIGS - 1 - decadeOf(rounded));
  let text = rounded.toFixed(decimals);
  if (text.includes(".")) {
    text = text.replace(/0+$/, "").replace(/\.$/, "");
  }
  return text;
}

/**
 * The step for the third significant figure at `value`: 10^(k-2) for a value
 * in decade k. 3.47 steps by 0.01 and 1,710 steps by 10.
 */
export function fineStepSize(value: number): number {
  return pow10(decadeOf(clampValue(value)) - (SCALE_SIG_FIGS - 1));
}

/**
 * Move `value` one unit in the third significant figure, up (`direction` 1) or
 * down (`direction` -1). The result is rounded to three significant figures and
 * clamped to the track range. Left and Down use -1; Right and Up use 1.
 */
export function stepFine(value: number, direction: 1 | -1): number {
  const v = clampValue(value);
  const next = v + direction * fineStepSize(v);
  return clampValue(roundSig(next, SCALE_SIG_FIGS));
}

/**
 * Move `value` one decade, up or down, and clamp to the track range.
 * Page Up uses 1 and Page Down uses -1.
 */
export function stepDecade(value: number, direction: 1 | -1): number {
  const v = clampValue(value);
  return clampValue(roundSig(v * pow10(direction), SCALE_SIG_FIGS));
}

/** The lowest and highest values for Home and End. */
export function edgeValue(edge: "start" | "end"): number {
  return edge === "start" ? SCALE_MIN_VALUE : SCALE_MAX_VALUE;
}

/**
 * The window shown at a zoom level for a marker at `value`.
 *
 * - Level 0: the whole log track, 0.01 to 100,000.
 * - Level 1: the decade under the marker, [10^k, 10^(k+1)], linear.
 * - Level 2: the tenth of that decade under the marker, [a·10^k, (a+1)·10^k],
 *   linear.
 *
 * Only the marker's value sets the window. `k` is clamped to the track's last
 * decade so the window stays on the track. Level 2 uses `a` in 1 to 9.
 */
export function zoomWindow(level: ZoomLevel, value: number): ZoomWindow {
  if (level === 0) {
    return {
      level,
      min: SCALE_MIN_VALUE,
      max: SCALE_MAX_VALUE,
      scale: "log",
      step: null,
    };
  }

  const v = clampValue(value);
  const k = Math.min(decadeOf(v), SCALE_MAX_EXP - 1);
  const decade = pow10(k);
  const step = pow10(k - 1);

  if (level === 1) {
    return {
      level,
      min: decade,
      max: pow10(k + 1),
      scale: "linear",
      step,
    };
  }

  const a = Math.min(Math.max(Math.floor(v / decade), 1), 9);
  return {
    level,
    min: Number((a * decade).toPrecision(12)),
    max: Number(((a + 1) * decade).toPrecision(12)),
    scale: "linear",
    step,
  };
}

/** The position in [0, 1] of `value` within a zoom window, clamped. */
export function positionInWindow(value: number, window: ZoomWindow): number {
  if (window.scale === "log") return positionOf(value);
  const span = window.max - window.min;
  return clamp01((value - window.min) / span);
}

/**
 * The value at position `x` within a zoom window, rounded to three significant
 * figures. The level-0 case is `valueAt`.
 */
export function valueInWindow(x: number, window: ZoomWindow): number {
  if (window.scale === "log") return valueAt(x);
  const raw = window.min + clamp01(x) * (window.max - window.min);
  return clampValue(roundSig(raw, SCALE_SIG_FIGS));
}

/**
 * Snap `value` to the nearest multiple of the window's step, so a linear drag
 * lands on the step sizes shown in design.md. Level 0 has no step and returns
 * the value unchanged.
 */
export function snapToStep(value: number, window: ZoomWindow): number {
  if (window.step === null) return clampValue(value);
  const steps = Math.round((value - window.min) / window.step);
  const snapped = window.min + steps * window.step;
  const bounded = Math.min(Math.max(snapped, window.min), window.max);
  return clampValue(Number(bounded.toPrecision(12)));
}
