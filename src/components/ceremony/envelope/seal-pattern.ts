// Feature: 05-reveal-ceremony
//
// The wax seal's decorative pattern, derived only from a persona key. Pure and
// deterministic: the same key always gives the same pattern, server and client
// alike (R8.4, Property 4). The wax colour is one token for every key, so no
// seal's colour carries meaning. Nothing here reads data, metrics, units or
// figures, and there is no randomness beyond the seeded generator.
//
// This module must contain no import statement.

/** Number of distinct rim styles a seal can draw (indices 0..RIM_COUNT-1). */
export const RIM_COUNT = 8;

/** Number of distinct centre glyphs a seal can draw (indices 0..GLYPH_COUNT-1). */
export const GLYPH_COUNT = 12;

/** The seal's rotation is a whole number of these degree steps (0, 15, ..., 345). */
export const ROTATION_STEP_DEG = 15;

/** The number of distinct rotations: 360 / ROTATION_STEP_DEG = 24 (0..345). */
export const ROTATION_COUNT = 360 / ROTATION_STEP_DEG;

/** The single wax colour token used for every seal, regardless of key (R10.1). */
export const SEAL_WAX_TOKEN = "--seal-wax";

/** The decorative pattern of one wax seal. */
export type SealPattern = {
  /** Which rim style to draw, 0..RIM_COUNT-1. */
  rim: number;
  /** Which centre glyph to draw, 0..GLYPH_COUNT-1. */
  glyph: number;
  /** Rotation of the whole seal in degrees, one of 0, 15, ..., 345. */
  rotationDeg: number;
  /** The wax colour token name. The same for every key. */
  wax: string;
};

/**
 * FNV-1a 32-bit hash of a string. Deterministic and endian-free. Operates on
 * UTF-16 code units, which is enough for seeding a decorative pattern.
 */
function fnv1a32(key: string): number {
  // FNV offset basis and prime for the 32-bit variant.
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    // hash *= 16777619, kept in 32 bits via the Math.imul shift-sum.
    hash = Math.imul(hash, 0x01000193);
  }
  // Coerce to an unsigned 32-bit integer.
  return hash >>> 0;
}

/**
 * mulberry32: a small, fast, fully deterministic 32-bit PRNG. Given a seed it
 * returns a function producing numbers in [0, 1). Identical across engines.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derive a wax seal's decorative pattern from a persona key.
 *
 * Pure and deterministic: hashes the key with FNV-1a 32-bit, seeds mulberry32
 * with that hash, then draws the rim style, centre glyph and rotation from the
 * seeded generator in a fixed order. The wax colour is always the same token.
 *
 * Takes only the key. Produces identical output on the server and the client.
 */
export function sealPattern(key: string): SealPattern {
  const next = mulberry32(fnv1a32(key));
  const rim = Math.floor(next() * RIM_COUNT);
  const glyph = Math.floor(next() * GLYPH_COUNT);
  const rotationDeg = Math.floor(next() * ROTATION_COUNT) * ROTATION_STEP_DEG;
  return { rim, glyph, rotationDeg, wax: SEAL_WAX_TOKEN };
}
