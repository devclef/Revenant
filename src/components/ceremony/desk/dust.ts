// Feature: 05-reveal-ceremony
//
// Canvas dust for the desk (design.md "Desk", R13.3, R11.3, R13.6). A small
// layer of soft dots drifts in the candle's cone. It is decoration only.
//
//  - At most DUST_MAX_PARTICLES dots (constants.ts). A larger request is capped.
//  - At most DUST_MAX_FPS frames a second. A frame that arrives too soon is
//    skipped, so the canvas never repaints faster than the cap.
//  - Paused while the document is hidden (`visibilityState === "hidden"`), so a
//    background tab does no work. It resumes when the tab is shown again.
//
// This module is loaded by a dynamic import() from decor-loader.ts, only in
// `full` motion. It is the one ceremony module allowed to call Math.random
// (ceremony/source-scan.test.ts, RANDOM_ALLOW_LIST). The randomness seeds the
// particles once, in `startDust`, which runs in an effect and never during render.
//
// Everything that touches the browser goes through `DustEnv`, so the pause, the
// frame cap and the particle cap are testable in Node without a DOM.

import { DUST_MAX_FPS, DUST_MAX_PARTICLES } from "../constants";

/** One dust dot. Positions are fractions of the canvas, so resizing needs no re-seed. */
export type DustParticle = {
  /** Across the canvas, 0 (left) to 1 (right). */
  readonly x: number;
  /** Down the canvas, 0 (top) to 1 (bottom). */
  readonly y: number;
  /** Radius in canvas pixels. */
  readonly radius: number;
  /** Opacity, 0 to 1. */
  readonly alpha: number;
  /** How far the dot falls each drawn frame, as a fraction of the canvas height. */
  readonly drift: number;
};

/** The desk ink (`--desk-ink` in ceremony.module.css), as an RGB triple. */
const DUST_RGB = "241, 230, 207";

const RADIUS_MIN = 0.6;
const RADIUS_MAX = 2.2;
const ALPHA_MIN = 0.15;
const ALPHA_MAX = 0.5;
const DRIFT_MIN = 0.0004;
const DRIFT_MAX = 0.0012;

/** The frame gap a drawn frame needs, in ms: 1000 / DUST_MAX_FPS. */
export const FRAME_INTERVAL_MS = 1000 / DUST_MAX_FPS;

/** Tolerance so a 60 Hz display (16.7 ms frames) still draws every second frame. */
const FRAME_SLACK_MS = 2;

/**
 * The particle count actually used for a request. Non-finite and non-positive
 * requests give 0; anything above DUST_MAX_PARTICLES is capped to it.
 */
export function clampParticleCount(requested: number): number {
  if (!Number.isFinite(requested) || requested <= 0) {
    return 0;
  }
  return Math.min(Math.floor(requested), DUST_MAX_PARTICLES);
}

/**
 * Whether a frame at `nowMs` should be drawn, given the last drawn frame. A
 * `null` last frame (nothing drawn yet, or resumed after a pause) always draws.
 * Otherwise the gap must reach FRAME_INTERVAL_MS, less the slack.
 */
export function shouldDrawFrame(lastDrawMs: number | null, nowMs: number): boolean {
  if (lastDrawMs === null) {
    return true;
  }
  return nowMs - lastDrawMs >= FRAME_INTERVAL_MS - FRAME_SLACK_MS;
}

const lerp = (lo: number, hi: number, t: number): number => lo + (hi - lo) * t;

/**
 * Seed the dust for one desk. The cone is narrow at the top and widens as the
 * dust falls toward the candle's pool. `random` returns values in [0, 1).
 */
