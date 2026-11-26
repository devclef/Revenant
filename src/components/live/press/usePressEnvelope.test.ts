// Feature: 13-the-seal
//
// Unit tests for the press controller behind usePressEnvelope (spec 13,
// design section 2, requirements P1.2, P2.1, P2.8, P5.2). The controller has
// no React and no DOM, so it runs in the node environment. Time is passed in.

import { describe, expect, it } from "vitest";

import { SEAL_PRESS_HOLD_MS } from "./constants";
import { createPressController } from "./usePressEnvelope";
import type { PressConfig } from "./usePressEnvelope";
import type { PoolStage } from "./press-pose";

type Calls = { create: number; confirm: number; attempt: number };

/** A controller with a mutable config, and counters for each callback. */
function harness(init: Partial<PressConfig> = {}) {
  const calls: Calls = { create: 0, confirm: 0, attempt: 0 };
  const frames: Array<[number, PoolStage | null]> = [];
  let config: PressConfig = {
    mode: "write",
    disabled: false,
    instant: false,
    onCreatePress: () => {
      calls.create += 1;
    },
    onConfirmPress: () => {
      calls.confirm += 1;
    },
    onAttempt: () => {
      calls.attempt += 1;
    },
    ...init,
  };
  const controller = createPressController(
    () => config,
    (progress, stage) => frames.push([progress, stage]),
  );
  return {
    controller,
    calls,
    frames,
    set(next: Partial<PressConfig>) {
      config = { ...config, ...next };
    },
  };
}

describe("createPressController, write mode (P2.1, P5.2)", () => {
  it("starts the prompt only on the release after a full hold, never from a tick", () => {
    const h = harness();
    h.controller.down(0);
    h.controller.tick(SEAL_PRESS_HOLD_MS / 2);
    h.controller.tick(SEAL_PRESS_HOLD_MS + 5000);
    // The hold is complete and the timer has run long past it. Still no prompt.
    expect(h.calls.create).toBe(0);
    h.controller.up(SEAL_PRESS_HOLD_MS + 5000);
    expect(h.calls.create).toBe(1);
  });

  it("starts the prompt during the release, synchronously, once", () => {
    const h = harness();
    h.controller.down(0);
    h.controller.tick(SEAL_PRESS_HOLD_MS);
    const before = h.calls.create;
    h.controller.up(SEAL_PRESS_HOLD_MS);
    expect(before).toBe(0);
    expect(h.calls.create).toBe(1);
  });

  it("measures a full hold from the press itself when no tick ran", () => {
    const h = harness();
    h.controller.down(100);
    h.controller.up(100 + SEAL_PRESS_HOLD_MS);
    expect(h.calls.create).toBe(1);
  });

  it("does not start the prompt when the release comes before the full hold", () => {
    const h = harness();
    h.controller.down(0);
    h.controller.tick(300);
    h.controller.up(300);
    expect(h.calls.create).toBe(0);
    expect(h.calls.confirm).toBe(0);
  });

  it("never starts the prompt on a cancel, even after a full hold", () => {
    const h = harness();
    h.controller.down(0);
    h.controller.tick(SEAL_PRESS_HOLD_MS);
    h.controller.cancel(SEAL_PRESS_HOLD_MS);
    expect(h.calls.create).toBe(0);
    // A release after the cancel has no press to finish.
    h.controller.up(SEAL_PRESS_HOLD_MS + 10);
    expect(h.calls.create).toBe(0);
  });

  it("ignores every press while a prompt is open (P2.8)", () => {
    const h = harness();
    h.controller.down(0);
    h.controller.up(SEAL_PRESS_HOLD_MS);
    expect(h.calls.create).toBe(1);
    h.controller.down(SEAL_PRESS_HOLD_MS + 10);
    h.controller.up(SEAL_PRESS_HOLD_MS + 2000);
    h.controller.click(0);
    h.controller.click(1);
    expect(h.calls.create).toBe(1);
  });

  it("runs frames while the press is held and stops after the release", () => {
    const h = harness();
    expect(h.controller.down(0)).toBe(true);
    expect(h.controller.tick(450)).toBe(true);
    expect(h.controller.tick(SEAL_PRESS_HOLD_MS)).toBe(true);
    h.controller.up(SEAL_PRESS_HOLD_MS);
    expect(h.controller.tick(SEAL_PRESS_HOLD_MS + 16)).toBe(false);
  });

  it("reports progress and the pool stage as the hold runs", () => {
    const h = harness();
    h.controller.down(0);
    h.controller.tick(SEAL_PRESS_HOLD_MS / 2);
    h.controller.tick(SEAL_PRESS_HOLD_MS);
    const last = h.frames[h.frames.length - 1];
    expect(last).toEqual([1, "full"]);
    expect(h.frames.some(([, stage]) => stage === "bead")).toBe(true);
  });
});

