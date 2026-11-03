// Feature: 07-judge-journey
//
// Seeded pseudo-random number generator for the Soil_Canvas (design.md
// "Soil_Canvas"). The same seed always gives the same sequence, so the soil
// draws the same clumps at the same size. Nothing here reads the clock or
// Math.random.

/**
 * mulberry32: returns a function that yields floats in [0, 1) from a 32-bit
 * seed. Each call advances the internal state by one step.
 */
export function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
