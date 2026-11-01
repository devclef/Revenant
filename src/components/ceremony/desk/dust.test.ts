// Feature: 05-reveal-ceremony
//
// Tests for dust.ts (design.md "Desk", R13.3, R11.3): the particle cap, the
// frame-rate cap and the pause while the document is hidden. Everything runs
// against an injected DustEnv and a fake canvas, so no DOM is needed. The
// clock is driven by hand.

import { describe, expect, it } from "vitest";

import { DUST_MAX_FPS, DUST_MAX_PARTICLES } from "../constants";
import {
  clampParticleCount,
  createParticles,
  FRAME_INTERVAL_MS,
  shouldDrawFrame,
  startDust,
  stepParticle,
  type DustEnv,
} from "./dust";

/** A canvas stand-in that counts clears (one per drawn frame) and arcs (one per dot). */
function fakeCanvas() {
  const counts = { clears: 0, arcs: 0 };
  const ctx = {
    fillStyle: "",
    clearRect: () => {
      counts.clears += 1;
    },
    beginPath: () => undefined,
    arc: () => {
      counts.arcs += 1;
    },
    fill: () => undefined,
  };
  const canvas = {
    width: 0,
    height: 0,
    clientWidth: 300,
    clientHeight: 200,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
  return { canvas, counts };
}

/** A hand-driven environment: frames run only when a test calls `runFrame`. */
function fakeEnv() {
  let hidden = false;
  let nextId = 1;
  const pending = new Map<number, (now: number) => void>();
  const listeners = new Set<() => void>();
  const env: DustEnv = {
    random: () => 0.5,
    requestFrame: (cb) => {
      const id = nextId;
      nextId += 1;
      pending.set(id, cb);
      return id;
    },
    cancelFrame: (id) => {
      pending.delete(id);
    },
    isHidden: () => hidden,
    listenVisibility: (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
  };
  /** Run the frames pending now. A frame scheduled during the run waits for the next call. */
  const runFrame = (now: number): void => {
    for (const id of [...pending.keys()]) {
      const cb = pending.get(id);
      pending.delete(id);
      cb?.(now);
    }
  };
  const setHidden = (value: boolean): void => {
    hidden = value;
    for (const listener of [...listeners]) listener();
  };
  return { env, pending, listeners, runFrame, setHidden };
}

describe("particle cap (DUST_MAX_PARTICLES)", () => {
  it("caps a large request at DUST_MAX_PARTICLES", () => {
    expect(clampParticleCount(1000)).toBe(DUST_MAX_PARTICLES);
    expect(createParticles(1000)).toHaveLength(DUST_MAX_PARTICLES);
  });

  it("keeps a small request as it is, rounding down", () => {
    expect(clampParticleCount(10)).toBe(10);
    expect(clampParticleCount(2.9)).toBe(2);
  });

  it("gives zero for a non-positive or non-finite request", () => {
    expect(clampParticleCount(0)).toBe(0);
    expect(clampParticleCount(-5)).toBe(0);
    expect(clampParticleCount(Number.NaN)).toBe(0);
    expect(clampParticleCount(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("draws no more dots than the cap on the canvas", () => {
    const { canvas, counts } = fakeCanvas();
    const { env, runFrame } = fakeEnv();
    startDust(canvas, 1000, env);
    runFrame(0);
    expect(counts.arcs).toBe(DUST_MAX_PARTICLES);
  });

  it("keeps every seeded particle inside the canvas fractions", () => {
    const particles = createParticles(DUST_MAX_PARTICLES, () => 0.999);
    for (const p of particles) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
  });
});

describe("frame-rate cap (DUST_MAX_FPS)", () => {
  it("draws the first frame at once", () => {
    expect(shouldDrawFrame(null, 0)).toBe(true);
  });

  it("skips a frame that arrives 10 ms after the last draw", () => {
    expect(shouldDrawFrame(0, 10)).toBe(false);
  });

  it("draws a frame 34 ms after the last draw", () => {
    expect(shouldDrawFrame(0, 34)).toBe(true);
  });

  it("never draws faster than DUST_MAX_FPS over a simulated second at 60 Hz", () => {
    const { canvas, counts } = fakeCanvas();
    const { env, runFrame } = fakeEnv();
    startDust(canvas, DUST_MAX_PARTICLES, env);
    const drawTimes: number[] = [];
    let lastClears = counts.clears;
    for (let t = 0; t <= 1000; t += 1000 / 60) {
      runFrame(t);
      if (counts.clears !== lastClears) {
        drawTimes.push(t);
        lastClears = counts.clears;
      }
    }
    expect(drawTimes.length).toBeGreaterThan(0);
    expect(drawTimes.length).toBeLessThanOrEqual(DUST_MAX_FPS + 1);
    for (let i = 1; i < drawTimes.length; i += 1) {
      expect(drawTimes[i] - drawTimes[i - 1]).toBeGreaterThanOrEqual(
        FRAME_INTERVAL_MS - 2,
      );
    }
  });

  it("still reaches the cap on a 120 Hz display", () => {
    const { canvas, counts } = fakeCanvas();
    const { env, runFrame } = fakeEnv();
    startDust(canvas, DUST_MAX_PARTICLES, env);
    for (let t = 0; t <= 1000; t += 1000 / 120) {
      runFrame(t);
    }
    expect(counts.clears).toBeLessThanOrEqual(DUST_MAX_FPS + 1);
    expect(counts.clears).toBeGreaterThanOrEqual(DUST_MAX_FPS - 1);
  });

  it("moves a dot down and wraps it back into the canvas", () => {
    const p = createParticles(1, () => 0.5)[0];
    const next = stepParticle({ ...p, y: 0.999, drift: 0.01 });
    expect(next.y).toBeCloseTo(0.009, 10);
  });
});

describe("pause while the document is hidden", () => {
  it("cancels the pending frame and draws nothing while hidden", () => {
    const { canvas, counts } = fakeCanvas();
    const { env, pending, runFrame, setHidden } = fakeEnv();
    startDust(canvas, DUST_MAX_PARTICLES, env);
    runFrame(0);
    const drawnBefore = counts.clears;

    setHidden(true);
    expect(pending.size).toBe(0);

    for (let t = 100; t <= 1000; t += 100) runFrame(t);
    expect(counts.clears).toBe(drawnBefore);
  });

  it("resumes drawing once the document is visible again", () => {
    const { canvas, counts } = fakeCanvas();
    const { env, pending, runFrame, setHidden } = fakeEnv();
    startDust(canvas, DUST_MAX_PARTICLES, env);
    runFrame(0);
    setHidden(true);
    setHidden(false);
    expect(pending.size).toBe(1);
    const before = counts.clears;
    runFrame(5000);
    expect(counts.clears).toBe(before + 1);
  });

  it("does not schedule a frame when it starts while hidden", () => {
    const { canvas, counts } = fakeCanvas();
    const { env, pending, runFrame } = fakeEnv();
    startDust(canvas, DUST_MAX_PARTICLES, { ...env, isHidden: () => true });
    expect(pending.size).toBe(0);
    runFrame(0);
    expect(counts.clears).toBe(0);
  });

  it("stops everything when the returned stop function runs", () => {
    const { canvas, counts } = fakeCanvas();
    const { env, pending, listeners, runFrame } = fakeEnv();
    const stop = startDust(canvas, DUST_MAX_PARTICLES, env);
    expect(listeners.size).toBe(1);
    stop();
    expect(pending.size).toBe(0);
    expect(listeners.size).toBe(0);
    runFrame(0);
    expect(counts.clears).toBe(0);
  });
});
