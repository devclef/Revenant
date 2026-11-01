// Feature: 05-reveal-ceremony
//
// Tests for the mask helpers (R7.2, Property 14's ink clause). The helpers take
// a structural target, so a fake records every style write and animation. The
// assertions are that only mask-* properties are touched, the keyframes reach
// the full box, and nothing is animated when the line height or count is
// unknown.

import { describe, expect, it } from "vitest";

import { inkPlan } from "./inkPlan";
import {
  applyInk,
  countInkLines,
  inkKeyframes,
  readLineHeightPx,
  type InkTarget,
} from "./inkMask";

function fakeTarget() {
  const set: string[] = [];
  const removed: string[] = [];
  const animations: { keyframes: Keyframe[]; options: KeyframeAnimationOptions; cancelled: boolean }[] = [];
  const target: InkTarget = {
    style: {
      setProperty(name) {
        set.push(name);
      },
      removeProperty(name) {
        removed.push(name);
        return "";
      },
    },
    animate(keyframes, options) {
      const record = { keyframes, options, cancelled: false };
      animations.push(record);
      return {
        cancel() {
          record.cancelled = true;
        },
      };
    },
  };
  return { target, set, removed, animations };
}

describe("readLineHeightPx", () => {
  it("reads a pixel line height", () => {
    expect(readLineHeightPx("27.2px")).toBe(27.2);
  });

  it("returns undefined for the normal keyword or an unusable value", () => {
    expect(readLineHeightPx("normal")).toBeUndefined();
    expect(readLineHeightPx("")).toBeUndefined();
    expect(readLineHeightPx("1.6")).toBeUndefined();
    expect(readLineHeightPx("0px")).toBeUndefined();
  });
});

describe("countInkLines", () => {
  it("rounds the box height to whole lines", () => {
    expect(countInkLines(81.6, 27.2)).toBe(3);
  });

  it("is zero for an empty or unmeasured box", () => {
    expect(countInkLines(0, 27.2)).toBe(0);
    expect(countInkLines(Number.NaN, 27.2)).toBe(0);
    expect(countInkLines(81.6, 0)).toBe(0);
  });
});

describe("applyInk touches only mask-* properties", () => {
  it("sets only mask-* style properties", () => {
    const { target, set } = fakeTarget();
    applyInk(target, { lineHeightPx: 20, plan: inkPlan(4) });
    expect(set.length).toBeGreaterThan(0);
    for (const name of set) expect(name).toMatch(/mask/);
  });

  it("animates only mask-* keyframe properties", () => {
    const { target, animations } = fakeTarget();
    applyInk(target, { lineHeightPx: 20, plan: inkPlan(4) });
    expect(animations).toHaveLength(1);
    for (const frame of animations[0].keyframes) {
      for (const key of Object.keys(frame)) {
        if (key === "offset") continue;
        expect(key).toMatch(/mask/i);
      }
    }
  });

  it("removes only mask-* properties when cancelled, and cancels the animation", () => {
    const { target, removed, animations } = fakeTarget();
    const run = applyInk(target, { lineHeightPx: 20, plan: inkPlan(4) });
    run?.cancel();
    expect(animations[0].cancelled).toBe(true);
    expect(removed.length).toBeGreaterThan(0);
    for (const name of removed) expect(name).toMatch(/mask/);
  });
});

describe("applyInk and keyframes", () => {
  it("animates over the plan's total, with fill forwards", () => {
    const { target, animations } = fakeTarget();
    const plan = inkPlan(10);
    applyInk(target, { lineHeightPx: 20, plan });
    expect(animations[0].options.duration).toBe(plan.totalMs);
    expect(animations[0].options.fill).toBe("forwards");
  });

  it("starts hidden and ends at the full box, never clipping the last line", () => {
    const frames = inkKeyframes(inkPlan(5), 20);
    expect(frames[0].offset).toBe(0);
    expect(frames[0].maskSize).toBe("100% 0.00px");
    expect(frames[frames.length - 1].offset).toBe(1);
    expect(frames[frames.length - 1].maskSize).toBe("100% 100%");
  });

  it("never reveals less as time passes (the mask only grows)", () => {
    const frames = inkKeyframes(inkPlan(40), 20);
    const heights = frames
      .slice(0, -1)
      .map((f) => Number.parseFloat(String(f.maskSize).split(" ")[1]));
    for (let i = 1; i < heights.length; i += 1) {
      expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1]);
    }
  });

  it("does nothing and returns no run when there are no lines", () => {
    const { target, set, animations } = fakeTarget();
    expect(applyInk(target, { lineHeightPx: 20, plan: inkPlan(0) })).toBeUndefined();
    expect(set).toEqual([]);
    expect(animations).toEqual([]);
  });
});
