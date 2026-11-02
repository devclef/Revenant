// Feature: 05-reveal-ceremony, Task 10 (R14.2-R14.5, Property 24)
//
// Tests for sound.ts. The repo runs in a node environment with no DOM, so the
// Web Audio API is replaced by a recording fake for each test. `sound.ts` is
// re-imported after `vi.resetModules()` so its module-level AudioContext starts
// empty every time.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const soundSource = readFileSync(resolve(here, "sound.ts"), "utf8");

type SoundModule = typeof import("./sound");

type FakeCounts = {
  contexts: number;
  gains: number;
  buffers: number;
  sources: number;
  filters: number;
  oscillators: number;
  resumes: number;
};

/** A recording AudioContext. Every node the module creates is counted. */
function installFakeAudioContext(state: "running" | "suspended" = "running") {
  const counts: FakeCounts = {
    contexts: 0,
    gains: 0,
    buffers: 0,
    sources: 0,
    filters: 0,
    oscillators: 0,
    resumes: 0,
  };
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  });

  class FakeAudioContext {
    state = state;
    sampleRate = 8000;
    currentTime = 2;
    destination = {};

    constructor() {
      counts.contexts++;
    }

    resume() {
      counts.resumes++;
      return Promise.resolve();
    }

    createGain() {
      counts.gains++;
      return { gain: param(), connect: vi.fn() };
    }

    createBuffer(_channels: number, length: number) {
      counts.buffers++;
      const data = new Float32Array(length);
      return { getChannelData: () => data };
    }

    createBufferSource() {
      counts.sources++;
      return { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
    }

    createBiquadFilter() {
      counts.filters++;
      return {
        type: "",
        frequency: { value: 0 },
        Q: { value: 0 },
        connect: vi.fn(),
      };
    }

    createOscillator() {
      counts.oscillators++;
      return {
        type: "",
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
    }
  }

  vi.stubGlobal("AudioContext", FakeAudioContext);
  return counts;
}

async function loadSound(): Promise<SoundModule> {
  vi.resetModules();
  return import("./sound");
}

/** Strip comments so the scans look at code and string literals only. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
}

describe("sound plan depends only on the cue (equal plans, Property 24)", () => {
  it("a rise and a fall, at any distance, get the same cue and the same plan", async () => {
    const sound = await loadSound();
    const directions = fc.constantFrom<"rise" | "fall">("rise", "fall");
    const distances = fc.double({ min: 0, max: 1, noNaN: true });

    fc.assert(
      fc.property(
        directions,
        distances,
        directions,
        distances,
        (dirA, distA, dirB, distB) => {
          const cueA = sound.movementCue(dirA, distA);
          const cueB = sound.movementCue(dirB, distB);
          expect(cueA).toBe(cueB);
          expect(sound.soundPlan(cueA)).toEqual(sound.soundPlan(cueB));
        },
      ),
    );
  });

  it("the figure-move plan is one fixed plan, whatever the movement", async () => {
    const sound = await loadSound();
    const reference = sound.soundPlan(sound.movementCue("rise", 0));
    fc.assert(
      fc.property(
        fc.constantFrom<"rise" | "fall">("rise", "fall"),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (direction, distance) => {
          expect(sound.soundPlan(sound.movementCue(direction, distance))).toBe(
            reference,
          );
        },
      ),
    );
  });

  it("every event has a non-negative start and a positive length", async () => {
    const sound = await loadSound();
    for (const cue of ["seal-break", "figure-move"] as const) {
      const plan = sound.soundPlan(cue);
      expect(plan.length).toBeGreaterThan(0);
      for (const event of plan) {
        expect(event.at).toBeGreaterThanOrEqual(0);
        expect(event.duration).toBeGreaterThan(0);
        expect(event.gain).toBeGreaterThan(0);
        expect(event.gain).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("play", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", () => {
      throw new Error("sound must not make a network request");
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does nothing while sound is off: no AudioContext is created", async () => {
    const counts = installFakeAudioContext();
    const sound = await loadSound();
    expect(sound.play("seal-break", false)).toBe(false);
    expect(sound.play("figure-move", false)).toBe(false);
    expect(counts.contexts).toBe(0);
    expect(counts.oscillators + counts.sources + counts.gains).toBe(0);
  });

  it("with sound on, schedules one buffer source per noise event and one oscillator per tone", async () => {
    const counts = installFakeAudioContext();
    const sound = await loadSound();
    const plan = sound.soundPlan("seal-break");
    const noise = plan.filter((e) => e.kind === "noise").length;
    const tones = plan.filter((e) => e.kind === "tone").length;

    expect(sound.play("seal-break", true)).toBe(true);
    expect(counts.contexts).toBe(1);
    expect(counts.buffers).toBe(noise);
    expect(counts.sources).toBe(noise);
    expect(counts.filters).toBe(noise);
    expect(counts.oscillators).toBe(tones);
    expect(counts.gains).toBe(plan.length);
  });

  it("a rise and a fall schedule the same nodes", async () => {
    const counts = installFakeAudioContext();
    const sound = await loadSound();
    sound.play(sound.movementCue("rise", 0.2), true);
    const rise = { ...counts };
    counts.gains = counts.buffers = counts.sources = counts.filters = 0;
    counts.oscillators = 0;
    sound.play(sound.movementCue("fall", 0.9), true);
    expect({
      gains: counts.gains,
      buffers: counts.buffers,
      sources: counts.sources,
      filters: counts.filters,
      oscillators: counts.oscillators,
    }).toEqual({
      gains: rise.gains,
      buffers: rise.buffers,
      sources: rise.sources,
      filters: rise.filters,
      oscillators: rise.oscillators,
    });
  });

  it("resumes a suspended context and reuses it on the next play", async () => {
    const counts = installFakeAudioContext("suspended");
    const sound = await loadSound();
    sound.play("figure-move", true);
    sound.play("figure-move", true);
    expect(counts.contexts).toBe(1);
    expect(counts.resumes).toBe(2);
  });

  it("does nothing when the browser has no AudioContext", async () => {
    vi.resetModules();
    const sound = await import("./sound");
    expect(sound.play("seal-break", true)).toBe(false);
  });
});

describe("no network and no file (R14.2)", () => {
  it("sound.ts imports nothing, so it can load no other module", () => {
    const code = stripComments(soundSource);
    expect(code).not.toMatch(/\bimport\s/);
    expect(code).not.toMatch(/\brequire\s*\(/);
  });

  it("sound.ts names no network API and no audio file", () => {
    const code = stripComments(soundSource);
    for (const forbidden of [
      /\bfetch\s*\(/,
      /XMLHttpRequest/,
      /sendBeacon/,
      /WebSocket/,
      /EventSource/,
      /decodeAudioData/,
      /new\s+Audio\s*\(/,
      /createMediaElementSource/,
      /https?:/,
      /\.(mp3|wav|ogg|oga|m4a|aac|flac|webm|opus)\b/i,
    ]) {
      expect(code).not.toMatch(forbidden);
    }
  });

  it("playing a sound makes no fetch call and reads no file", async () => {
    installFakeAudioContext();
    const fetchSpy = vi.fn(() => Promise.reject(new Error("no network")));
    vi.stubGlobal("fetch", fetchSpy);
    const sound = await loadSound();
    sound.play("seal-break", true);
    sound.play("figure-move", true);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("vibrate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not call navigator.vibrate while sound is off", async () => {
    const vibrateFn = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate: vibrateFn });
    const sound = await loadSound();
    expect(sound.vibrate(false)).toBe(false);
    expect(vibrateFn).not.toHaveBeenCalled();
  });

  it("calls navigator.vibrate with the Seal_Break pattern while sound is on", async () => {
    const vibrateFn = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate: vibrateFn });
    const sound = await loadSound();
    expect(sound.vibrate(true)).toBe(true);
    expect(vibrateFn).toHaveBeenCalledTimes(1);
    expect(vibrateFn).toHaveBeenCalledWith(sound.SEAL_BREAK_VIBRATION_MS);
  });

  it("does nothing, and does not throw, when the browser has no vibration API", async () => {
    vi.stubGlobal("navigator", {});
    const sound = await loadSound();
    expect(sound.vibrate(true)).toBe(false);
  });

  it("does nothing when there is no navigator at all", async () => {
    vi.stubGlobal("navigator", undefined);
    const sound = await loadSound();
    expect(sound.vibrate(true)).toBe(false);
  });
});
