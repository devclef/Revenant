"use client";

// Feature: 07-judge-journey, spec 07 task 6 (design.md "Figures", "Fade-up")
//
// FiguresFadeUp wraps the figures column of stage 3. Each entry (any element
// marked `data-figure-entry`) gets one Web Animation: opacity 0 and
// translateY(14px) to none, over FIG_FADE_MS, delayed by
// FIG_START_DELAY_MS + FIG_STAGGER_MS * min(index, MAX_FIGURES - 1). One more
// Web Animation on the column is the clock: it runs FIG_CLOCK_MS whatever the
// number of figures. When the clock ends, or Skip ends it, the local view
// becomes `figures: "settled"` and the Close mounts.
//
// The plan is pure (`planFiguresFadeUp`), so the timing rule is testable
// without a DOM. The component only runs it: in Calm, or once the figures are
// already settled, no animation is created.

import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

import {
  EASE_STANDARD,
  FIG_CLOCK_MS,
  FIG_FADE_MS,
  FIG_START_DELAY_MS,
  FIG_STAGGER_MS,
  MAX_FIGURES,
} from "../constants";
import { useLocalView } from "../local-view";
import type { MotionMode } from "../motion";
import { useMotion } from "../motion";
import { useSequence } from "../skip";

/** The attribute the fade-up animates: one element per figure entry. */
export const FIGURE_ENTRY_ATTRIBUTE = "data-figure-entry";

/** One entry's fade, relative to the start of stage 3. */
export type FigureFadePlanEntry = {
  index: number;
  delayMs: number;
  durationMs: number;
};

/** The whole fade-up for a figure count and motion mode. */
export type FiguresFadeUpPlan = {
  /** One fade per figure, in payload order. Empty in Calm. */
  entries: readonly FigureFadePlanEntry[];
  /** The clock: how long the column runs before it settles. 0 in Calm. */
  clockMs: number;
  /** When the whole sequence has settled. 0 in Calm. */
  totalMs: number;
};

/**
 * The pure plan for the figures fade-up. Each entry's delay depends only on its
 * index (R14.7). The total is FIG_CLOCK_MS in full and light motion, whatever
 * the count (R14.8, Property 4). Calm plans nothing.
 */
export function planFiguresFadeUp(count: number, mode: MotionMode): FiguresFadeUpPlan {
  if (mode === "calm") {
    return { entries: [], clockMs: 0, totalMs: 0 };
  }
  const entries: FigureFadePlanEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    entries.push({
      index,
      delayMs: FIG_START_DELAY_MS + FIG_STAGGER_MS * Math.min(index, MAX_FIGURES - 1),
      durationMs: FIG_FADE_MS,
    });
  }
  return { entries, clockMs: FIG_CLOCK_MS, totalMs: FIG_CLOCK_MS };
}

export type FiguresFadeUpProps = {
  /** The number of figure entries in the column (only the count shapes the plan). */
  count: number;
  /** The figures column: each entry is marked `data-figure-entry`. */
  children: ReactNode;
};

export function FiguresFadeUp({ count, children }: FiguresFadeUpProps) {
  const { mode } = useMotion();
  const { localView, setLocalView } = useLocalView();
  const { register } = useSequence();

  const columnRef = useRef<HTMLDivElement>(null);
  const animations = useRef<Animation[]>([]);
  const started = useRef(false);
  const finished = useRef(false);

  // Settle: cancel every fade and the clock, then report `settled`. Runs once.
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    for (const animation of animations.current) {
      animation.cancel();
    }
    animations.current = [];
    setLocalView({ figures: "settled" });
  }, [setLocalView]);

  // Start the fades (full and light motion) or settle at once (Calm, or the
  // figures already settled). Runs before paint, so the first painted frame is
  // the faded-out start, not the final state.
  useLayoutEffect(() => {
    if (started.current) return;
    started.current = true;

    if (mode === "calm" || localView.figures === "settled") {
      finished.current = true;
      if (localView.figures !== "settled") setLocalView({ figures: "settled" });
      return;
    }

    const column = columnRef.current;
    const plan = planFiguresFadeUp(count, mode);
    const elements = column?.querySelectorAll<HTMLElement>(`[${FIGURE_ENTRY_ATTRIBUTE}]`) ?? [];
    try {
      if (column === null || typeof column.animate !== "function") {
        throw new Error("Web Animations are unavailable");
      }
      for (const entry of plan.entries) {
        const element = elements[entry.index];
        if (element === undefined) continue;
        animations.current.push(
          element.animate(
            [
              { opacity: 0, transform: "translateY(14px)" },
              { opacity: 1, transform: "translateY(0)" },
            ],
            { duration: entry.durationMs, delay: entry.delayMs, easing: EASE_STANDARD, fill: "both" },
          ),
        );
      }
      const clock = column.animate([{ opacity: 1 }, { opacity: 1 }], {
        duration: plan.clockMs,
      });
      animations.current.push(clock);
      clock.onfinish = finish;
    } catch {
      // Web Animations missing or throwing: jump to the final state (design.md
      // "Error Handling"). The letter and figures are then shown settled.
      finish();
    }
  }, [mode, count, localView.figures, setLocalView, finish]);

  // Register with Skip only while the figures are running. Skip ends the fades
  // and settles at once (R15.1).
  useEffect(() => {
    if (localView.figures !== "running") return undefined;
    return register(finish);
  }, [localView.figures, register, finish]);

  // Cancel any running animation when the column unmounts.
  useEffect(() => {
    const live = animations;
    return () => {
      for (const animation of live.current) animation.cancel();
      live.current = [];
    };
  }, []);

  return <div ref={columnRef}>{children}</div>;
}
