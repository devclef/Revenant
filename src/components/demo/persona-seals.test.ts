// Feature: 13-the-seal (U9, U10)
//
// The automated floors for the persona seals on /demo. Each persona's seal is
// drawn at 96 px from its own envelope hash (content/personas/personas.json).
// Every pair of persona seals must look different enough to tell apart:
//   - coarseDifference of at least 4 (the Coarse_Layer slots and bands differ);
//   - a coarse pixel difference at 96 px of at least 3.0 percent.
//
// The measured values are printed (console.log) so the PR description can quote
// them. A random sample of 150 pairs gives the distribution.

import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { PERSONAS } from "@/lib/personas";
import {
  sealRelief,
  coarseDifference,
} from "@/components/ui/seal-relief/relief";
import { pixelDifferencePercent } from "@/components/ui/seal-relief/raster.testing";

/** The seal's pixel size on the persona card (U10). */
const SEAL_PX = 96;
/** The floors (U9). */
const MIN_COARSE_DIFFERENCE = 4;
const MIN_PIXEL_PERCENT = 3.0;
/** Random pairs for the distribution printed in the PR. */
const RANDOM_PAIRS = 150;

const personaHashes = PERSONAS.map((p) => p.envelope_hash);

/** The value at quantile q (0 to 1) of a sorted ascending list. */
function quantile(sorted: readonly number[], q: number): number {
  const i = Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)));
  return sorted[i] ?? NaN;
}

function summarise(values: number[]): string {
  const sorted = [...values].sort((a, b) => a - b);
  return (
    `min ${quantile(sorted, 0).toFixed(2)}, ` +
    `p05 ${quantile(sorted, 0.05).toFixed(2)}, ` +
    `median ${quantile(sorted, 0.5).toFixed(2)}, ` +
    `p95 ${quantile(sorted, 0.95).toFixed(2)}, ` +
    `max ${quantile(sorted, 1).toFixed(2)}`
  );
}

describe("persona seals: the automated floors (U9)", () => {
  it("has at least two persona hashes to compare", () => {
    expect(personaHashes.length).toBeGreaterThanOrEqual(2);
  });

  it("gives every pair of persona seals a coarse difference of at least 4", () => {
    for (let i = 0; i < personaHashes.length; i++) {
      for (let j = i + 1; j < personaHashes.length; j++) {
        const a = sealRelief(personaHashes[i]);
        const b = sealRelief(personaHashes[j]);
        const d = coarseDifference(a, b);
        console.log(
          `coarseDifference ${PERSONAS[i]?.key} vs ${PERSONAS[j]?.key}: ${d}`,
        );
        expect(d).toBeGreaterThanOrEqual(MIN_COARSE_DIFFERENCE);
      }
    }
  });

  it(`gives every pair a coarse pixel difference at ${SEAL_PX} px of at least 3.0 percent`, () => {
    for (let i = 0; i < personaHashes.length; i++) {
      for (let j = i + 1; j < personaHashes.length; j++) {
        const a = sealRelief(personaHashes[i]);
        const b = sealRelief(personaHashes[j]);
        const p = pixelDifferencePercent(a, b, SEAL_PX, "coarse");
        console.log(
          `coarse pixel difference at ${SEAL_PX} px ${PERSONAS[i]?.key} vs ${PERSONAS[j]?.key}: ${p.toFixed(2)} %`,
        );
        expect(p).toBeGreaterThanOrEqual(MIN_PIXEL_PERCENT);
      }
    }
  });

  it("prints the full-seal pixel difference for each persona pair (not a floor)", () => {
    for (let i = 0; i < personaHashes.length; i++) {
      for (let j = i + 1; j < personaHashes.length; j++) {
        const p = pixelDifferencePercent(
          sealRelief(personaHashes[i]),
          sealRelief(personaHashes[j]),
          SEAL_PX,
          "full",
        );
        console.log(
          `full-seal pixel difference at ${SEAL_PX} px ${PERSONAS[i]?.key} vs ${PERSONAS[j]?.key}: ${p.toFixed(2)} %`,
        );
        expect(Number.isFinite(p)).toBe(true);
      }
    }
  });

  it(`prints the coarse pixel difference distribution over ${RANDOM_PAIRS} random pairs`, () => {
    const pixel: number[] = [];
    const coarse: number[] = [];
    for (let k = 0; k < RANDOM_PAIRS; k++) {
      const a = sealRelief(randomBytes(32).toString("hex"));
      const b = sealRelief(randomBytes(32).toString("hex"));
      coarse.push(coarseDifference(a, b));
      pixel.push(pixelDifferencePercent(a, b, SEAL_PX, "coarse"));
    }
    console.log(
      `random ${RANDOM_PAIRS} pairs, coarseDifference: ${summarise(coarse)}`,
    );
    console.log(
      `random ${RANDOM_PAIRS} pairs, coarse pixel difference at ${SEAL_PX} px (%): ${summarise(pixel)}`,
    );
    expect(pixel.length).toBe(RANDOM_PAIRS);
  }, 60_000);
});
