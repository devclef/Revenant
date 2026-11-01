// Feature: 05-reveal-ceremony
//
// Ink timing plan (R7.2, Property 16). A pure function of the visual line
// count: the same count always gives the same plan, and the last line's fade
// ends within INK_TOTAL_MAX_MS. The constants live in ../constants so that
// Property 14 can check rendered timings against them.
//
// Delay between line starts: min(INK_LINE_DELAY_MS, floor((INK_TOTAL_MAX_MS -
// INK_LINE_FADE_MS) / max(lines, 1))). Line i starts at i * step and fades for
// INK_LINE_FADE_MS.

import { INK_LINE_DELAY_MS, INK_LINE_FADE_MS, INK_TOTAL_MAX_MS } from "../constants";

/** One line's place in the ink sequence, in milliseconds from the start. */
export type InkLinePlan = {
  /** Zero-based visual line index. */
  index: number;
  /** When this line's fade starts. */
  delayMs: number;
  /** How long this line's fade lasts. */
  durationMs: number;
};

/** The whole ink sequence for a letter. */
export type InkPlan = {
  /** Gap between the start of one line's fade and the next. */
  stepMs: number;
  /** When the last line's fade ends. Never above INK_TOTAL_MAX_MS. */
  totalMs: number;
  lines: readonly InkLinePlan[];
};

/** The gap between line starts for a letter with `lines` visual lines. */
export function inkStepMs(lines: number): number {
  const count = Math.max(lines, 1);
  return Math.min(
    INK_LINE_DELAY_MS,
    Math.floor((INK_TOTAL_MAX_MS - INK_LINE_FADE_MS) / count),
  );
}

/**
 * Build the per-line ink plan. A count of zero or less gives an empty plan.
 * Depends only on `lines`.
 */
export function inkPlan(lines: number): InkPlan {
  const count = Number.isFinite(lines) ? Math.max(0, Math.floor(lines)) : 0;
  const stepMs = inkStepMs(count);
  const planned: InkLinePlan[] = [];
  for (let index = 0; index < count; index += 1) {
    planned.push({
      index,
      delayMs: index * stepMs,
      durationMs: INK_LINE_FADE_MS,
    });
  }
  const last = planned[planned.length - 1];
  const totalMs = last === undefined ? 0 : last.delayMs + last.durationMs;
  return { stepMs, totalMs, lines: planned };
}
