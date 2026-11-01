// Feature: 05-reveal-ceremony
//
// Unit and property tests for the pure hold model (hold.ts). The default
// Vitest environment is node, so these run DOM-free: the model owns no timers
// and reads no clock, every timestamp is supplied, so the state machine is
// exercised with explicit `now` values.
//
// Covers onPress / onTick / onRelease across every phase and the settle path,
// plus Property 5: the hold sends exactly one ADVANCE, and only when complete.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { SEAL_HOLD_MS, SEAL_SETTLE_MS } from "../constants";
import {
  IDLE,
  isBreak,
  onPress,
  onRelease,
  onTick,
  type HoldState,
} from "./hold";

describe("hold model transitions", () => {
  it("starts idle with no progress", () => {
    expect(IDLE).toEqual({ phase: "idle", progress: 0 });
  });

  it("onPress begins holding from now with progress 0", () => {
    const s = onPress(IDLE, 1000);
    expect(s.phase).toBe("holding");
    expect(s.progress).toBe(0);
  });

  it("onTick grows progress linearly while holding", () => {
    const pressed = onPress(IDLE, 0);
    const quarter = onTick(pressed, SEAL_HOLD_MS * 0.25);
    expect(quarter.phase).toBe("holding");
    expect(quarter.progress).toBeCloseTo(0.25, 10);

    const half = onTick(pressed, SEAL_HOLD_MS * 0.5);
    expect(half.phase).toBe("holding");
    expect(half.progress).toBeCloseTo(0.5, 10);
  });

  it("onTick breaks exactly when progress reaches 1 at SEAL_HOLD_MS", () => {
    const pressed = onPress(IDLE, 0);
    const broken = onTick(pressed, SEAL_HOLD_MS);
    expect(broken).toEqual({ phase: "broken", progress: 1 });
  });

  it("onTick clamps progress to 1 and breaks past SEAL_HOLD_MS", () => {
    const pressed = onPress(IDLE, 0);
    const broken = onTick(pressed, SEAL_HOLD_MS * 3);
    expect(broken).toEqual({ phase: "broken", progress: 1 });
  });

  it("broken is terminal: onPress, onTick and onRelease do not move it", () => {
    const broken: HoldState = { phase: "broken", progress: 1 };
    expect(onPress(broken, 10)).toBe(broken);
    expect(onTick(broken, 10)).toBe(broken);
    expect(onRelease(broken, 10)).toBe(broken);
  });

  it("idle is unchanged by onTick and onRelease", () => {
    expect(onTick(IDLE, 500)).toBe(IDLE);
    expect(onRelease(IDLE, 500)).toBe(IDLE);
  });

  it("onRelease below full progress begins settling, sending nothing", () => {
    const pressed = onPress(IDLE, 0);
    const held = onTick(pressed, SEAL_HOLD_MS * 0.5);
    const released = onRelease(held, SEAL_HOLD_MS * 0.5);
    expect(released.phase).toBe("settling");
    expect(released.progress).toBeCloseTo(0.5, 10);
    expect(isBreak(held, released)).toBe(false);
  });

  it("onRelease exactly at the threshold breaks the seal", () => {
    const pressed = onPress(IDLE, 0);
    const released = onRelease(pressed, SEAL_HOLD_MS);
    expect(released).toEqual({ phase: "broken", progress: 1 });
  });

  it("the settle path recedes to 0 then returns to idle", () => {
    // Press, hold halfway, release to begin settling at t = 1000.
    const pressed = onPress(IDLE, 0);
    const held = onTick(pressed, SEAL_HOLD_MS * 0.5);
    const releaseAt = SEAL_HOLD_MS * 0.5;
    const settling = onRelease(held, releaseAt);
    expect(settling.phase).toBe("settling");
    expect(settling.progress).toBeCloseTo(0.5, 10);

    // Partway through the settle the progress has receded but is not yet 0.
    const mid = onTick(settling, releaseAt + SEAL_SETTLE_MS * 0.5);
    expect(mid.phase).toBe("settling");
    expect(mid.progress).toBeCloseTo(0.25, 10);

    // At the end of SEAL_SETTLE_MS the phase returns to idle with progress 0.
    const done = onTick(settling, releaseAt + SEAL_SETTLE_MS);
    expect(done).toEqual(IDLE);

    // Ticking past the settle window stays idle.
    expect(onTick(settling, releaseAt + SEAL_SETTLE_MS * 2)).toEqual(IDLE);
  });

  it("a fresh press from settling abandons the recede and holds anew", () => {
    const pressed = onPress(IDLE, 0);
    const held = onTick(pressed, SEAL_HOLD_MS * 0.5);
    const settling = onRelease(held, SEAL_HOLD_MS * 0.5);
    const repressed = onPress(settling, 10_000);
    expect(repressed.phase).toBe("holding");
    expect(repressed.progress).toBe(0);
  });

  it("isBreak is true only on the transition into broken", () => {
    const pressed = onPress(IDLE, 0);
    const broken = onTick(pressed, SEAL_HOLD_MS);
    expect(isBreak(pressed, broken)).toBe(true);
    // Staying broken does not fire again.
    const stillBroken = onTick(broken, SEAL_HOLD_MS * 2);
    expect(isBreak(broken, stillBroken)).toBe(false);
  });
});

