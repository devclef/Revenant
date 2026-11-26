// Feature: 20-easier-sealing-and-receipts (Part C), Property 2.
//
// Oracle test. `createPressController` below is a verbatim copy of the function
// as it stood at commit c2bf2db8, before activate() was added. For every event
// sequence that does not call activate(), the current controller must make the
// same prompts and report the same frames as this copy. So activate() is the
// only change in behaviour. fast-check runs each property at least 100 times.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { PRESS_IDLE, pressStep } from "./press-hold";
import type { PressState } from "./press-hold";
import { poolStage } from "./press-pose";
import type { PoolStage } from "./press-pose";
import { createPressController as currentController } from "./usePressEnvelope";
import type { PressConfig, PressMode } from "./usePressEnvelope";

// --- Oracle: verbatim copy of createPressController at c2bf2db8 ---

type PressFrameSink = (progress: number, stage: PoolStage | null) => void;

type OraclePressController = {
  down: (now: number) => boolean;
  up: (now: number) => void;
  cancel: (now: number) => void;
  tick: (now: number) => boolean;
  click: (detail: number) => void;
  reset: () => void;
};

function stageFor(state: PressState): PoolStage | null {
  if (state.phase === "idle") return null;
  return poolStage(state.progress);
}

/** A tracked press is holding, armed or settling; its frames must keep running. */
function needsFrames(state: PressState): boolean {
  return (
    state.phase === "holding" ||
    state.phase === "armed" ||
    state.phase === "settling"
  );
}

function oracleController(
  readConfig: () => PressConfig,
  onFrame: PressFrameSink,
): OraclePressController {
  let state: PressState = PRESS_IDLE;
  let lastMode: PressMode | null = null;
  let downOnControl = false;

  /** A mode change ends any earlier press, so the Setting_State accepts its own press. */
  function sync(): PressConfig {
    const config = readConfig();
    if (lastMode !== null && config.mode !== lastMode) {
      state = PRESS_IDLE;
      downOnControl = false;
      onFrame(0, null);
    }
    lastMode = config.mode;
    return config;
  }

  function report(): void {
    onFrame(state.progress, stageFor(state));
  }

  function apply(
    config: PressConfig,
    event: Parameters<typeof pressStep>[1],
  ): void {
    const result = pressStep(state, event);
    state = result.state;
    if (result.effect === "start_prompt") {
      if (config.mode === "setting") {
        config.onConfirmPress();
      } else {
        config.onCreatePress();
      }
    }
    report();
  }

  function fromSetting(config: PressConfig): void {
    // The Setting_State press has no hold: the release is the press.
    if (config.disabled) return;
    apply(config, { type: "ACTIVATE" });
  }

  return {
    down(now) {
      const config = sync();
      if (config.mode === "inert" || config.disabled || config.instant)
        return false;
      if (config.mode === "setting") {
        downOnControl = true;
        return true;
      }
      apply(config, { type: "DOWN", now });
      return true;
    },

    up(now) {
      const config = sync();
      if (config.mode === "inert") return;
      if (config.mode === "setting") {
        if (downOnControl) {
          downOnControl = false;
          fromSetting(config);
        }
        return;
      }
      // A release while disabled counts as a cancel, so nothing starts.
      apply(
        config,
        config.disabled ? { type: "CANCEL", now } : { type: "UP", now },
      );
    },

    cancel(now) {
      const config = sync();
      if (config.mode === "inert") return;
      if (config.mode === "setting") {
        downOnControl = false;
        return;
      }
      apply(config, { type: "CANCEL", now });
    },

    tick(now) {
      const config = sync();
      if (config.mode === "inert" || !needsFrames(state)) return false;
      apply(config, { type: "TICK", now });
      return needsFrames(state);
    },

    click(detail) {
      const config = sync();
      if (config.mode === "inert") return;
      if (config.disabled) {
        config.onAttempt?.();
        return;
      }
      // Instant mode runs the press on any click. Otherwise a pointer click
      // (detail > 0) is ignored, because the release already handled it.
      if (!config.instant && detail !== 0) return;
      apply(config, { type: "ACTIVATE" });
    },

    reset() {
      state = PRESS_IDLE;
      downOnControl = false;
      report();
    },
  };
}

// --- Property 2 ---

type Step =
  | { op: "down" }
  | { op: "up" }
  | { op: "cancel" }
  | { op: "tick" }
  | { op: "click"; detail: number }
  | { op: "reset" }
  | { op: "disable"; disabled: boolean }
  | { op: "mode"; mode: PressMode }
  | { op: "instant"; instant: boolean };

const stepArb: fc.Arbitrary<Step> = fc.oneof(
  fc.constant<Step>({ op: "down" }),
  fc.constant<Step>({ op: "up" }),
  fc.constant<Step>({ op: "cancel" }),
  fc.constant<Step>({ op: "tick" }),
  fc.constantFrom(0, 1, 2).map<Step>((detail) => ({ op: "click", detail })),
  fc.constant<Step>({ op: "reset" }),
  fc.boolean().map<Step>((disabled) => ({ op: "disable", disabled })),
  fc
    .constantFrom<PressMode>("write", "setting", "inert")
    .map<Step>((mode) => ({ op: "mode", mode })),
  fc.boolean().map<Step>((instant) => ({ op: "instant", instant })),
);

/** Replays one sequence against a controller and returns everything it did. */
function replay(
  make: (
    read: () => PressConfig,
    onFrame: PressFrameSink,
  ) => {
    down: (now: number) => boolean;
    up: (now: number) => void;
    cancel: (now: number) => void;
    tick: (now: number) => boolean;
    click: (detail: number) => void;
    reset: () => void;
  },
  steps: { step: Step; gap: number }[],
): unknown[] {
  const log: unknown[] = [];
  const config: PressConfig = {
    mode: "write",
    disabled: false,
    instant: false,
    onCreatePress: () => log.push(["create"]),
    onConfirmPress: () => log.push(["confirm"]),
    onAttempt: () => log.push(["attempt"]),
  };
  const controller = make(
    () => config,
    (progress, stage) => log.push(["frame", progress, stage]),
  );
  let now = 0;
  for (const { step, gap } of steps) {
    now += gap;
    switch (step.op) {
      case "down":
        log.push(["down", controller.down(now)]);
        break;
      case "up":
        controller.up(now);
        break;
      case "cancel":
        controller.cancel(now);
        break;
      case "tick":
        log.push(["tick", controller.tick(now)]);
        break;
      case "click":
        controller.click(step.detail);
        break;
      case "reset":
        controller.reset();
        break;
      case "disable":
        config.disabled = step.disabled;
        break;
      case "mode":
        config.mode = step.mode;
        break;
      case "instant":
        config.instant = step.instant;
        break;
    }
  }
  return log;
}

describe("Property 2: without activate(), the controller matches the c2bf2db8 oracle", () => {
  // Feature: 20-easier-sealing-and-receipts (Part C), Property 2: oracle equivalence
  it("prompts, attempts, frames and return values are identical for every sequence", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ step: stepArb, gap: fc.integer({ min: 0, max: 1200 }) }),
          { maxLength: 60 },
        ),
        (steps) => {
          const oracle = replay(oracleController, steps);
          const current = replay(currentController, steps);
          expect(current).toEqual(oracle);
        },
      ),
      { numRuns: 300 },
    );
  });
});