describe("createPressController, keyboard and clicks (P1.2)", () => {
  it("starts the prompt from one keyboard activation, with no hold", () => {
    const h = harness();
    h.controller.click(0);
    expect(h.calls.create).toBe(1);
  });

  it("ignores a pointer-generated click, because the release already handled the press", () => {
    const h = harness();
    h.controller.down(0);
    h.controller.up(SEAL_PRESS_HOLD_MS);
    h.controller.click(1);
    expect(h.calls.create).toBe(1);
  });

  it("ignores a short pointer click so no prompt starts", () => {
    const h = harness();
    h.controller.down(0);
    h.controller.up(100);
    h.controller.click(1);
    expect(h.calls.create).toBe(0);
  });
});

describe("createPressController, disabled (P1.5)", () => {
  it("does not start a hold while the Backup_Choice is not made", () => {
    const h = harness({ disabled: true });
    expect(h.controller.down(0)).toBe(false);
    h.controller.up(SEAL_PRESS_HOLD_MS * 2);
    expect(h.calls.create).toBe(0);
  });

  it("reports an activation to onAttempt and starts nothing", () => {
    const h = harness({ disabled: true });
    h.controller.click(0);
    h.controller.click(1);
    expect(h.calls.attempt).toBe(2);
    expect(h.calls.create).toBe(0);
  });

  it("starts the press once the choice is made", () => {
    const h = harness({ disabled: true });
    h.controller.click(0);
    h.set({ disabled: false });
    h.controller.click(0);
    expect(h.calls.attempt).toBe(1);
    expect(h.calls.create).toBe(1);
  });

  it("treats a release as a cancel when the choice is withdrawn during a hold", () => {
    const h = harness();
    h.controller.down(0);
    h.controller.tick(SEAL_PRESS_HOLD_MS);
    h.set({ disabled: true });
    h.controller.up(SEAL_PRESS_HOLD_MS);
    expect(h.calls.create).toBe(0);
  });
});

describe("createPressController, setting mode (P5.4 to P5.6)", () => {
  it("makes the Setting_State press one plain press with no hold", () => {
    const h = harness({ mode: "setting" });
    expect(h.controller.down(0)).toBe(true);
    h.controller.up(0);
    expect(h.calls.confirm).toBe(1);
    expect(h.calls.create).toBe(0);
  });

  it("starts the second prompt from a keyboard activation", () => {
    const h = harness({ mode: "setting" });
    h.controller.click(0);
    expect(h.calls.confirm).toBe(1);
    expect(h.calls.create).toBe(0);
  });

  it("does not start a second prompt from a further press", () => {
    const h = harness({ mode: "setting" });
    h.controller.down(0);
    h.controller.up(0);
    h.controller.down(10);
    h.controller.up(20);
    h.controller.click(0);
    expect(h.calls.confirm).toBe(1);
  });

  it("does not start a prompt from a release that began elsewhere", () => {
    const h = harness({ mode: "setting" });
    h.controller.up(0);
    expect(h.calls.confirm).toBe(0);
  });
});

