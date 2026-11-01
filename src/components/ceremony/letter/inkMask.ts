// Feature: 05-reveal-ceremony
//
// Mask helpers for the ink reveal (R7.2, Property 14's ink clause). The letter
// paragraph is covered by a solid mask. The mask is only ever given `mask-*`
// properties, and it grows from the top, so each visual line is uncovered in
// turn. The mask height is the sum of every line's progress, so the overlapping
// fades (a step shorter than a fade) never run backwards.
//
// The helpers take a structural target, not a DOM element, so the tests can
// pass a fake. `InkLetter.tsx` passes the real paragraph.

import type { InkPlan } from "./inkPlan";

/** The part of an element these helpers touch: its inline style and animate(). */
export type InkTarget = {
  style: {
    setProperty(name: string, value: string): void;
    removeProperty(name: string): string;
  };
  animate(
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ): { cancel(): void };
};

/** An applied ink reveal. Cancelling it removes the mask. */
export type InkRun = { cancel(): void };

/** The mask properties this module sets, and nothing else. */
export const INK_MASK_PROPERTIES = [
  "mask-image",
  "-webkit-mask-image",
  "mask-size",
  "-webkit-mask-size",
  "mask-repeat",
  "-webkit-mask-repeat",
  "mask-position",
  "-webkit-mask-position",
] as const;

const MASK_IMAGE = "linear-gradient(#000, #000)";

/**
 * Read a computed `line-height` as pixels. Returns undefined when the browser
 * gives a keyword such as `normal`, so the caller shows the text unanimated.
 */
export function readLineHeightPx(computed: string): number | undefined {
  const match = /^(\d+(?:\.\d+)?)px$/.exec(computed.trim());
  if (match === null) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/** Visual lines in a box of `heightPx`, at `lineHeightPx` per line. */
export function countInkLines(heightPx: number, lineHeightPx: number): number {
  if (!Number.isFinite(heightPx) || !Number.isFinite(lineHeightPx)) return 0;
  if (heightPx <= 0 || lineHeightPx <= 0) return 0;
  return Math.round(heightPx / lineHeightPx);
}

/** Mask height in px at time `t`: each line grows from 0 to one line over its fade. */
function revealedPx(plan: InkPlan, t: number, lineHeightPx: number): number {
  let sum = 0;
  for (const line of plan.lines) {
    const progress = (t - line.delayMs) / line.durationMs;
    sum += Math.min(1, Math.max(0, progress));
  }
  return sum * lineHeightPx;
}

/**
 * Keyframes for the mask height, one per breakpoint (every line's start and
 * end). The last keyframe is the full box, so nothing stays clipped.
 */
export function inkKeyframes(
  plan: InkPlan,
  lineHeightPx: number,
): Keyframe[] {
  const total = plan.totalMs;
  const times = new Set<number>([0, total]);
  for (const line of plan.lines) {
    times.add(line.delayMs);
    times.add(line.delayMs + line.durationMs);
  }
  const ordered = [...times].sort((a, b) => a - b);
  return ordered.map((t, i) => {
    const offset = total === 0 ? 0 : t / total;
    const isEnd = i === ordered.length - 1;
    return {
      offset,
      maskSize: isEnd ? "100% 100%" : `100% ${revealedPx(plan, t, lineHeightPx).toFixed(2)}px`,
      webkitMaskSize: isEnd ? "100% 100%" : `100% ${revealedPx(plan, t, lineHeightPx).toFixed(2)}px`,
    } as Keyframe;
  });
}

/**
 * Cover the target with the mask and animate it line by line. Returns undefined
 * when there is nothing to animate (no lines), so the text stays visible.
 */
export function applyInk(
  target: InkTarget,
  options: { lineHeightPx: number; plan: InkPlan },
): InkRun | undefined {
  const { plan, lineHeightPx } = options;
  if (plan.lines.length === 0 || plan.totalMs <= 0) return undefined;

  target.style.setProperty("mask-image", MASK_IMAGE);
  target.style.setProperty("-webkit-mask-image", MASK_IMAGE);
  target.style.setProperty("mask-repeat", "no-repeat");
  target.style.setProperty("-webkit-mask-repeat", "no-repeat");
  target.style.setProperty("mask-position", "0 0");
  target.style.setProperty("-webkit-mask-position", "0 0");
  target.style.setProperty("mask-size", "100% 0px");
  target.style.setProperty("-webkit-mask-size", "100% 0px");

  const animation = target.animate(inkKeyframes(plan, lineHeightPx), {
    duration: plan.totalMs,
    easing: "linear",
    fill: "forwards",
  });

  return {
    cancel() {
      animation.cancel();
      for (const name of INK_MASK_PROPERTIES) target.style.removeProperty(name);
    },
  };
}
