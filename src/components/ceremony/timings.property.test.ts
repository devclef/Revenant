// Feature: 07-judge-journey, Property 7 (timings)
//
// The timing checks that remain for the break. The stage 3 Counter, Passage and
// then/now plans were retired with the figures fade-up; the figures timing is
// checked in figures/FiguresFadeUp.property.test.ts (Property 4).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  EASE_LEAVE,
  FLAP_AT_MS,
  FLAP_LIFT_MS,
  GHOST_FADE_MS,
  GHOST_LEAVE_MS,
  LETTER_SLIDE_AT_MS,
  LETTER_SLIDE_MS,
  REVEAL_DIM_MS,
  REVEAL_DIM_OPACITY,
  SEAL_HOLD_MS,
  SEAL_SHORT_MS,
  SEAL_SPLIT_MS,
  UNFOLD_AT_MS,
  UNFOLD_MS,
} from "./constants";

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

describe("Property 7: the break CSS equals its constants (R18.4, design.md \"Constants\")", () => {
  const sceneCss = readFileSync(
    fileURLToPath(new URL("./scene/scene.module.css", import.meta.url)),
    "utf8",
  );
  const breakCss = readFileSync(
    fileURLToPath(new URL("./seal/SealBreak.module.css", import.meta.url)),
    "utf8",
  );

  it("the Ghost leave and fade durations in CSS equal their constants", () => {
    expect(sceneCss).toContain(`var(--ghost-leave-ms, ${GHOST_LEAVE_MS}ms)`);
    expect(sceneCss).toContain(`var(--ghost-fade-ms, ${GHOST_FADE_MS}ms)`);
    expect(GHOST_LEAVE_MS).toBe(1100);
    expect(GHOST_FADE_MS).toBe(900);
  });

  it("the Ghost leave easing fallback equals EASE_LEAVE", () => {
    expect(EASE_LEAVE).toBe("cubic-bezier(0.4, 0, 0.6, 1)");
    expect(sceneCss).toContain(`var(--ghost-leave-ease, ${EASE_LEAVE})`);
  });

  it("the reveal dim duration and opacity in CSS equal their constants", () => {
    expect(sceneCss).toContain(`var(--reveal-dim-ms, ${REVEAL_DIM_MS}ms)`);
    expect(sceneCss).toContain(`var(--reveal-dim-opacity, ${REVEAL_DIM_OPACITY})`);
    expect(REVEAL_DIM_MS).toBe(500);
    expect(REVEAL_DIM_OPACITY).toBe(0.18);
  });

  it("the flap and letter start times and durations in CSS equal their constants", () => {
    expect(breakCss).toContain(`var(--flap-at-ms, ${FLAP_AT_MS}ms)`);
    expect(breakCss).toContain(`var(--flap-lift-ms, ${FLAP_LIFT_MS}ms)`);
    expect(breakCss).toContain(`var(--letter-slide-at-ms, ${LETTER_SLIDE_AT_MS}ms)`);
    expect(breakCss).toContain(`var(--letter-slide-ms, ${LETTER_SLIDE_MS}ms)`);
    expect(FLAP_AT_MS).toBe(250);
    expect(LETTER_SLIDE_AT_MS).toBe(550);
  });
});
