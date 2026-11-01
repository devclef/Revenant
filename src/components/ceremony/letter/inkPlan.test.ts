// Feature: 05-reveal-ceremony
//
// Tests for the ink timing plan (R7.2, Property 16). The plan must end within
// INK_TOTAL_MAX_MS for any line count, depend only on the line count, and use
// the per-line delay from constants.ts until the total cap would be exceeded.

import { describe, expect, it } from "vitest";

import {
  INK_LINE_DELAY_MS,
  INK_LINE_FADE_MS,
  INK_TOTAL_MAX_MS,
} from "../constants";
import { inkPlan, inkStepMs } from "./inkPlan";

describe("inkPlan ends within the 8 s cap (Property 16)", () => {
  it("ends by INK_TOTAL_MAX_MS for every line count from 1 to 2000", () => {
    for (let lines = 1; lines <= 2000; lines += 1) {
      const plan = inkPlan(lines);
      expect(plan.totalMs, `lines=${lines}`).toBeLessThanOrEqual(INK_TOTAL_MAX_MS);
      const last = plan.lines[plan.lines.length - 1];
      expect(last.delayMs + last.durationMs).toBe(plan.totalMs);
    }
  });

  it("uses the full per-line delay for a short letter", () => {
    const plan = inkPlan(3);
    expect(plan.stepMs).toBe(INK_LINE_DELAY_MS);
    expect(plan.lines.map((l) => l.delayMs)).toEqual([0, INK_LINE_DELAY_MS, 2 * INK_LINE_DELAY_MS]);
  });

  it("shrinks the step for a long letter so the last line still ends by the cap", () => {
    const lines = 100;
    const step = inkStepMs(lines);
    expect(step).toBe(Math.floor((INK_TOTAL_MAX_MS - INK_LINE_FADE_MS) / lines));
    expect(step).toBeLessThan(INK_LINE_DELAY_MS);
    expect(inkPlan(lines).totalMs).toBeLessThanOrEqual(INK_TOTAL_MAX_MS);
  });

  it("gives an empty plan with no lines", () => {
    const plan = inkPlan(0);
    expect(plan.lines).toEqual([]);
    expect(plan.totalMs).toBe(0);
  });

  it("treats a negative or non-finite count as no lines", () => {
    expect(inkPlan(-4).lines).toEqual([]);
    expect(inkPlan(Number.NaN).lines).toEqual([]);
  });
});

describe("inkPlan depends only on the line count", () => {
  it("returns the same plan for the same count, every time", () => {
    expect(inkPlan(17)).toEqual(inkPlan(17));
  });

  it("uses one fade duration and evenly spaced starts", () => {
    const plan = inkPlan(12);
    const step = plan.stepMs;
    plan.lines.forEach((line, i) => {
      expect(line.index).toBe(i);
      expect(line.delayMs).toBe(i * step);
      expect(line.durationMs).toBe(INK_LINE_FADE_MS);
    });
  });
});
