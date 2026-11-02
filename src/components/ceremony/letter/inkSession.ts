// Feature: 05-reveal-ceremony
//
// The decision and the lifecycle of one ink run (R7.2, R11.4). `planInkRun`
// says whether a letter animates at all and how; `startInkSession` runs it and
// can be skipped. Both take plain values, not React or the DOM, so the rules
// are unit-tested in the node environment. `InkLetter.tsx` only wires them up.
//
// No `Date.now` and no `Math.random` (Property 21). The end of a run is a
// `setTimeout` for the plan's total length, which reads no clock.

import { applyInk, countInkLines, readLineHeightPx, type InkRun, type InkTarget } from "./inkMask";
import { inkPlan, type InkPlan } from "./inkPlan";

// The timing rules, exported from this module so the ink run reads its whole
// timing from one place. `inkStepMs` is the per-line delay:
// min(INK_LINE_DELAY_MS, floor((INK_TOTAL_MAX_MS - INK_LINE_FADE_MS) / lines)).
// It is defined in inkPlan.ts, which this module imports, to avoid a cycle.
export { INK_LINE_DELAY_MS, INK_LINE_FADE_MS, INK_TOTAL_MAX_MS } from "../constants";
export { inkStepMs } from "./inkPlan";
import type { MotionMode } from "../motion";

/** What a letter needs before it can animate: the measured line and plan. */
export type InkStart = {
  lineHeightPx: number;
  plan: InkPlan;
};

/** An ink run that is in progress. */
export type InkSession = {
  /** Settle the letter at once: the whole text shows and `onSettled` runs. */
  skip(): void;
  /** Stop the run without settling it: the mask is removed, `onSettled` does not run. */
  cancel(): void;
};

/**
 * Decide whether the letter animates. Returns undefined, so the text shows with
 * no animation, when the motion mode is not `full`, when the computed line
 * height is a keyword such as `normal`, or when the box has no visual lines.
 */
export function planInkRun(input: {
  mode: MotionMode;
  computedLineHeight: string;
  boxHeightPx: number;
}): InkStart | undefined {
  if (input.mode !== "full") return undefined;
  const lineHeightPx = readLineHeightPx(input.computedLineHeight);
  if (lineHeightPx === undefined) return undefined;
  const lines = countInkLines(input.boxHeightPx, lineHeightPx);
  if (lines === 0) return undefined;
  return { lineHeightPx, plan: inkPlan(lines) };
}

/**
 * Start the ink run on `target`. Returns undefined when there is nothing to
 * animate. Otherwise the run ends either when its timer reaches the plan's total
 * length or when `skip()` is called, whichever comes first. Either way it
 * settles once: the mask is removed and `onSettled` runs exactly once.
 */
export function startInkSession(
  target: InkTarget,
  start: InkStart,
  onSettled: () => void,
): InkSession | undefined {
  const run: InkRun | undefined = applyInk(target, start);
  if (run === undefined) return undefined;

  let open = true;

  const stop = (): void => {
    open = false;
    clearTimeout(timer);
    run.cancel();
  };

  const timer = setTimeout(() => {
    if (!open) return;
    stop();
    onSettled();
  }, start.plan.totalMs);

  return {
    skip() {
      if (!open) return;
      stop();
      onSettled();
    },
    cancel() {
      if (!open) return;
      stop();
    },
  };
}
