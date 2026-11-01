// Feature: 05-reveal-ceremony
//
// Tests for the ink run lifecycle (inkSession.ts): when a letter animates, the
// skip control's effect, the timer settle, and cancel. No DOM: the target is a
// fake with the style and animate() members the helpers use, and timers are
// faked with Vitest.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { INK_TOTAL_MAX_MS } from "../constants";
import type { InkTarget } from "./inkMask";
import { INK_MASK_PROPERTIES } from "./inkMask";
import { planInkRun, startInkSession } from "./inkSession";

function fakeTarget() {
  const style = new Map<string, string>();
  const animations: { cancelled: boolean; cancel(): void }[] = [];
  const target: InkTarget = {
    style: {
      setProperty(name, value) {
        style.set(name, value);
      },
      removeProperty(name) {
        const old = style.get(name) ?? "";
        style.delete(name);
        return old;
      },
    },
    animate() {
      const animation = {
        cancelled: false,
        cancel() {
          animation.cancelled = true;
        },
      };
      animations.push(animation);
      return animation;
    },
  };
  return { target, style, animations };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("planInkRun", () => {
  it("animates a full-motion letter with a readable line height and lines", () => {
    const start = planInkRun({ mode: "full", computedLineHeight: "22.4px", boxHeightPx: 67.2 });
    expect(start).toBeDefined();
    expect(start?.lineHeightPx).toBe(22.4);
    expect(start?.plan.lines).toHaveLength(3);
    expect(start?.plan.totalMs).toBeLessThanOrEqual(INK_TOTAL_MAX_MS);
  });

  it("does not animate under reduced motion (calm)", () => {
    expect(
      planInkRun({ mode: "calm", computedLineHeight: "22.4px", boxHeightPx: 67.2 }),
    ).toBeUndefined();
  });

  it("does not animate on a low-power device (light)", () => {
    expect(
      planInkRun({ mode: "light", computedLineHeight: "22.4px", boxHeightPx: 67.2 }),
    ).toBeUndefined();
  });

  it("shows the text unanimated when the line height is a keyword", () => {
    expect(
      planInkRun({ mode: "full", computedLineHeight: "normal", boxHeightPx: 67.2 }),
    ).toBeUndefined();
  });

  it("shows the text unanimated when the box has no visual lines", () => {
    expect(
      planInkRun({ mode: "full", computedLineHeight: "22.4px", boxHeightPx: 0 }),
    ).toBeUndefined();
  });
});

describe("startInkSession", () => {
  const start = { lineHeightPx: 22.4, plan: planInkRun({ mode: "full", computedLineHeight: "22.4px", boxHeightPx: 67.2 })!.plan };

  it("masks the target and starts one animation", () => {
    const { target, style, animations } = fakeTarget();
    const session = startInkSession(target, start, () => {});
    expect(session).toBeDefined();
    expect(animations).toHaveLength(1);
    expect(style.get("mask-image")).toBeDefined();
  });

  it("skip settles at once: mask removed, animation cancelled, onSettled runs once", () => {
    const { target, style, animations } = fakeTarget();
    const onSettled = vi.fn();
    const session = startInkSession(target, start, onSettled);

    session?.skip();

    expect(animations[0]?.cancelled).toBe(true);
    for (const name of INK_MASK_PROPERTIES) {
      expect(style.has(name)).toBe(false);
    }
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("skip is a no-op after the run has already settled", () => {
    const { target } = fakeTarget();
    const onSettled = vi.fn();
    const session = startInkSession(target, start, onSettled);

    session?.skip();
    session?.skip();
    vi.advanceTimersByTime(start.plan.totalMs + 1000);

    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("settles by itself when the plan's total time has passed", () => {
    const { target, style } = fakeTarget();
    const onSettled = vi.fn();
    startInkSession(target, start, onSettled);

    vi.advanceTimersByTime(start.plan.totalMs - 1);
    expect(onSettled).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(style.has("mask-image")).toBe(false);
  });

  it("a skip before the timer does not let the timer settle a second time", () => {
    const { target } = fakeTarget();
    const onSettled = vi.fn();
    const session = startInkSession(target, start, onSettled);

    session?.skip();
    vi.advanceTimersByTime(start.plan.totalMs + 1000);

    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("cancel removes the mask without calling onSettled", () => {
    const { target, style, animations } = fakeTarget();
    const onSettled = vi.fn();
    const session = startInkSession(target, start, onSettled);

    session?.cancel();
    vi.advanceTimersByTime(start.plan.totalMs + 1000);

    expect(animations[0]?.cancelled).toBe(true);
    expect(style.has("mask-image")).toBe(false);
    expect(onSettled).not.toHaveBeenCalled();
  });

  it("returns undefined when the plan has no lines to animate", () => {
    const { target, animations } = fakeTarget();
    const empty = { lineHeightPx: 22.4, plan: { stepMs: 0, totalMs: 0, lines: [] } };
    expect(startInkSession(target, empty, () => {})).toBeUndefined();
    expect(animations).toHaveLength(0);
  });
});
