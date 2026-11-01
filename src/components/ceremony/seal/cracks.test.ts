// Feature: 05-reveal-ceremony
//
// Unit and property tests for the fixed crack geometry (cracks.ts). The default
// Vitest environment is node, so these run DOM-free: cracks.ts is pure, owns no
// DOM and reads no clock, so its drawing is exercised with explicit progress
// values alone.
//
// Covers the fixed count and draw order, the reveal threshold (path i appears
// at progress ≥ i / 9), and Property 6: cracks don't depend on where the seal
// was pressed or whose it is.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  CRACK_COUNT,
  CRACK_PATHS,
  SEAL_CENTER,
  TOTAL_LENGTH,
  cracksForProgress,
  type CrackDraw,
} from "./cracks";

describe("fixed crack geometry", () => {
  it("has exactly nine crack paths", () => {
    expect(CRACK_COUNT).toBe(9);
    expect(CRACK_PATHS).toHaveLength(9);
  });

  it("every path starts at the seal's centre", () => {
    for (const d of CRACK_PATHS) {
      expect(d).toMatch(/^M\s*50\s+50\b/);
    }
    expect(SEAL_CENTER).toBe(50);
  });

  it("cracksForProgress returns all nine in fixed draw order", () => {
    const cracks = cracksForProgress(0.5);
    expect(cracks).toHaveLength(9);
    cracks.forEach((c, i) => {
      expect(c.index).toBe(i);
      expect(c.d).toBe(CRACK_PATHS[i]);
    });
  });

  it("nothing is drawn at progress 0", () => {
    for (const c of cracksForProgress(0)) {
      expect(c.drawn).toBe(0);
      expect(c.dashoffset).toBe(TOTAL_LENGTH);
    }
  });

  it("everything is fully drawn at progress 1", () => {
    for (const c of cracksForProgress(1)) {
      expect(c.drawn).toBe(1);
      expect(c.dashoffset).toBe(0);
    }
  });

  it("path i begins drawing only once progress reaches i / 9", () => {
    for (let i = 0; i < CRACK_COUNT; i += 1) {
      const start = i / CRACK_COUNT;

      // Just before its threshold, path i is still hidden.
      if (i > 0) {
        const before = cracksForProgress(start - 1e-6);
        expect(before[i].drawn).toBe(0);
        expect(before[i].dashoffset).toBe(TOTAL_LENGTH);
      }

      // At its threshold it has only just begun (drawn ≈ 0).
      const at = cracksForProgress(start);
      expect(at[i].drawn).toBeCloseTo(0, 10);

      // Past its threshold it has started to draw.
      const after = cracksForProgress(start + 0.5 / CRACK_COUNT);
      expect(after[i].drawn).toBeGreaterThan(0);
    }
  });

  it("dashoffset tracks the drawn fraction of each path", () => {
    for (const c of cracksForProgress(0.6)) {
      expect(c.dashoffset).toBeCloseTo(TOTAL_LENGTH * (1 - c.drawn), 10);
    }
  });

  it("clamps progress outside 0..1", () => {
    expect(cracksForProgress(-5)).toEqual(cracksForProgress(0));
    expect(cracksForProgress(5)).toEqual(cracksForProgress(1));
  });
});

// Feature: 05-reveal-ceremony, Property 6: Cracks don't depend on where the
// seal was pressed or whose it is.
//
// `cracksForProgress` takes only a progress value: neither the contact point
// nor the persona key is a parameter, so the drawing cannot read either. The
// property makes that concrete — for any contact point inside the seal, any
// persona key and any progress p, the set of drawn crack paths and their dash
// offsets equal those for the centre point and the default key at the same p.
// This is a signature-level guarantee (the function's only input is p) backed
// by value equality.
describe("Property 6: cracks don't depend on contact point or persona key", () => {
  const DISC_RADIUS = 46; // WaxSeal's disc radius in the 100×100 user space.

  // A contact point anywhere inside the seal's disc. Never an input to drawing.
  const contactPoint = fc
    .record({
      dx: fc.double({ min: -DISC_RADIUS, max: DISC_RADIUS, noNaN: true }),
      dy: fc.double({ min: -DISC_RADIUS, max: DISC_RADIUS, noNaN: true }),
    })
    .filter(({ dx, dy }) => dx * dx + dy * dy <= DISC_RADIUS * DISC_RADIUS)
    .map(({ dx, dy }) => ({ x: SEAL_CENTER + dx, y: SEAL_CENTER + dy }));

  // Any persona key. Never an input to drawing either.
  const personaKey = fc.oneof(
    fc.constantFrom("maya", "jonas", "elin", "default"),
    fc.string(),
  );

  const progress = fc.double({ min: 0, max: 1, noNaN: true });

  // Drawing with a contact point and key must be impossible to even express:
  // cracksForProgress has arity 1. We prove equality against the reference call.
  const draw = (_point: { x: number; y: number }, _key: string, p: number): CrackDraw[] =>
    cracksForProgress(p);

  const CENTRE = { x: SEAL_CENTER, y: SEAL_CENTER };
  const DEFAULT_KEY = "default";

  it("the drawn paths and dash offsets equal the centre/default result at the same p", () => {
    fc.assert(
      fc.property(contactPoint, personaKey, progress, (point, key, p) => {
        const reference = draw(CENTRE, DEFAULT_KEY, p);
        const withInputs = draw(point, key, p);

        // Identical draw order, path data, drawn fraction and dash offset.
        expect(withInputs).toEqual(reference);
        withInputs.forEach((c, i) => {
          expect(c.index).toBe(reference[i].index);
          expect(c.d).toBe(reference[i].d);
          expect(c.drawn).toBe(reference[i].drawn);
          expect(c.dashoffset).toBe(reference[i].dashoffset);
        });
      }),
      { numRuns: 100 },
    );
  });
});
