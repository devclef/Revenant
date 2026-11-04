// Feature: 05-reveal-ceremony
//
// Unit test for ceremony/constants.ts. The constants module is the single
// place every value the requirements leave to the design lives, so this test
// pins the load-bearing ones to their design.md values and enforces the
// "no import, no value computed from data" rule by reading the source and
// asserting it has no `import ` statement.
//
// No DOM: a plain value check plus one source read.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { MAX_FIGURES as LIVE_MAX_FIGURES } from "../live/constants";
import {
  FIG_CLOCK_MS,
  FIG_FADE_MS,
  FIG_START_DELAY_MS,
  FIG_STAGGER_MS,
  FIG_TOTAL_MS,
  MAX_FIGURES,
  CALM_FADE_MS,
  CAMERA_MOVE_MS,
  CANDLE_FLICKER_AMPLITUDE,
  EASE_LEAVE,
  FLAP_AT_MS,
  FLAP_LIFT_MS,
  GHOST_FADE_MS,
  GHOST_LEAVE_MS,
  LETTER_SLIDE_AT_MS,
  LETTER_SLIDE_MS,
  POSITION_PROPERTIES,
  REVEAL_DIM_MS,
  REVEAL_DIM_OPACITY,
  SEAL_HOLD_MS,
  SEAL_SETTLE_MS,
  SEAL_SHORT_MS,
  SEAL_SPLIT_MS,
  UNFOLD_AT_MS,
  UNFOLD_MS,
} from "./constants";

const here = dirname(fileURLToPath(import.meta.url));
const constantsPath = resolve(here, "constants.ts");

describe("ceremony/constants", () => {
  it("POSITION_PROPERTIES is the neutral position order from design.md (R10.3)", () => {
    expect(POSITION_PROPERTIES).toEqual(["--pos-mark", "--pos-then", "--pos-now"]);
  });

  it("POSITION_PROPERTIES is readonly (declared `as const`)", () => {
    // `as const` gives POSITION_PROPERTIES a readonly tuple type. Assert that
    // type surface at compile time: a mutating method must not exist on it, so
    // the `@ts-expect-error` below only holds if the tuple really is readonly.
    // If someone dropped `as const` and made it a mutable string[], `.push`
    // would type-check, the directive would become unused, and the build would
    // fail -- which is the guard we want.
    // @ts-expect-error POSITION_PROPERTIES is a readonly tuple; push is not callable on it.
    void POSITION_PROPERTIES.push;
    // Runtime shape the neutrality rule depends on.
    const members: readonly string[] = POSITION_PROPERTIES;
    expect(members).toHaveLength(3);
  });

  it("the design-pinned numeric constants equal their design.md values", () => {
    expect(CAMERA_MOVE_MS).toBe(700);
    expect(CALM_FADE_MS).toBe(120);
    expect(SEAL_HOLD_MS).toBe(1500);
    expect(CANDLE_FLICKER_AMPLITUDE).toBe(0.04);
  });

  it("holds the seal-break values from design.md 'Kept, changed and retired' (R6, R12)", () => {
    expect(SEAL_SETTLE_MS).toBe(300);
    expect(SEAL_SHORT_MS).toBe(450);
    expect(SEAL_SPLIT_MS).toBe(520);
    expect(FLAP_LIFT_MS).toBe(450);
    expect(LETTER_SLIDE_MS).toBe(600);
  });

  it("holds the break and letter values from design.md 'Constants' (R12.6, R12.7)", () => {
    expect(GHOST_LEAVE_MS).toBe(1100);
    expect(GHOST_FADE_MS).toBe(900);
    expect(EASE_LEAVE).toBe("cubic-bezier(0.4, 0, 0.6, 1)");
    expect(FLAP_AT_MS).toBe(250);
    expect(LETTER_SLIDE_AT_MS).toBe(550);
    expect(UNFOLD_AT_MS).toBe(1150);
    expect(UNFOLD_MS).toBe(520);
    expect(REVEAL_DIM_OPACITY).toBe(0.18);
    expect(REVEAL_DIM_MS).toBe(500);
  });

  it("constants.ts has no `import` statement (no import, no value from data)", () => {
    const source = readFileSync(constantsPath, "utf8");
    // Strip line and block comments so an `import` mentioned in prose does not
    // trip the check; only real statements count.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(/(^|\n)\s*import\s/.test(code)).toBe(false);
  });

  it("the figures constants match design.md and the spec 06 MAX_FIGURES (R14.7, R14.8)", () => {
    expect(FIG_FADE_MS).toBe(450);
    expect(FIG_STAGGER_MS).toBe(60);
    expect(FIG_START_DELAY_MS).toBe(30);
    expect(MAX_FIGURES).toBe(6);
    expect(MAX_FIGURES).toBe(LIVE_MAX_FIGURES);
    expect(FIG_TOTAL_MS).toBe(FIG_FADE_MS + FIG_STAGGER_MS * (MAX_FIGURES - 1));
    expect(FIG_CLOCK_MS).toBe(FIG_START_DELAY_MS + FIG_TOTAL_MS);
    expect(FIG_CLOCK_MS).toBe(780);
  });
});
