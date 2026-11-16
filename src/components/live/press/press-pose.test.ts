import { describe, expect, it } from "vitest";
import { SEAL_PRESS_HOLD_MS } from "./constants";
import { PRESS_IDLE } from "./press-hold";
import type { PressState } from "./press-hold";
import { poolStage, sealPose } from "./press-pose";
import type { SealState } from "../seal-machine";

const HELD: PressState = { phase: "holding", progress: 0.5, since: 0 };

describe("sealPose", () => {
  it("P2.7: reduced motion or Calm_Mode draws the final pose for the seal state", () => {
    const write: SealState = { tag: "write" };
    expect(sealPose(write, PRESS_IDLE, true)).toBe("armed");
    expect(sealPose(write, HELD, true)).toBe("armed");
    expect(sealPose({ tag: "creating" }, PRESS_IDLE, true)).toBe("signet_down");
    expect(sealPose({ tag: "created" }, PRESS_IDLE, true)).toBe("setting");
    expect(sealPose({ tag: "cancelled" }, PRESS_IDLE, true)).toBe("lifted");
  });

  it("maps the press phase to the wax pose while writing", () => {
    const write: SealState = { tag: "write" };
    expect(sealPose(write, PRESS_IDLE)).toBe("unpressed");
    expect(sealPose(write, HELD)).toBe("pooling");
    expect(sealPose(write, { phase: "armed", progress: 1 })).toBe("armed");
  });
});

describe("poolStage", () => {
  it("full progress is always the full pool, so a cut P3 still works", () => {
    expect(poolStage(1)).toBe("full");
    expect(poolStage(0)).toBe("bead");
  });
});

describe("press timing", () => {
  it("SEAL_PRESS_HOLD_MS is between 600 and 1500 ms", () => {
    expect(SEAL_PRESS_HOLD_MS).toBeGreaterThanOrEqual(600);
    expect(SEAL_PRESS_HOLD_MS).toBeLessThanOrEqual(1500);
  });
});
