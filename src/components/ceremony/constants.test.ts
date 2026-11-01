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

import {
  CALM_FADE_MS,
  CAMERA_MOVE_MS,
  CANDLE_FLICKER_AMPLITUDE,
  POSITION_PROPERTIES,
  SEAL_HOLD_MS,
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

  it("constants.ts has no `import` statement (no import, no value from data)", () => {
    const source = readFileSync(constantsPath, "utf8");
    // Strip line and block comments so an `import` mentioned in prose does not
    // trip the check; only real statements count.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(/(^|\n)\s*import\s/.test(code)).toBe(false);
  });
});
