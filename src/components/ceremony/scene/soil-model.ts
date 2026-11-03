// Feature: 07-judge-journey
//
// The pure soil model for the Soil_Canvas (design.md "SceneBackdrop and the
// Soil", steps 1 to 7). It computes what to draw from the window size, the soil
// top and the light x, using only the seeded RNG. It draws nothing, reads no
// clock and never calls Math.random, so the same geometry always gives the same
// model. soil-canvas.ts draws the output.
//
// Colours are not here. The model gives shades and strengths in [0, 1]; the
// canvas mixes them with the tokens it reads once.

import {
  CLOD_COUNT,
  CLOD_LIFE_MS,
  CLOD_SEED,
  DUST_MAX_PARTICLES,
  DUST_SEED,
  DUST_SPREAD,
  EDGE_BAND_PX,
  SOIL_SEED,
} from "../constants";
import { mulberry32 } from "./rng";

/** Geometry the model needs, all in canvas CSS pixels. */
export interface SoilGeometry {
  /** Canvas width. */
  w: number;
  /** Soil strip height. */
  band: number;
  /** Soil top (`y0`). */
  y0: number;
  /** Light x. */
  lx: number;
}

export interface Pebble {
  x: number;
  y: number;
  r: number;
  /** Brightness and alpha factor, lit(x) × depth, in [0, 1]. */
  strength: number;
}

export interface Clump {
  x: number;
  rx: number;
  ry: number;
  cy: number;
  /** Dark soil shade in [0, 1]. Back row only. */
  shade?: number;
  /** Lit purple factor k in [0, 1]. Front row only. */
  k?: number;
  /** Front row only: true for the 18 % big clumps. */
  big?: boolean;
}

export interface DustParticle {
  /** Start x in canvas pixels. */
  x: number;
  /** Start height as a share of the way from the dust ceiling (0) to the soil top (1). */
  t: number;
  /** Rise speed, px/s. */
  speed: number;
  /** Sway phase in radians. The sway amplitude is DUST_SWAY_PX_S. */
  swayPhase: number;
  alpha: number;
  r: number;
}

export interface Clod {
  x: number;
  y: number;
  /** Horizontal speed, px/s. */
  vx: number;
  /** Vertical speed, px/s. Negative is up. */
  vy: number;
  lifeMs: number;
}

export interface SoilModel {
  pebbles: Pebble[];
  backClumps: Clump[];
  frontClumps: Clump[];
  dust: DustParticle[];
  clods: Clod[];
}

/** Dust sway amplitude, px/s (design step 6). */
export const DUST_SWAY_PX_S = 6;
/** Bounce factors for a clod hitting the soil top, first then second bounce (design step 7). */
export const CLOD_BOUNCE_FACTORS = [-0.2, 0.5] as const;

/** Light falloff: exp(-((x - lx) / (0.28 w))^2), in [0, 1] (design step 1). */
export function litAt(x: number, geometry: Pick<SoilGeometry, "w" | "lx">): number {
  const d = (x - geometry.lx) / (0.28 * geometry.w);
  return Math.exp(-(d * d));
}

/**
 * Keeps a shape's top no higher than EDGE_BAND_PX above the soil top, so the
 * soil never rises past the 14 px band (R6.3).
 */
function clampTop(y0: number, top: number): number {
  return Math.max(top, y0 - EDGE_BAND_PX);
}

/** Centre y that keeps the shape's top within the edge band. */
function clampCentre(y0: number, cy: number, ry: number): number {
  return clampTop(y0, cy - ry) + ry;
}

function pebbles(g: SoilGeometry, rand: () => number): Pebble[] {
  const count = Math.round(0.9 * g.w);
  const out: Pebble[] = [];
  for (let i = 0; i < count; i += 1) {
    const x = rand() * g.w;
    const y = g.y0 + 10 + Math.pow(rand(), 1.6) * 0.7 * g.band;
    const r = 0.6 + rand() * 2.4;
    const depth = 1 - (y - g.y0) / g.band;
    out.push({ x, y, r, strength: litAt(x, g) * depth });
  }
  return out;
}

function backClumps(g: SoilGeometry, rand: () => number): Clump[] {
  const out: Clump[] = [];
  for (let x = -12; x <= g.w + 12; x += 9 + rand() * 16) {
    const rx = 10 + rand() * 18;
    const ry = 5 + rand() * 6;
    const cy = g.y0 + 8 + rand() * 6;
    const shade = rand();
    out.push({ x, rx, ry, cy: clampCentre(g.y0, cy, ry), shade });
  }
  return out;
}

function frontClumps(g: SoilGeometry, rand: () => number): Clump[] {
  const out: Clump[] = [];
  for (let x = 0; x <= g.w; x += 4 + rand() * 12) {
    const big = rand() < 0.18;
    const rx = big ? 9 + rand() * 10 : 2.5 + rand() * 7;
    const ry = big ? 5 + rand() * 5 : 2 + rand() * 4;
    const cy = g.y0 + 2 + rand() * (EDGE_BAND_PX - 4);
    const k = litAt(x, g) * (0.55 + 0.45 * rand());
    out.push({ x, rx, ry, cy: clampCentre(g.y0, cy, ry), k, big });
  }
  return out;
}

function dust(g: SoilGeometry, rand: () => number): DustParticle[] {
  const out: DustParticle[] = [];
  for (let i = 0; i < DUST_MAX_PARTICLES; i += 1) {
    out.push({
      x: g.lx + (rand() * 2 - 1) * DUST_SPREAD * g.w,
      t: rand(),
      speed: 4 + rand() * 10,
      swayPhase: rand() * 2 * Math.PI,
      alpha: 0.25 + rand() * 0.45,
      r: 0.7 + rand() * 1.7,
    });
  }
  return out;
}

function clods(g: SoilGeometry, rand: () => number): Clod[] {
  // The pit is the DUST_SPREAD band either side of the light. Clods start in
  // its middle 70 %.
  const half = 0.7 * DUST_SPREAD * g.w;
  const out: Clod[] = [];
  for (let i = 0; i < CLOD_COUNT; i += 1) {
    out.push({
      x: g.lx + (rand() * 2 - 1) * half,
      y: g.y0,
      vx: (rand() * 2 - 1) * 60,
      vy: -(160 + rand() * 260),
      lifeMs: CLOD_LIFE_MS,
    });
  }
  return out;
}

/**
 * Computes the soil for one geometry. The base stream (SOIL_SEED) feeds the
 * pebbles, then the back row, then the front row, in that order. The dust and
 * clod parts each have their own stream (DUST_SEED, CLOD_SEED).
 */
export function buildSoilModel(g: SoilGeometry): SoilModel {
  const base = mulberry32(SOIL_SEED);
  const peb = pebbles(g, base);
  const back = backClumps(g, base);
  const front = frontClumps(g, base);
  return {
    pebbles: peb,
    backClumps: back,
    frontClumps: front,
    dust: dust(g, mulberry32(DUST_SEED)),
    clods: clods(g, mulberry32(CLOD_SEED)),
  };
}