describe("createPressController, instant mode (P2.7)", () => {
  it("starts no hold on pointer down, and runs the press on any click", () => {
    const h = harness({ instant: true });
    expect(h.controller.down(0)).toBe(false);
    h.controller.up(SEAL_PRESS_HOLD_MS);
    expect(h.calls.create).toBe(0);
    h.controller.click(1);
    expect(h.calls.create).toBe(1);
  });
});

describe("createPressController, inert", () => {
  it("accepts no press of any kind", () => {
    const h = harness({ mode: "inert" });
    expect(h.controller.down(0)).toBe(false);
    h.controller.up(SEAL_PRESS_HOLD_MS * 2);
    h.controller.click(0);
    h.controller.click(1);
    expect(h.calls.create).toBe(0);
    expect(h.calls.confirm).toBe(0);
  });
});

describe("createPressController, failure lift (P4.3, P4.4)", () => {
  it("recedes the wax pool when a press is cut off by the inert failure state", () => {
    const h = harness();
    h.controller.down(0);
    h.controller.tick(SEAL_PRESS_HOLD_MS / 2);
    expect(h.frames.at(-1)?.[0]).toBeGreaterThan(0);
    h.set({ mode: "inert" });
    h.controller.tick(SEAL_PRESS_HOLD_MS);
    // The mode change resets the press to zero with no pool stage.
    expect(h.frames.at(-1)).toEqual([0, null]);
    const before = h.frames.length;
    h.controller.up(SEAL_PRESS_HOLD_MS * 2);
    expect(h.frames.length).toBe(before);
    expect(h.calls.create).toBe(0);
  });
});

describe("createPressController, mode change and reset", () => {
  it("ends an earlier press when the mode changes, so the Setting_State press starts fresh", () => {
    const h = harness();
    h.controller.click(0);
    expect(h.calls.create).toBe(1);
    h.set({ mode: "setting" });
    h.controller.click(0);
    expect(h.calls.confirm).toBe(1);
    expect(h.calls.create).toBe(1);
  });

  it("starts a new press after reset (RETRY after a cancel or failure)", () => {
    const h = harness();
    h.controller.click(0);
    h.controller.reset();
    h.controller.click(0);
    expect(h.calls.create).toBe(2);
  });
});

describe("createPressController, activate() (Seal_Button click)", () => {
  it("starts one write prompt per activation in full motion, with no hold", () => {
    const h = harness();
    h.controller.activate();
    expect(h.calls.create).toBe(1);
    expect(h.calls.attempt).toBe(0);
  });

  it("starts one write prompt per activation in instant mode", () => {
    const h = harness({ instant: true });
    h.controller.activate();
    expect(h.calls.create).toBe(1);
  });

  it("starts one setting prompt per activation in full motion", () => {
    const h = harness({ mode: "setting" });
    h.controller.activate();
    expect(h.calls.confirm).toBe(1);
    expect(h.calls.create).toBe(0);
  });

  it("starts one setting prompt per activation in instant mode", () => {
    const h = harness({ mode: "setting", instant: true });
    h.controller.activate();
    expect(h.calls.confirm).toBe(1);
    expect(h.calls.create).toBe(0);
  });

  it("calls onAttempt and starts nothing while disabled", () => {
    const h = harness({ disabled: true });
    h.controller.activate();
    h.controller.activate();
    expect(h.calls.attempt).toBe(2);
    expect(h.calls.create).toBe(0);
    expect(h.calls.confirm).toBe(0);
  });

  it("accepts nothing in inert mode, not even onAttempt", () => {
    const h = harness({ mode: "inert" });
    h.controller.activate();
    expect(h.calls.create).toBe(0);
    expect(h.calls.confirm).toBe(0);
    expect(h.calls.attempt).toBe(0);
  });

  it("does not start a second prompt when the wax already started the press", () => {
    const h = harness();
    h.controller.down(0);
    h.controller.up(SEAL_PRESS_HOLD_MS);
    expect(h.calls.create).toBe(1);
    h.controller.activate();
    expect(h.calls.create).toBe(1);
  });
});
