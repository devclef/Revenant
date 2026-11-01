// Property tests for the wax seal's pattern derivation (05-reveal-ceremony,
// design.md "Envelope and seal"; R8.4, R10.1, Property 4).
//
// Property 4 is determinism: sealPattern(key) must be deeply equal across
// repeated calls for the same key, so the server and the client draw an
// identical seal. These tests also pin the documented ranges (rim 0..7,
// glyph 0..11, rotation a multiple of 15 in 0..345) and that the wax colour is
// one token for every key, so no seal's colour can carry meaning. fast-check is
// already a project dependency, so the property coverage uses it over a wide
// space of arbitrary keys rather than a handful of worked examples.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  GLYPH_COUNT,
  RIM_COUNT,
  ROTATION_STEP_DEG,
  SEAL_WAX_TOKEN,
  type SealPattern,
  sealPattern,
} from "./seal-pattern";

describe("sealPattern — determinism (Property 4, R8.4)", () => {
  it("is deeply equal across repeated calls for the same key", () => {
    const keys = ["", "a", "maya", "MAYA", "persona-key", "  ", "ünîçødé"];
    for (const key of keys) {
      const first = sealPattern(key);
      const second = sealPattern(key);
      const third = sealPattern(key);
      expect(second).toEqual(first);
      expect(third).toEqual(first);
    }
  });

  it("property: same key always yields a deeply-equal pattern", () => {
    fc.assert(
      fc.property(fc.string(), (key) => {
        expect(sealPattern(key)).toEqual(sealPattern(key));
      }),
      { numRuns: 500 },
    );
  });
});

describe("sealPattern — documented ranges (design.md 'Envelope and seal')", () => {
  it("property: rim, glyph and rotation stay within their ranges for any key", () => {
    fc.assert(
      fc.property(fc.string(), (key) => {
        const { rim, glyph, rotationDeg } = sealPattern(key);

        // rim in 0..RIM_COUNT-1 (0..7), an integer.
        expect(Number.isInteger(rim)).toBe(true);
        expect(rim).toBeGreaterThanOrEqual(0);
        expect(rim).toBeLessThanOrEqual(RIM_COUNT - 1);

        // glyph in 0..GLYPH_COUNT-1 (0..11), an integer.
        expect(Number.isInteger(glyph)).toBe(true);
        expect(glyph).toBeGreaterThanOrEqual(0);
        expect(glyph).toBeLessThanOrEqual(GLYPH_COUNT - 1);

        // rotationDeg a multiple of 15 in 0..345.
        expect(Number.isInteger(rotationDeg)).toBe(true);
        expect(rotationDeg % ROTATION_STEP_DEG).toBe(0);
        expect(rotationDeg).toBeGreaterThanOrEqual(0);
        expect(rotationDeg).toBeLessThanOrEqual(360 - ROTATION_STEP_DEG);
      }),
      { numRuns: 500 },
    );
  });

  it("pins the documented range constants", () => {
    expect(RIM_COUNT).toBe(8);
    expect(GLYPH_COUNT).toBe(12);
    expect(ROTATION_STEP_DEG).toBe(15);
  });
});

describe("sealPattern — one wax colour for every key (R10.1)", () => {
  it("property: the wax token is identical for every key", () => {
    fc.assert(
      fc.property(fc.string(), (key) => {
        expect(sealPattern(key).wax).toBe(SEAL_WAX_TOKEN);
      }),
      { numRuns: 500 },
    );
  });

  it("the wax colour does not vary with the key", () => {
    const keys = ["a", "b", "maya", "another-persona", ""];
    const colours = new Set(keys.map((key) => sealPattern(key).wax));
    expect(colours.size).toBe(1);
    expect([...colours][0]).toBe(SEAL_WAX_TOKEN);
  });
});

describe("sealPattern — signature takes only a key (type-level)", () => {
  it("accepts a single string argument and returns a SealPattern", () => {
    // A type-level assertion: sealPattern is exactly (key: string) => SealPattern.
    // If a second parameter were added, or the shape changed, this fails to
    // compile. The runtime body here only exercises that the inferred types hold.
    type Fn = typeof sealPattern;
    type Params = Parameters<Fn>;
    type Return = ReturnType<Fn>;

    const expectType = <T>(value: T): void => {
      void value;
    };
    expectType<[key: string]>([] as unknown as Params);
    expectType<SealPattern>({} as Return);

    const pattern: SealPattern = sealPattern("maya");
    expect(Object.keys(pattern).sort()).toEqual(
      ["glyph", "rim", "rotationDeg", "wax"].sort(),
    );
  });
});
