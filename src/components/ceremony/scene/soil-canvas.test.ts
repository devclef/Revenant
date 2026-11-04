// Feature: 07-judge-journey
//
// Property 11 (design.md "Correctness Properties"): the Soil_Canvas draws the
// same thing from the seed. Runs the pure soil model and draw code against a
// recording fake 2D context, so no DOM or canvas package is needed.

import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CLOD_LIFE_MS, DUST_CEILING_GAP_PX, DUST_MAX_PARTICLES, EDGE_BAND_PX, RISE_AT_MS, SOIL_DPR_MAX } from "../constants";
import { lightX, soilBandPx, soilTopPx } from "./layout";
import { buildSoilModel, type SoilGeometry, type SoilModel } from "./soil-model";
import {
  backingSize,
  clodPoint,
  drawBase,
  drawMotion,
  dustCeiling,
  dotCentreY,
  dustPoint,
  parseHexColour,
  readColours,
  shouldDrawClods,
  soilGeometry,
  type CeilingInputs,
  type SoilColours,
} from "./soil-canvas";

type LogEntry = { op: string; args: unknown[] };

/**
 * A fake 2D context that records every call and every property assignment, in
 * order. Two runs that draw the same thing give equal logs.
 */
function recordingContext(): { ctx: CanvasRenderingContext2D; log: LogEntry[] } {
  const log: LogEntry[] = [];
  // A gradient keeps its stops as plain data, so two runs compare equal.
  const newGradient = () => {
    const stops: unknown[] = [];
    return {
      stops,
      addColorStop: (offset: number, colour: string) => {
        stops.push([offset, colour]);
        log.push({ op: "addColorStop", args: [offset, colour] });
      },
    };
  };
  const ctx = new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== "string") {
          return undefined;
        }
        if (prop === "createLinearGradient") {
          return (...args: unknown[]) => {
            log.push({ op: prop, args });
            return newGradient();
          };
        }
        return (...args: unknown[]) => {
          log.push({ op: prop, args });
        };
      },
      set(_target, prop, value) {
        const plain = typeof value === "object" && value !== null && "stops" in value ? { stops: value.stops } : value;
        log.push({ op: `set ${String(prop)}`, args: [plain] });
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, log };
}

const COLOURS: SoilColours = {
  deep: [13, 10, 16],
  mid: [33, 24, 41],
  lit: [176, 128, 255],
  dust: [214, 190, 255],
  clod: [42, 31, 51],
};

/** Canvas sizes from 320 × 480 to 2560 × 1600, and DPR from 1 to 4. */
const viewport = fc.record({
  w: fc.integer({ min: 320, max: 2560 }),
  h: fc.integer({ min: 480, max: 1600 }),
  dpr: fc.double({ min: 1, max: 4, noNaN: true, noDefaultInfinity: true }),
});

const ceilingInputs: fc.Arbitrary<CeilingInputs> = fc.record({
  barBottom: fc.double({ min: 0, max: 200, noNaN: true, noDefaultInfinity: true }),
  headlineBottom: fc.option(fc.double({ min: 0, max: 900, noNaN: true, noDefaultInfinity: true }), { nil: null }),
  translateY: fc.double({ min: -300, max: 0, noNaN: true, noDefaultInfinity: true }),
});

