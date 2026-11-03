// Feature: 05-reveal-ceremony, Property 14
//
// Property: timings are constants, never data. For any generated figures,
// periods, letter lengths and numbers of entries:
//
//   - every duration and easing in the rendered markup of Counter and Passage
//     is a value from constants.ts;
//   - every Step of the stage 3 plan has a duration and easing from
//     constants.ts, and the plan is the same for any number of entries;
//   - the stage 3 plan's length does not grow with the number of entries
//     (R10.5).
//
// Validates R10.5, R10.6, R12.8.
//
// Rendered with `renderToStaticMarkup` and `createElement`: no DOM library and
// no JSX, matching the other ceremony tests. Server renders resolve the motion
// mode to `full` (design.md "Motion modes"), so these markups show the timings
// that full motion would animate.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  CHANGE_FADE_MS,
  COUNTER_ROLL_MS,
  FLAP_AT_MS,
  FLAP_LIFT_MS,
  GHOST_LEAVE_MS,
  LETTER_SLIDE_AT_MS,
  LETTER_SLIDE_MS,
  SEAL_HOLD_MS,
  SEAL_SHORT_MS,
  SEAL_SPLIT_MS,
  UNFOLD_AT_MS,
  UNFOLD_MS,
  EASE_LINEAR,
  EASE_STAMP,
  EASE_STANDARD,
  PASSAGE_MS,
  STAMP_DROP_MS,
  STEP_HOLD_MS,
} from "./constants";
import { Counter, COUNTER_ROLL_STEPS } from "./figures/Counter";
import { Passage } from "./figures/Passage";
import { planThenNow, type ThenNowEntry } from "./figures/ThenNowSequence";
import { MotionProvider } from "./motion";

/** The easings a rendered or planned Step may use. Each comes from constants.ts. */
const ALLOWED_EASINGS: ReadonlySet<string> = new Set([
  EASE_STAMP,
  EASE_STANDARD,
  EASE_LINEAR,
]);

/** The stage 3 Step durations that constants.ts defines, in milliseconds. */
const THEN_DURATION_MS = Math.max(STAMP_DROP_MS, COUNTER_ROLL_MS);

const digit = fc.integer({ min: 0, max: 9 });

/** A figure value as text, with or without a fraction, for example "3.412" or "120". */
const figureText = fc
  .tuple(fc.array(digit, { minLength: 1, maxLength: 8 }), fc.array(digit, { minLength: 0, maxLength: 4 }))
  .map(([whole, fraction]) => {
    const w = whole.join("");
    return fraction.length === 0 ? w : `${w}.${fraction.join("")}`;
  });

const entriesOf = (count: number): ThenNowEntry[] =>
  Array.from({ length: count }, (_, index) => ({ key: `metric-${index}` }));

