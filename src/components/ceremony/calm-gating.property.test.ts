// Feature: 07-judge-journey, Property 22: Calm starts no motion and requests no chunk
//
// With motion `calm`, every decorative motion plan is empty and no chunk is
// requested. In `light`, the Soil_Canvas chunk is not requested either. Checked
// with fast-check (numRuns 100) over the modes and device signals:
//
//   - the motion mode resolves to `calm` whenever reduced motion or the Calm
//     control is on, whatever the device is;
//   - the Soil_Canvas loader may load only in `full` motion, once the device
//     signals are resolved, and `startSoilCanvas` never calls `load` in
//     `light` or `calm`;
//   - the Seal_Break and figures fade-up plans are empty in `calm`;
//   - no Emergence rise is found in a list of animations that has none, so the
//     Pick_Up_Button shows at once (useEmergence settles to `done`);
//   - a break with sound off, and a sound toggle turned off, load no sound
//     module. The sound chunk loads only after the judge turns sound on.
//
// The Ghost's unmount in the ADVANCE render and the Calm pass-through of the
// break hold are covered by `useSealBreak.test.ts`.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import { MotionProvider, resolveMode, useMotion, type MotionMode } from "./motion";
import { planSealBreak } from "./seal/SealBreak";
import { planFiguresFadeUp } from "./figures/FiguresFadeUp";
import { soilCanvasMayLoad, startSoilCanvas } from "./scene/soil-canvas-start";
import { findRise, isRiseName } from "./scene/useEmergence";
import { createSoundCues, type SoundModule } from "./sound/cues";

const NUM_RUNS = { numRuns: 100 };

const modeArb = fc.constantFrom<MotionMode>("full", "light", "calm");

describe("Property 22: Calm starts no motion and requests no chunk", () => {
  it("resolves to calm whenever reduced motion or the Calm control is on", () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), fc.boolean(), (reducedMotion, calmControl, lowPower) => {
        const mode = resolveMode({ reducedMotion, calmControl, lowPower });
        if (reducedMotion || calmControl) {
          expect(mode).toBe("calm");
        } else {
          expect(mode).toBe(lowPower ? "light" : "full");
        }
      }),
      NUM_RUNS,
    );
  });

  it("reports ready false on the first render, so the loader waits for the device signals", () => {
    let ready: boolean | null = null;
    function Probe() {
      ready = useMotion().ready;
      return null;
    }
    renderToStaticMarkup(createElement(MotionProvider, null, createElement(Probe)));
    expect(ready).toBe(false);
  });

  it("lets the Soil_Canvas loader load only in full motion once the device is resolved", () => {
    fc.assert(
      fc.property(modeArb, fc.boolean(), (mode, ready) => {
        expect(soilCanvasMayLoad({ mode, ready })).toBe(mode === "full" && ready);
      }),
      NUM_RUNS,
    );
  });

  it("never calls the Soil_Canvas load in light or calm, so no chunk is requested", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom<MotionMode>("light", "calm"), async (mode) => {
        const load = vi.fn(async () => ({ mountSoilCanvas: vi.fn(() => null) }));
        const handle = await startSoilCanvas({
          mode,
          container: {} as HTMLElement,
          readCeiling: () => ({ barBottom: 0, headlineBottom: null, translateY: 0 }),
          load,
        });
        expect(handle).toBeNull();
        expect(load).not.toHaveBeenCalled();
      }),
      NUM_RUNS,
    );
  });

  it("plans an empty Seal_Break and an empty figures fade-up in calm", () => {
    fc.assert(
      fc.property(fc.nat({ max: 12 }), (count) => {
        expect(planSealBreak({ calm: true }).steps).toHaveLength(0);
        const plan = planFiguresFadeUp(count, "calm");
        expect(plan.entries).toHaveLength(0);
        expect(plan.clockMs).toBe(0);
        expect(plan.totalMs).toBe(0);
      }),
      NUM_RUNS,
    );
  });

  it("finds no Emergence rise among animations that are not the rise", () => {
    const otherName = fc.string().filter((name) => !isRiseName(name));
    const animation = fc.record({
      animationName: otherName,
      playState: fc.constantFrom("running", "paused", "idle"),
    });
    fc.assert(
      fc.property(fc.array(animation, { maxLength: 8 }), (animations) => {
        expect(findRise(animations as unknown as Animation[])).toBeUndefined();
      }),
      NUM_RUNS,
    );
  });

  it("loads no sound module on a calm break or a toggle-off while sound is off", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 6 }), async (breaks) => {
        const load = vi.fn(async (): Promise<SoundModule> => ({
          play: vi.fn(() => true),
          vibrate: vi.fn(() => true),
        }));
        const cues = createSoundCues(load);
        for (let index = 0; index < breaks; index += 1) {
          cues.onToggle(false);
          await cues.sealBreak(false);
        }
        expect(load).not.toHaveBeenCalled();
      }),
      NUM_RUNS,
    );
  });
});
