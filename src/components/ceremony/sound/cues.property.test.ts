// Feature: 05-reveal-ceremony, Task 10 (R14.1, R14.2, R14.4, R14.5; Property 24)
//
// Property 24: sound and vibration are optional. They are off by default,
// `sound.ts` is not loaded before the toggle is turned on, `navigator.vibrate`
// is never called while sound is off, and a rise and a fall of a figure get
// the same sound plan.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, useContext } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SoundEnabledContext } from "./SoundEnabledContext";
import { createSoundCues, type SoundModule } from "./cues";
import {
  movementCue,
  soundPlan,
  vibrate,
  type MovementDirection,
} from "./sound";

const here = dirname(fileURLToPath(import.meta.url));
const ceremonyDir = resolve(here, "..");

/** Source with comments removed, so a word in a comment never counts as code. */
const codeOnly = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const readCode = (path: string): string =>
  codeOnly(readFileSync(resolve(ceremonyDir, path), "utf8"));

/** A fake sound module that records every call. */
function fakeModule() {
  const play = vi.fn<(cue: "seal-break", enabled: boolean) => boolean>(() => true);
  const vibrateSpy = vi.fn<(enabled: boolean) => boolean>(() => true);
  const mod: SoundModule = { play, vibrate: vibrateSpy };
  return { mod, play, vibrateSpy };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Property 24: sound is off by default (R14.1)", () => {
  it("the sound context defaults to off, so a view outside CeremonyRoot is silent", () => {
    const Probe = () => createElement("span", null, String(useContext(SoundEnabledContext)));
    expect(renderToStaticMarkup(createElement(Probe))).toBe("<span>false</span>");
  });
});

describe("Property 24: sound.ts is loaded only after the first turn-on (R14.5)", () => {
  it("never loads the module while every toggle is off", () => {
    fc.assert(
      fc.property(fc.array(fc.constant(false), { maxLength: 20 }), (presses) => {
        const load = vi.fn(async () => fakeModule().mod);
        const cues = createSoundCues(load);
        for (const next of presses) cues.onToggle(next);
        expect(load).not.toHaveBeenCalled();
      }),
      { numRuns: 100 },
    );
  });

  it("loads the module at most once, and only when some press turns sound on", () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { maxLength: 20 }), (presses) => {
        const load = vi.fn(async () => fakeModule().mod);
        const cues = createSoundCues(load);
        for (const next of presses) cues.onToggle(next);
        expect(load).toHaveBeenCalledTimes(presses.includes(true) ? 1 : 0);
      }),
      { numRuns: 100 },
    );
  });

  it("the ceremony tree imports sound.ts only inside the cue controller's dynamic import", () => {
    const staticImport = /from\s+["'][^"']*\/sound\/sound(\.ts)?["']|from\s+["']\.\/sound(\.ts)?["']/;
    const dynamicImport = /import\(\s*["']\.\/sound["']\s*\)/;
    for (const file of [
      "CeremonyRoot.tsx",
      "seal/SealBreak.tsx",
      "sound/SoundToggle.tsx",
      "sound/useSoundEnabled.ts",
      "sound/cues.ts",
    ]) {
      expect(readCode(file), file).not.toMatch(staticImport);
    }
    expect(readCode("sound/cues.ts")).toMatch(dynamicImport);
  });
});

describe("Property 24: nothing plays or vibrates while sound is off (R14.2)", () => {
  it("a break with sound off calls neither play nor navigator.vibrate", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 10 }), async (breaks) => {
        const vibrateSpy = vi.fn();
        vi.stubGlobal("navigator", { vibrate: vibrateSpy });
        const { mod, play, vibrateSpy: modVibrate } = fakeModule();
        const cues = createSoundCues(async () => mod);
        for (let i = 0; i < breaks; i++) {
          await cues.sealBreak(false);
        }
        expect(play).not.toHaveBeenCalled();
        expect(modVibrate).not.toHaveBeenCalled();
        expect(vibrateSpy).not.toHaveBeenCalled();
      }),
      { numRuns: 100 },
    );
  });

  it("with the real sound.ts, a break while off never reaches navigator.vibrate", async () => {
    const vibrateSpy = vi.fn();
    vi.stubGlobal("navigator", { vibrate: vibrateSpy });
    const real = await import("./sound");
    const cues = createSoundCues(async () => real);
    await cues.sealBreak(false);
    expect(vibrateSpy).not.toHaveBeenCalled();
    expect(vibrate(false)).toBe(false);
    expect(vibrateSpy).not.toHaveBeenCalled();
  });

  it("a break with sound on plays once and vibrates once", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (breaks) => {
        const { mod, play, vibrateSpy } = fakeModule();
        const cues = createSoundCues(async () => mod);
        cues.onToggle(true);
        for (let i = 0; i < breaks; i++) {
          await cues.sealBreak(true);
        }
        expect(play).toHaveBeenCalledTimes(breaks);
        expect(vibrateSpy).toHaveBeenCalledTimes(breaks);
        expect(play).toHaveBeenCalledWith("seal-break", true);
      }),
      { numRuns: 100 },
    );
  });

  it("a rejected load leaves the break silent instead of throwing", async () => {
    const cues = createSoundCues(async () => {
      throw new Error("chunk failed");
    });
    cues.onToggle(true);
    await expect(cues.sealBreak(true)).resolves.toBeUndefined();
  });
});

describe("Property 24: a rise and a fall get the same plan (R14.4)", () => {
  it("movementCue and soundPlan are equal for rise and fall at any distance", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<MovementDirection>("rise", "fall"),
        fc.constantFrom<MovementDirection>("rise", "fall"),
        fc.double({ min: 0, max: 1000, noNaN: true }),
        fc.double({ min: 0, max: 1000, noNaN: true }),
        (a, b, distance, other) => {
          const cueA = movementCue(a, distance);
          const cueB = movementCue(b, other);
          expect(cueA).toBe(cueB);
          expect(soundPlan(cueA)).toEqual(soundPlan(cueB));
        },
      ),
      { numRuns: 100 },
    );
  });
});
