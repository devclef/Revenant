// Feature: 07-judge-journey
//
// Property checks for the pure soil model (design.md "SceneBackdrop and the
// Soil", Property 11). The model must be identical for the same geometry, keep
// dust at or under DUST_MAX_PARTICLES, and keep every soil shape inside the
// EDGE_BAND_PX band above the soil top.

import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DUST_MAX_PARTICLES, CLOD_COUNT, EDGE_BAND_PX } from "../constants";
import { buildSoilModel, litAt, type SoilGeometry } from "./soil-model";

const geometry: fc.Arbitrary<SoilGeometry> = fc
  .record({
    w: fc.integer({ min: 320, max: 2560 }),
    band: fc.integer({ min: 40, max: 200 }),
    y0: fc.integer({ min: 0, max: 1200 }),
    lxShare: fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
  })
  .map(({ w, band, y0, lxShare }) => ({ w, band, y0, lx: lxShare * w }));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildSoilModel", () => {
  it("gives the same model for the same geometry", () => {
    fc.assert(
      fc.property(geometry, (g) => {
        expect(buildSoilModel(g)).toStrictEqual(buildSoilModel({ ...g }));
      }),
    );
  });

  it("keeps dust at or under DUST_MAX_PARTICLES", () => {
    fc.assert(
      fc.property(geometry, (g) => {
        const model = buildSoilModel(g);
        expect(model.dust.length).toBeLessThanOrEqual(DUST_MAX_PARTICLES);
        expect(model.dust.length).toBe(DUST_MAX_PARTICLES);
      }),
    );
  });

  it("keeps every soil shape's top within EDGE_BAND_PX above the soil top", () => {
    fc.assert(
      fc.property(geometry, (g) => {
        const model = buildSoilModel(g);
        const floor = g.y0 - EDGE_BAND_PX;
        for (const clump of [...model.backClumps, ...model.frontClumps]) {
          expect(clump.cy - clump.ry).toBeGreaterThanOrEqual(floor);
        }
        for (const pebble of model.pebbles) {
          expect(pebble.y).toBeGreaterThanOrEqual(g.y0);
        }
      }),
    );
  });

  it("keeps front clumps inside the 14 px band and back clumps at y0 - 3 or lower", () => {
    fc.assert(
      fc.property(geometry, (g) => {
        const model = buildSoilModel(g);
        for (const clump of model.frontClumps) {
          expect(clump.cy - clump.ry).toBeGreaterThanOrEqual(g.y0 - EDGE_BAND_PX);
        }
        for (const clump of model.backClumps) {
          expect(clump.cy - clump.ry).toBeGreaterThanOrEqual(g.y0 - 3);
        }
      }),
    );
  });

  it("gives CLOD_COUNT clods, and dust dots with a height share in [0, 1) and alpha in range", () => {
    fc.assert(
      fc.property(geometry, (g) => {
        const model = buildSoilModel(g);
        expect(model.clods).toHaveLength(CLOD_COUNT);
        for (const dot of model.dust) {
          expect(dot.t).toBeGreaterThanOrEqual(0);
          expect(dot.t).toBeLessThan(1);
          expect(dot.alpha).toBeGreaterThanOrEqual(0.25);
          expect(dot.alpha).toBeLessThanOrEqual(0.7);
        }
      }),
    );
  });

  it("keeps every strength and shade in [0, 1]", () => {
    fc.assert(
      fc.property(geometry, (g) => {
        const model = buildSoilModel(g);
        for (const pebble of model.pebbles) {
          expect(pebble.strength).toBeGreaterThanOrEqual(0);
          expect(pebble.strength).toBeLessThanOrEqual(1);
        }
        for (const clump of model.frontClumps) {
          expect(clump.k).toBeGreaterThanOrEqual(0);
          expect(clump.k).toBeLessThanOrEqual(1);
        }
      }),
    );
  });

  it("never reads the clock or Math.random", () => {
    const random = vi.spyOn(Math, "random");
    const now = vi.spyOn(Date, "now");
    buildSoilModel({ w: 1024, band: 112, y0: 592, lx: 737.28 });
    expect(random).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
  });
});

describe("litAt", () => {
  it("is 1 at the light and falls off with distance", () => {
    expect(litAt(500, { w: 1000, lx: 500 })).toBe(1);
    expect(litAt(700, { w: 1000, lx: 500 })).toBeLessThan(litAt(600, { w: 1000, lx: 500 }));
  });
});
