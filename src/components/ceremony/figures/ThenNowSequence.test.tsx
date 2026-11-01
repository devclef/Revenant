// Feature: 05-reveal-ceremony, Task 5 (task 3 of the then-and-now work)
// Tests for ThenNowSequence (design.md "The stage 3 sequence", R3.1, R10.5,
// R11.2, R11.4, R12.7, R12.8): stage order, Skip, Calm, and a plan whose length
// does not grow with the number of entries.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  CHANGE_FADE_MS,
  COUNTER_ROLL_MS,
  EASE_STAMP,
  EASE_STANDARD,
  PASSAGE_MS,
  STAMP_DROP_MS,
  STEP_HOLD_MS,
} from "../constants";
import { LocalViewProvider } from "../local-view";
import { MotionProvider } from "../motion";
import { SkipProvider } from "../skip";
import {
  planThenNow,
  startStepFor,
  stepAfterSkip,
  ThenNowSequence,
  type ThenNowEntry,
} from "./ThenNowSequence";

const entriesOf = (count: number): ThenNowEntry[] =>
  Array.from({ length: count }, (_, index) => ({ key: `metric-${index}` }));

const renderSequence = (entries: ThenNowEntry[]): string =>
  renderToStaticMarkup(
    createElement(
      LocalViewProvider,
      null,
      createElement(
        SkipProvider,
        null,
        createElement(
          MotionProvider,
          null,
          createElement(
            ThenNowSequence,
            { entries },
            createElement("p", null, "figures"),
          ),
        ),
      ),
    ),
  );

describe("planThenNow stage order", () => {
  it("runs then, passage, now, done in that order", () => {
    const plan = planThenNow(entriesOf(2));
    expect(plan.steps.map((s) => s.step)).toEqual(["then", "passage", "now", "done"]);
  });

  it("starts each Step after the one before it", () => {
    const plan = planThenNow(entriesOf(2));
    const starts = plan.steps.map((s) => s.startMs);
    expect(starts[0]).toBe(0);
    for (let i = 1; i < starts.length; i += 1) {
      expect(starts[i]).toBeGreaterThanOrEqual(starts[i - 1]);
    }
  });

  it("holds for STEP_HOLD_MS between the then Step and passage", () => {
    const plan = planThenNow(entriesOf(1));
    const thenDuration = Math.max(STAMP_DROP_MS, COUNTER_ROLL_MS);
    const passage = plan.steps.find((s) => s.step === "passage");
    expect(passage?.startMs).toBe(thenDuration + STEP_HOLD_MS);
    expect(passage?.durationMs).toBe(PASSAGE_MS);
  });

  it("fades the change and formula lines in after the now Step", () => {
    const plan = planThenNow(entriesOf(3));
    const now = plan.steps.find((s) => s.step === "now");
    expect(now).toBeDefined();
    expect(plan.changeFade.startMs).toBe((now?.startMs ?? 0) + (now?.durationMs ?? 0));
    expect(plan.changeFade.durationMs).toBe(CHANGE_FADE_MS);
    expect(plan.totalMs).toBe(plan.changeFade.startMs + CHANGE_FADE_MS);
  });

  it("uses only constants for durations and easings", () => {
    const plan = planThenNow(entriesOf(2));
    const durations = new Set<number>([
      Math.max(STAMP_DROP_MS, COUNTER_ROLL_MS),
      PASSAGE_MS,
      CHANGE_FADE_MS,
      0,
    ]);
    for (const step of plan.steps) {
      expect(durations.has(step.durationMs)).toBe(true);
      expect([EASE_STAMP, EASE_STANDARD]).toContain(step.easing);
    }
    expect(plan.changeFade.easing).toBe(EASE_STANDARD);
  });

  it("keeps the entries in payload order", () => {
    const entries = entriesOf(4);
    expect(planThenNow(entries).entries.map((e) => e.key)).toEqual(
      entries.map((e) => e.key),
    );
  });
});

describe("planThenNow length does not grow with entries", () => {
  it("has the same number of Steps for any number of entries", () => {
    const counts = [1, 2, 5, 12];
    const lengths = counts.map((n) => planThenNow(entriesOf(n)).steps.length);
    expect(new Set(lengths).size).toBe(1);
    expect(lengths[0]).toBe(4);
  });

  it("has the same timing for any number of entries (property)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 40 }), (n) => {
        const one = planThenNow(entriesOf(1));
        const many = planThenNow(entriesOf(n));
        expect(many.steps).toEqual(one.steps);
        expect(many.totalMs).toBe(one.totalMs);
      }),
    );
  });
});

describe("Skip and Calm", () => {
  it("Skip settles at done", () => {
    expect(stepAfterSkip()).toBe("done");
  });

  it("starts at then in full and light motion", () => {
    expect(startStepFor("full")).toBe("then");
    expect(startStepFor("light")).toBe("then");
  });

  it("starts at done in Calm mode, so nothing animates", () => {
    expect(startStepFor("calm")).toBe("done");
  });

  it("renders the settled state first, with every figure in place", () => {
    const html = renderSequence(entriesOf(2));
    expect(html).toContain('data-step="done"');
    expect(html).toContain("<p>figures</p>");
    expect(html).not.toContain("role=\"status\"");
  });
});