const RUNS = { numRuns: 100 };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Property 11: the Soil_Canvas draws the same thing from the seed", () => {
  it("gives identical base and frame draw logs when run twice", () => {
    fc.assert(
      fc.property(viewport, fc.integer({ min: 0, max: 4000 }), ({ w, h }, elapsedMs) => {
        const g = soilGeometry(w, h);
        const ceiling = g.y0 - 40;
        const runOnce = () => {
          const base = recordingContext();
          drawBase(base.ctx, g, buildSoilModel(g), COLOURS);
          const frame = recordingContext();
          drawMotion(frame.ctx, g, buildSoilModel(g), COLOURS, ceiling, elapsedMs, true);
          return [base.log, frame.log];
        };
        expect(runOnce()).toStrictEqual(runOnce());
      }),
      RUNS,
    );
  }, 30_000);

  it("keeps every soil shape within EDGE_BAND_PX above the soil top", () => {
    fc.assert(
      fc.property(viewport, ({ w, h }) => {
        const g = soilGeometry(w, h);
        const model = buildSoilModel(g);
        for (const c of [...model.backClumps, ...model.frontClumps]) {
          expect(c.cy - c.ry).toBeGreaterThanOrEqual(g.y0 - EDGE_BAND_PX);
        }
      }),
      RUNS,
    );
  });

  it("keeps the dust count at or under DUST_MAX_PARTICLES", () => {
    fc.assert(
      fc.property(viewport, ({ w, h }) => {
        const model = buildSoilModel(soilGeometry(w, h));
        expect(model.dust.length).toBeLessThanOrEqual(DUST_MAX_PARTICLES);
      }),
      RUNS,
    );
  });

  it("uses a backing-store ratio of at most SOIL_DPR_MAX", () => {
    fc.assert(
      fc.property(viewport, ({ w, h, dpr }) => {
        const size = backingSize(w, h, dpr);
        expect(size.ratio).toBeLessThanOrEqual(SOIL_DPR_MAX);
        expect(size.ratio).toBeGreaterThanOrEqual(1);
        expect(size.width).toBe(Math.round(w * size.ratio));
        expect(size.height).toBe(Math.round(h * size.ratio));
      }),
      RUNS,
    );
  });

  it("never draws dust or clods above the ceiling, for any Top_Bar, headline and translateY", () => {
    fc.assert(
      fc.property(viewport, ceilingInputs, fc.integer({ min: 0, max: 3000 }), ({ w, h }, inputs, ms) => {
        const g = soilGeometry(w, h);
        const model = buildSoilModel(g);
        const ceiling = dustCeiling(inputs);
        const expected = Math.max(inputs.barBottom, inputs.headlineBottom ?? inputs.barBottom) + DUST_CEILING_GAP_PX - inputs.translateY;
        expect(ceiling).toBeCloseTo(expected, 9);

        const elapsedS = ms / 1000;
        for (const d of model.dust) {
          expect(dustPoint(d, g, ceiling, elapsedS).y).toBeGreaterThanOrEqual(ceiling);
        }
        const tauS = (ms - RISE_AT_MS) / 1000;
        for (const c of model.clods) {
          const p = clodPoint(c, g, ceiling, tauS);
          if (p !== null) {
            expect(p.y).toBeGreaterThanOrEqual(ceiling);
          }
        }
      }),
      RUNS,
    );
  });

  it("draws every dust and clod edge on or below the ceiling, so none shows above it (D1, R6.16)", () => {
    fc.assert(
      fc.property(viewport, ceilingInputs, fc.integer({ min: 0, max: 3000 }), ({ w, h }, inputs, ms) => {
        const g = soilGeometry(w, h);
        const model = buildSoilModel(g);
        const ceiling = dustCeiling(inputs);
        const frame = recordingContext();
        drawMotion(frame.ctx, g, model, COLOURS, ceiling, ms, true);
        const arcs = frame.log.filter((e) => e.op === "arc");
        expect(arcs.length).toBeGreaterThan(0);
        for (const arc of arcs) {
          const [, y, r] = arc.args as number[];
          expect(y - r).toBeGreaterThanOrEqual(ceiling);
        }
      }),
      RUNS,
    );
  });

  it("keeps a dot's centre where it is when the dot is already below the ceiling", () => {
    expect(dotCentreY(10, 2, 20)).toBe(23);
    expect(dotCentreY(40, 2, 20)).toBe(40);
  });

  it("places the light at frameL + 0.72 × frameW from 900 px up, and at w / 2 below", () => {
    fc.assert(
      fc.property(fc.integer({ min: 320, max: 2560 }), (w) => {
        const lx = lightX(w);
        if (w >= 900) {
          const frameW = Math.min(w, 1440);
          const frameL = (w - frameW) / 2;
          expect(lx).toBeCloseTo(frameL + 0.72 * frameW, 9);
        } else {
          expect(lx).toBeCloseTo(w / 2, 9);
        }
      }),
      RUNS,
    );
  });

  it("covers the full canvas width with the base", () => {
    fc.assert(
      fc.property(viewport, ({ w, h }) => {
        const g = soilGeometry(w, h);
        const { ctx, log } = recordingContext();
        drawBase(ctx, g, buildSoilModel(g), COLOURS);
        const firstFill = log.find((e) => e.op === "fillRect");
        expect(firstFill).toBeDefined();
        expect(firstFill!.args[0]).toBe(0);
        expect(firstFill!.args[2]).toBe(w);
      }),
      RUNS,
    );
  });

  it("never calls Math.random or Date.now while building or drawing the model", () => {
    const random = vi.spyOn(Math, "random");
    const now = vi.spyOn(Date, "now");
    fc.assert(
      fc.property(viewport, ({ w, h }) => {
        const g = soilGeometry(w, h);
        const { ctx } = recordingContext();
        drawMotion(ctx, g, buildSoilModel(g), COLOURS, g.y0 - 40, 1200, true);
      }),
      RUNS,
    );
    expect(random).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
  });
});

