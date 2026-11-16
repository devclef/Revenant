import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEAL_PRESS_HOLD_MS } from "./constants";
import { PRESS_IDLE, pressStep } from "./press-hold";
import type { PressEffect, PressEvent, PressState } from "./press-hold";

/**
 * Tests for the seal press model (spec 13, design section 2).
 * fast-check is already a dev dependency, so the properties are generated
 * with it. Time is passed in explicitly, so every run is deterministic
 * for a given seed.
 */

type Step = { kind: PressEvent["type"]; dt: number };

/** Runs a sequence of steps and records the effect of each one. */
function run(steps: Step[]): {
  events: PressEvent[];
  effects: PressEffect[];
  final: PressState;
} {
  let state: PressState = PRESS_IDLE;
  let now = 0;
  const events: PressEvent[] = [];
  const effects: PressEffect[] = [];
  for (const step of steps) {
    now += step.dt;
    const event = toEvent(step.kind, now);
    const result = pressStep(state, event);
    state = result.state;
    events.push(event);
    effects.push(result.effect);
  }
  return { events, effects, final: state };
}

function toEvent(kind: PressEvent["type"], now: number): PressEvent {
  if (kind === "ACTIVATE" || kind === "RESET") return { type: kind };
  return { type: kind, now };
}

const pointerKinds = ["DOWN", "TICK", "UP", "CANCEL", "RESET"] as const;

const stepArbitrary = fc.record({
  kind: fc.constantFrom(...pointerKinds),
  dt: fc.integer({ min: 0, max: 1200 }),
});

describe("press hold, property and example tests", () => {
  // Feature: 13-the-seal, Property 5: Press hold never starts a prompt before release and starts it at most once
  it("P2.1 P2.8: no start_prompt before UP, and at most one start_prompt between RESETs", () => {
    fc.assert(
      fc.property(fc.array(stepArbitrary, { maxLength: 60 }), (steps) => {
        const { events, effects } = run(steps);
        let promptsSinceReset = 0;
        let sawUp = false;
        for (let i = 0; i < events.length; i++) {
          const event = events[i];
          if (event.type === "UP") sawUp = true;
          if (event.type === "RESET") {
            promptsSinceReset = 0;
            sawUp = false;
            continue;
          }
          if (effects[i] === "start_prompt") {
            // A prompt is only ever started from a release.
            expect(event.type).toBe("UP");
            expect(sawUp).toBe(true);
            promptsSinceReset += 1;
            expect(promptsSinceReset).toBeLessThanOrEqual(1);
          }
        }
      }),
      { numRuns: 500 },
    );
  });

  it("P2.8: a second press after a completed one starts no second prompt until RESET", () => {
    const hold = SEAL_PRESS_HOLD_MS;
    const { effects } = run([
      { kind: "DOWN", dt: 0 },
      { kind: "UP", dt: hold },
      { kind: "DOWN", dt: 10 },
      { kind: "UP", dt: hold },
      { kind: "DOWN", dt: 10 },
      { kind: "UP", dt: hold },
    ]);
    expect(effects.filter((e) => e === "start_prompt")).toHaveLength(1);
  });

  // Feature: 13-the-seal, Property 6: Release after a full hold starts the prompt, a short hold does not
  it("P2.3 P4.1: UP after a full hold emits start_prompt for any hold at or beyond SEAL_PRESS_HOLD_MS", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: SEAL_PRESS_HOLD_MS, max: SEAL_PRESS_HOLD_MS * 4 }),
        fc.array(fc.integer({ min: 0, max: 300 }), { maxLength: 10 }),
        (holdMs, ticks) => {
          const steps: Step[] = [{ kind: "DOWN", dt: 0 }];
          let elapsed = 0;
          for (const dt of ticks) {
            // Only ticks that stay inside the hold, so the hold is not yet complete.
            if (elapsed + dt >= holdMs) break;
            elapsed += dt;
            steps.push({ kind: "TICK", dt });
          }
          steps.push({ kind: "UP", dt: holdMs - elapsed });
          const { effects } = run(steps);
          expect(effects[effects.length - 1]).toBe("start_prompt");
        },
      ),
      { numRuns: 300 },
    );
  });

  it("P2.4 P5.2: UP before full progress never emits start_prompt, for any short hold", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: SEAL_PRESS_HOLD_MS - 1 }),
        fc.array(fc.integer({ min: 0, max: 200 }), { maxLength: 10 }),
        (holdMs, ticks) => {
          const steps: Step[] = [{ kind: "DOWN", dt: 0 }];
          let elapsed = 0;
          for (const dt of ticks) {
            if (elapsed + dt >= holdMs) break;
            elapsed += dt;
            steps.push({ kind: "TICK", dt });
          }
          steps.push({ kind: "UP", dt: holdMs - elapsed });
          const { effects, final } = run(steps);
          expect(effects).not.toContain("start_prompt");
          expect(final.phase).toBe("settling");
        },
      ),
      { numRuns: 300 },
    );
  });

  it("P2.1: a full hold reached by TICK alone, then UP, starts the prompt once", () => {
    const { effects } = run([
      { kind: "DOWN", dt: 0 },
      { kind: "TICK", dt: SEAL_PRESS_HOLD_MS / 2 },
      { kind: "TICK", dt: SEAL_PRESS_HOLD_MS },
      { kind: "UP", dt: 1 },
    ]);
    expect(effects.filter((e) => e === "start_prompt")).toHaveLength(1);
    expect(effects[effects.length - 1]).toBe("start_prompt");
  });

  it("P2.4: a release one millisecond before the hold completes does not start the prompt", () => {
    const { effects, final } = run([
      { kind: "DOWN", dt: 0 },
      { kind: "UP", dt: SEAL_PRESS_HOLD_MS - 1 },
    ]);
    expect(effects).toEqual([null, null]);
    expect(final.phase).toBe("settling");
  });

  it("P2.3: a release exactly at the full hold starts the prompt", () => {
    const { effects } = run([
      { kind: "DOWN", dt: 0 },
      { kind: "UP", dt: SEAL_PRESS_HOLD_MS },
    ]);
    expect(effects[effects.length - 1]).toBe("start_prompt");
  });

  it("P5.2: a cancelled press never starts the prompt, even when held past full progress", () => {
    const { effects } = run([
      { kind: "DOWN", dt: 0 },
      { kind: "TICK", dt: SEAL_PRESS_HOLD_MS * 2 },
      { kind: "CANCEL", dt: 0 },
    ]);
    expect(effects).not.toContain("start_prompt");
  });
});