// Feature: 05-reveal-ceremony, Property 5: The hold sends exactly one ADVANCE,
// and only when complete.
describe("Property 5: the hold sends exactly one ADVANCE, only when complete", () => {
  type Event =
    | { kind: "press"; now: number }
    | { kind: "tick"; now: number }
    | { kind: "release"; now: number };

  const event = fc.record({
    kind: fc.constantFrom("press", "tick", "release"),
    now: fc.double({ min: -1e6, max: 1e6, noNaN: true }),
  }) as fc.Arbitrary<Event>;

  const step = (s: HoldState, e: Event): HoldState => {
    switch (e.kind) {
      case "press":
        return onPress(s, e.now);
      case "tick":
        return onTick(s, e.now);
      case "release":
        return onRelease(s, e.now);
    }
  };

  it("isBreak fires at most once, only on reaching full hold", () => {
    fc.assert(
      fc.property(fc.array(event, { maxLength: 40 }), (events) => {
        let state: HoldState = IDLE;
        let breaks = 0;

        for (const e of events) {
          const prev = state;
          const next = step(prev, e);

          if (isBreak(prev, next)) {
            breaks += 1;
            // A break only ever happens into the broken phase at full progress.
            expect(prev.phase).not.toBe("broken");
            expect(next).toEqual({ phase: "broken", progress: 1 });
          }

          state = next;
        }

        // Exactly one ADVANCE at most across the whole sequence.
        expect(breaks).toBeLessThanOrEqual(1);
      }),
      { numRuns: 100 },
    );
  });

  it("a release below full progress leaves settling then idle, with no break", () => {
    fc.assert(
      fc.property(
        // A press, then a release strictly before SEAL_HOLD_MS has elapsed.
        fc.double({ min: 0, max: 1e6, noNaN: true }),
        fc.double({ min: 0, max: 0.999, noNaN: true }),
        (pressAt, frac) => {
          const releaseAt = pressAt + SEAL_HOLD_MS * frac;
          const pressed = onPress(IDLE, pressAt);
          const released = onRelease(pressed, releaseAt);

          // No ADVANCE on an early release.
          expect(isBreak(pressed, released)).toBe(false);
          expect(released.phase).toBe("settling");
          expect(released.progress).toBeGreaterThanOrEqual(0);
          expect(released.progress).toBeLessThan(1);

          // Settling fully recedes to idle with progress 0, still no break.
          const settled = onTick(released, releaseAt + SEAL_SETTLE_MS);
          expect(isBreak(released, settled)).toBe(false);
          expect(settled).toEqual(IDLE);
        },
      ),
      { numRuns: 100 },
    );
  });
});