describe("soil-canvas helpers", () => {
  it("builds the geometry from the soil-model helpers", () => {
    const g = soilGeometry(1280, 800);
    expect(g.w).toBe(1280);
    expect(g.y0).toBe(soilTopPx(1280, 800));
    expect(g.band).toBe(soilBandPx(1280, 800));
    expect(g.lx).toBe(lightX(1280));
  });

  it("uses the DPR as given up to the cap, and 1 when it is missing", () => {
    expect(backingSize(100, 100, 1.5).ratio).toBe(1.5);
    expect(backingSize(100, 100, 3).ratio).toBe(SOIL_DPR_MAX);
    expect(backingSize(100, 100, undefined).ratio).toBe(1);
  });

  it("parses only six-digit hex token values", () => {
    expect(parseHexColour(" #0d0a10 ")).toEqual([13, 10, 16]);
    expect(parseHexColour("rgba(0, 0, 0, 0.5)")).toBeNull();
    expect(parseHexColour("")).toBeNull();
  });

  it("reads all six soil tokens, or none", () => {
    const tokens: Record<string, string> = {
      "--soil-deep": "#0d0a10",
      "--soil-mid": "#211829",
      "--soil-lit": "#b080ff",
      "--dust": "#d6beff",
      "--clod": "#2a1f33",
    };
    expect(readColours({ getPropertyValue: (name: string) => tokens[name] ?? "" })).toEqual({
      deep: [13, 10, 16],
      mid: [33, 24, 41],
      lit: [176, 128, 255],
      dust: [214, 190, 255],
      clod: [42, 31, 51],
    });
    expect(readColours({ getPropertyValue: () => "" })).toBeNull();
  });

  it("draws clods only in full motion, from the rise onward", () => {
    expect(shouldDrawClods("full", RISE_AT_MS)).toBe(true);
    expect(shouldDrawClods("full", RISE_AT_MS - 1)).toBe(false);
    expect(shouldDrawClods("calm", RISE_AT_MS + 500)).toBe(false);
    expect(shouldDrawClods("light", RISE_AT_MS + 500)).toBe(false);
  });

  it("ends each clod at its life and before its launch", () => {
    const g: SoilGeometry = { w: 1000, band: 100, y0: 600, lx: 500 };
    const model: SoilModel = buildSoilModel(g);
    const clod = model.clods[0];
    expect(clodPoint(clod, g, 0, -0.1)).toBeNull();
    expect(clodPoint(clod, g, 0, CLOD_LIFE_MS / 1000)).toBeNull();
    expect(clodPoint(clod, g, 0, 0)?.alpha).toBe(1);
  });
});