export function createParticles(
  requested: number,
  random: () => number = Math.random,
): DustParticle[] {
  const count = clampParticleCount(requested);
  const particles: DustParticle[] = [];
  for (let i = 0; i < count; i += 1) {
    const y = random();
    const spread = 0.25 + 0.5 * y;
    const x = 0.5 + (random() - 0.5) * spread;
    particles.push({
      x,
      y,
      radius: lerp(RADIUS_MIN, RADIUS_MAX, random()),
      alpha: lerp(ALPHA_MIN, ALPHA_MAX, random()),
      drift: lerp(DRIFT_MIN, DRIFT_MAX, random()),
    });
  }
  return particles;
}

/** One drawn frame of fall. The dot wraps back to the top when it leaves the bottom. */
export function stepParticle(p: DustParticle): DustParticle {
  return { ...p, y: (p.y + p.drift) % 1 };
}

/** The browser facts the dust loop depends on, injected so tests can drive them. */
export type DustEnv = {
  /** A random number in [0, 1). */
  readonly random: () => number;
  /** Schedule a frame callback. Returns an id for `cancelFrame`. */
  readonly requestFrame: (cb: (now: number) => void) => number;
  readonly cancelFrame: (id: number) => void;
  /** Whether the document is hidden right now. */
  readonly isHidden: () => boolean;
  /** Listen for visibility changes. Returns the function that stops listening. */
  readonly listenVisibility: (onChange: () => void) => () => void;
};

/** The real browser environment. Only called from an effect, after mount. */
export function browserDustEnv(): DustEnv {
  return {
    random: () => Math.random(),
    requestFrame: (cb) => window.requestAnimationFrame(cb),
    cancelFrame: (id) => window.cancelAnimationFrame(id),
    isHidden: () => document.visibilityState === "hidden",
    listenVisibility: (onChange) => {
      document.addEventListener("visibilitychange", onChange);
      return () => {
        document.removeEventListener("visibilitychange", onChange);
      };
    },
  };
}

/** Paint one frame of dust. Clears the canvas first, so nothing is left behind. */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  particles: readonly DustParticle[],
): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const p of particles) {
    ctx.beginPath();
    ctx.fillStyle = `rgba(${DUST_RGB}, ${p.alpha})`;
    ctx.arc(p.x * canvas.width, p.y * canvas.height, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Start the dust on one canvas. Returns the function that stops it: it cancels
 * the pending frame and stops listening for visibility changes. With no 2D
 * context (an old browser) it does nothing and returns a no-op stop.
 *
 * `requested` is capped to DUST_MAX_PARTICLES. The loop draws at most
 * DUST_MAX_FPS frames a second, and pauses while the document is hidden.
 */
export function startDust(
  canvas: HTMLCanvasElement,
  requested: number = DUST_MAX_PARTICLES,
  env: DustEnv = browserDustEnv(),
): () => void {
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    return () => undefined;
  }

  // The backing store follows the element's laid-out size.
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  let particles = createParticles(requested, env.random);
  let frameId: number | null = null;
  let lastDraw: number | null = null;
  let stopped = false;

  const schedule = (): void => {
    if (stopped || frameId !== null || env.isHidden()) {
      return;
    }
    frameId = env.requestFrame(onFrame);
  };

  const onFrame = (now: number): void => {
    frameId = null;
    if (stopped || env.isHidden()) {
      return;
    }
    if (!shouldDrawFrame(lastDraw, now)) {
      schedule();
      return;
    }
    lastDraw = now;
    drawFrame(ctx, canvas, particles);
    particles = particles.map(stepParticle);
    schedule();
  };

  const onVisibilityChange = (): void => {
    if (env.isHidden()) {
      // Pause: cancel the pending frame. Nothing is scheduled while hidden.
      if (frameId !== null) {
        env.cancelFrame(frameId);
        frameId = null;
      }
      return;
    }
    // Resume: the next frame draws at once rather than waiting out a stale gap.
    lastDraw = null;
    schedule();
  };

  const stopListening = env.listenVisibility(onVisibilityChange);
  schedule();

  return () => {
    stopped = true;
    if (frameId !== null) {
      env.cancelFrame(frameId);
      frameId = null;
    }
    stopListening();
  };
}
