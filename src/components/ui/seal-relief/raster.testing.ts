// Feature: 13-the-seal (U9.5)
//
// Test-only rasteriser for the persona seal floors. It is not imported by the
// app. It samples a relief at 4 x 4 points per pixel and returns the coverage
// of each pixel. No browser, no canvas and no dependency: the coverage is plain
// arithmetic, so the result is the same on every machine.
//
// The floor P (design.md "The pair floors") is the coarse pixel difference:
//   P(A, B, D) = 100 * sum over seal pixels of |covA - covB| / N(D)
// where N(D) is the number of pixels whose centre lies inside the seal. The
// coarse layer is notches and rings. The full layer adds the fine ticks and dots.

import type { ReliefMark, SealRelief } from "./relief";
import { RING_WIDTH } from "./relief";

/** Samples per pixel along each axis. */
export const SUPERSAMPLE = 4;

type Layers = "coarse" | "full";
type Pt = readonly [number, number];

/** True when (x, y) is inside a convex quad whose corners run in order. */
function inQuad(
  corners: readonly [Pt, Pt, Pt, Pt],
  x: number,
  y: number,
): boolean {
  let positive = false;
  let negative = false;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = corners[i];
    const [bx, by] = corners[(i + 1) % 4];
    const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (cross > 0) positive = true;
    if (cross < 0) negative = true;
    if (positive && negative) return false;
  }
  return true;
}

function onSample(
  relief: SealRelief,
  layers: Layers,
  x: number,
  y: number,
): boolean {
  if (relief.kind === "blank" || relief.coarse === null) return false;
  for (const notch of relief.coarse.notches) {
    if (inQuad(notch.corners, x, y)) return true;
  }
  const dxc = x - 50;
  const dyc = y - 50;
  const distance = Math.sqrt(dxc * dxc + dyc * dyc);
  for (const ring of relief.coarse.rings) {
    if (Math.abs(distance - ring.radius) <= RING_WIDTH / 2) return true;
  }
  if (layers === "coarse") return false;
  for (const mark of relief.marks as readonly ReliefMark[]) {
    if (mark.kind === "tick") {
      if (inQuad(mark.corners, x, y)) return true;
    } else {
      const mx = x - mark.cx;
      const my = y - mark.cy;
      if (Math.sqrt(mx * mx + my * my) <= mark.r) return true;
    }
  }
  return false;
}

/** Seal pixels for a seal drawn at `diameter` CSS pixels. */
export type RasterResult = {
  diameter: number;
  /** 1 for a pixel whose centre is inside the seal, 0 otherwise. */
  inside: Uint8Array;
  /** Coverage 0 to 1 per pixel (0 outside the seal). */
  coverage: Float64Array;
  /** Count of inside pixels, N(D). */
  count: number;
};

/** Rasterises a relief at `diameter` pixels into a `diameter` x `diameter` grid. */
export function rasterise(
  relief: SealRelief,
  diameter: number,
  layers: Layers,
): RasterResult {
  const inside = new Uint8Array(diameter * diameter);
  const coverage = new Float64Array(diameter * diameter);
  const radius = diameter / 2;
  const samples = SUPERSAMPLE * SUPERSAMPLE;
  let count = 0;

  for (let j = 0; j < diameter; j++) {
    for (let i = 0; i < diameter; i++) {
      const cx = i + 0.5 - radius;
      const cy = j + 0.5 - radius;
      if (cx * cx + cy * cy > radius * radius) continue;
      const index = j * diameter + i;
      inside[index] = 1;
      count++;

      let on = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const px = i + (sx + 0.5) / SUPERSAMPLE;
          const py = j + (sy + 0.5) / SUPERSAMPLE;
          const ux = (px * 100) / diameter;
          const uy = (py * 100) / diameter;
          if (onSample(relief, layers, ux, uy)) on++;
        }
      }
      coverage[index] = on / samples;
    }
  }
  return { diameter, inside, coverage, count };
}

/**
 * P(A, B, D): the share of seal pixels whose coverage differs, in percent.
 * Both reliefs are rasterised at the same diameter.
 */
export function pixelDifferencePercent(
  a: SealRelief,
  b: SealRelief,
  diameter: number,
  layers: Layers,
): number {
  const ra = rasterise(a, diameter, layers);
  const rb = rasterise(b, diameter, layers);
  let sum = 0;
  for (let k = 0; k < ra.inside.length; k++) {
    if (ra.inside[k] === 1) sum += Math.abs(ra.coverage[k] - rb.coverage[k]);
  }
  return (100 * sum) / ra.count;
}
