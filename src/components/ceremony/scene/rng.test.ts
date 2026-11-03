// Feature: 07-judge-journey
//
// mulberry32 determinism (design.md "Determinism", R6.5, R6.12).

import { describe, expect, it } from "vitest";

import { mulberry32 } from "./rng";

function take(seed: number, n: number): number[] {
  const next = mulberry32(seed);
  return Array.from({ length: n }, () => next());
}

describe("mulberry32", () => {
  it("gives the same sequence for the same seed", () => {
    expect(take(0x07a11e, 50)).toEqual(take(0x07a11e, 50));
  });

  it("gives different sequences for different seeds", () => {
    expect(take(0x07a11e, 10)).not.toEqual(take(0x077149, 10));
  });

  it("returns floats in [0, 1)", () => {
    for (const v of take(12345, 1000)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
