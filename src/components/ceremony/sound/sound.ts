// Feature: 05-reveal-ceremony, Task 10 (R14.2-R14.5)
//
// Sound and vibration for the Seal_Break and for the rise/fall figure movement.
// Every sound is synthesised with Web Audio. This module loads no audio file,
// makes no network request, and imports nothing. The parent loads it with a
// dynamic import() only after the sound toggle is turned on (R14.5).
//
// The sound plan depends only on the cue. A figure movement reaches this module
// through `movementCue`, which takes the direction and the distance but ignores
// both, so a rise and a fall, and every distance between a Mark and a figure,
// produce the same sound and the same vibration (R14.4, Property 24).

/** The two cues this module plays. */
export type SoundCue = "seal-break" | "figure-move";

/** A rise or a fall of a figure. Both get the same cue. */
export type MovementDirection = "rise" | "fall";

/** Filtered noise, for paper and for the wax crack. */
export type NoiseEvent = {
  readonly kind: "noise";
  /** Start, in seconds after the cue starts. */
  readonly at: number;
  /** Length of the burst, in seconds. */
  readonly duration: number;
  /** Peak gain, from 0 to 1. */
  readonly gain: number;
  /** Centre frequency of the band-pass filter, in Hz. */
  readonly bandHz: number;
  /** Band-pass Q. Lower is wider. */
  readonly q: number;
};

/** A short low tone, for the thud under the crack. */
export type ToneEvent = {
  readonly kind: "tone";
  readonly at: number;
  readonly duration: number;
  readonly gain: number;
  readonly frequencyHz: number;
};

export type SoundEvent = NoiseEvent | ToneEvent;

const PLANS: Readonly<Record<SoundCue, readonly SoundEvent[]>> = {
  "seal-break": [
    { kind: "tone", at: 0, duration: 0.18, gain: 0.12, frequencyHz: 110 },
    { kind: "noise", at: 0, duration: 0.09, gain: 0.5, bandHz: 2400, q: 1.2 },
    { kind: "noise", at: 0.1, duration: 0.3, gain: 0.18, bandHz: 900, q: 0.7 },
  ],
  "figure-move": [
    { kind: "noise", at: 0, duration: 0.16, gain: 0.1, bandHz: 1400, q: 0.8 },
  ],
};

/** The vibration pattern for the Seal_Break, in milliseconds. */
export const SEAL_BREAK_VIBRATION_MS: readonly number[] = [18, 30, 40];

/**
 * The sound plan for a cue. The plan is the same object for every call with the
 * same cue, and nothing else feeds into it.
 */
export function soundPlan(cue: SoundCue): readonly SoundEvent[] {
  return PLANS[cue];
}

/**
 * The cue for a figure movement. The direction and the distance are accepted so
 * the call site reads naturally, and are deliberately unused: a rise and a fall,
 * and any distance, get the same cue.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- direction and distance are deliberately ignored (R14.4).
export function movementCue(_direction: MovementDirection, _distance: number): "figure-move" {
  return "figure-move";
}

/**
 * Vibrate for the Seal_Break. Calls `navigator.vibrate` only when sound is on
 * and the API exists. Returns whether a vibration was requested.
 */
export function vibrate(enabled: boolean): boolean {
  if (!enabled) return false;
  const nav = globalThis.navigator as Navigator | undefined;
  if (!nav || typeof nav.vibrate !== "function") return false;
  nav.vibrate([...SEAL_BREAK_VIBRATION_MS]);
  return true;
}

type AudioContextCtor = new () => AudioContext;

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (context) return context;
  const g = globalThis as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  return context;
}

/** The fade-in time for each burst, in seconds. */
const ATTACK_S = 0.01;

/**
 * Deterministic noise in [-1, 1), from a xorshift32 generator. A fixed seed per
 * event keeps the sound the same every time and avoids Math.random.
 */
function noiseSamples(length: number, seed: number): Float32Array {
  const out = new Float32Array(length);
  let s = seed >>> 0 || 1;
  for (let i = 0; i < length; i++) {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    out[i] = s / 0x80000000 - 1;
  }
  return out;
}

function scheduleEvent(
  ctx: AudioContext,
  event: SoundEvent,
  seed: number,
  start: number,
): void {
  const t0 = start + event.at;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(event.gain, t0 + ATTACK_S);
  gain.gain.linearRampToValueAtTime(0, t0 + event.duration);
  gain.connect(ctx.destination);

  if (event.kind === "noise") {
    const frames = Math.ceil(event.duration * ctx.sampleRate);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    buffer.getChannelData(0).set(noiseSamples(frames, seed));
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = event.bandHz;
    filter.Q.value = event.q;
    source.connect(filter);
    filter.connect(gain);
    source.start(t0);
    source.stop(t0 + event.duration);
  } else {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = event.frequencyHz;
    osc.connect(gain);
    osc.start(t0);
    osc.stop(t0 + event.duration);
  }
}

/**
 * Play the sound for a cue. Does nothing unless sound is on. The AudioContext is
 * created on the first play, which follows the toggle press, a user gesture.
 * Returns whether the sound was scheduled.
 */
export function play(cue: SoundCue, enabled: boolean): boolean {
  if (!enabled) return false;
  const ctx = audioContext();
  if (!ctx) return false;
  if (ctx.state === "suspended") void ctx.resume();
  const start = ctx.currentTime;
  soundPlan(cue).forEach((event, index) =>
    scheduleEvent(ctx, event, index + 1, start),
  );
  return true;
}