/** Every animation-duration value in a markup string, in document order. */
function durationsIn(html: string): string[] {
  return [...html.matchAll(/animation-duration:([^;"]+)/g)].map((m) => m[1] ?? "");
}

/** Every animation-timing-function value in a markup string, in document order. */
function easingsIn(html: string): string[] {
  return [...html.matchAll(/animation-timing-function:([^;"]+)/g)].map((m) => m[1] ?? "");
}

function renderCounter(value: string): string {
  return renderToStaticMarkup(
    createElement(MotionProvider, null, createElement(Counter, { value })),
  );
}

function renderPassage(): string {
  return renderToStaticMarkup(createElement(MotionProvider, null, createElement(Passage)));
}

describe("Property 14: timings come from constants, never data (R10.5, R10.6, R12.8)", () => {
  it("renders every Counter duration and easing from constants, whatever the value", () => {
    fc.assert(
      fc.property(figureText, (value) => {
        const html = renderCounter(value);
        const digits = value.replace(/\D/g, "").length;

        // One rolling strip per digit, each moved over the same constant span.
        const durations = durationsIn(html);
        expect(durations.length).toBe(digits);
        for (const duration of durations) {
          expect(duration).toBe(`${COUNTER_ROLL_MS}ms`);
        }
        for (const easing of easingsIn(html)) {
          expect(easing).toBe(EASE_STAMP);
        }

        // The roll distance is the same for every strip (R10.6).
        const steps = [...html.matchAll(/--counter-steps:(\d+)/g)].map((m) => Number(m[1]));
        expect(steps.length).toBe(digits);
        for (const step of steps) {
          expect(step).toBe(COUNTER_ROLL_STEPS);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("renders the Passage with constant duration and easings, with no span to vary it", () => {
    const html = renderPassage();
    expect(durationsIn(html).length).toBeGreaterThan(0);
    for (const duration of durationsIn(html)) {
      expect(duration).toBe(`${PASSAGE_MS}ms`);
    }
    for (const easing of easingsIn(html)) {
      expect(ALLOWED_EASINGS.has(easing)).toBe(true);
    }
  });

  it("plans the stage 3 Steps from constants, identically for any number of entries", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 60 }), (count) => {
        const plan = planThenNow(entriesOf(count));
        const reference = planThenNow(entriesOf(1));

        // The timeline is the same for every count; only the entry list differs.
        expect(plan.steps).toEqual(reference.steps);
        expect(plan.changeFade).toEqual(reference.changeFade);
        expect(plan.totalMs).toBe(reference.totalMs);
        expect(plan.entries.length).toBe(count);

        // The Steps and their start times come from the constants alone.
        expect(plan.steps.map((s) => s.step)).toEqual(["then", "passage", "now", "done"]);
        expect(plan.steps.map((s) => s.startMs)).toEqual([
          0,
          THEN_DURATION_MS + STEP_HOLD_MS,
          THEN_DURATION_MS + STEP_HOLD_MS + PASSAGE_MS,
          THEN_DURATION_MS + STEP_HOLD_MS + PASSAGE_MS + THEN_DURATION_MS + CHANGE_FADE_MS,
        ]);
        expect(plan.steps.map((s) => s.durationMs)).toEqual([
          THEN_DURATION_MS,
          PASSAGE_MS,
          THEN_DURATION_MS,
          0,
        ]);
        expect(plan.changeFade.durationMs).toBe(CHANGE_FADE_MS);
        expect(plan.totalMs).toBe(
          THEN_DURATION_MS + STEP_HOLD_MS + PASSAGE_MS + THEN_DURATION_MS + CHANGE_FADE_MS,
        );

        for (const step of plan.steps) {
          expect(ALLOWED_EASINGS.has(step.easing)).toBe(true);
        }
        expect(ALLOWED_EASINGS.has(plan.changeFade.easing)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("keeps the stage 3 plan length the same as the number of entries grows (R10.5)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 60 }), fc.integer({ min: 1, max: 60 }), (a, b) => {
        expect(planThenNow(entriesOf(a)).steps.length).toBe(
          planThenNow(entriesOf(b)).steps.length,
        );
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: 07-judge-journey, Property 7
//
// Property: the break timing bounds are sums of constants, and each sum stays
// inside its limit (design.md "Timing bounds as sums (R18)"). Hold end to the
// readable letter is 1670 ms; button to the readable letter is 2120 ms; both
// are under 3000 ms (R18.4). Every break step ends inside the readable time, so
// the letter is never read while a step is still moving.

describe("Property 7: break timing bounds hold as sums of constants (R18.4)", () => {
  const HOLD_TO_READABLE_MS = UNFOLD_AT_MS + UNFOLD_MS;
  const BUTTON_TO_READABLE_MS = SEAL_SHORT_MS + UNFOLD_AT_MS + UNFOLD_MS;

  it("hold end to readable is UNFOLD_AT_MS + UNFOLD_MS, 1670 ms, under 3000 ms", () => {
    expect(HOLD_TO_READABLE_MS).toBe(1670);
    expect(HOLD_TO_READABLE_MS).toBeLessThan(3000);
  });

  it("button to readable is SEAL_SHORT_MS + UNFOLD_AT_MS + UNFOLD_MS, 2120 ms, under 3000 ms", () => {
    expect(BUTTON_TO_READABLE_MS).toBe(2120);
    expect(BUTTON_TO_READABLE_MS).toBeLessThan(3000);
  });

  it("every break step ends at or before the unfold starts or the readable time", () => {
    expect(FLAP_AT_MS + FLAP_LIFT_MS).toBeLessThanOrEqual(UNFOLD_AT_MS);
    expect(LETTER_SLIDE_AT_MS + LETTER_SLIDE_MS).toBeLessThanOrEqual(UNFOLD_AT_MS);
    expect(GHOST_LEAVE_MS).toBeLessThanOrEqual(UNFOLD_AT_MS);
    expect(SEAL_SPLIT_MS).toBeLessThanOrEqual(UNFOLD_AT_MS);
    expect(UNFOLD_AT_MS + UNFOLD_MS).toBeLessThanOrEqual(HOLD_TO_READABLE_MS);
  });

  it("the hold itself stays the design's SEAL_HOLD_MS", () => {
    expect(SEAL_HOLD_MS).toBe(1500);
  });
});
