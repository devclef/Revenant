import { describe, expect, it } from "vitest";
import { SEAL_PRESS_HOLD_MS } from "./constants";
import { PRESS_IDLE } from "./press-hold";
import type { PressState } from "./press-hold";
import { poolStage, sealPose } from "./press-pose";
import type { SealState } from "../seal-machine";

describe("sealPose", () => {
  it("P2.7: reduced motion or Calm_Mode draws the final pose for the seal state", () => {
    const write: SealState = { tag: "write" };
    expect(sealPose(write, PRESS_IDLE, true)).toBe("armed");
    expect(
      sealPose(write, { phase: "holding", progress: 0.5, since: 0 }, true),
    ).toBe("armed");
    expect(sealPose({ tag: "creating" }, PRESS_IDLE, true)).toBe("signet_down");
    expect(sealPose({ tag: "created" }, PRESS_IDLE, true)).toBe("setting");
    expect(sealPose({ tag: "cancelled" }, PRESS_IDLE, true)).toBe("lifted");
  });

  it("maps the press phase and progress to the wax pose while writing", () => {
    const write: SealState = { tag: "write" };
    expect(sealPose(write, PRESS_IDLE)).toBe("unpressed");
    expect(sealPose(write, { phase: "holding", progress: 0.1, since: 0 })).toBe(
      "bead",
    );
    expect(sealPose(write, { phase: "holding", progress: 0.5, since: 0 })).toBe(
      "spread",
    );
    expect(sealPose(write, { phase: "holding", progress: 0.9, since: 0 })).toBe(
      "spread",
    );
    expect(sealPose(write, { phase: "holding", progress: 1, since: 0 })).toBe(
      "armed",
    );
    expect(sealPose(write, { phase: "armed", progress: 1 })).toBe("armed");
  });

  it("a receding press drops back through the stages", () => {
    const write: SealState = { tag: "write" };
    expect(
      sealPose(write, {
        phase: "settling",
        progress: 0.2,
        since: 0,
        from: 0.2,
      }),
    ).toBe("bead");
    expect(
      sealPose(write, {
        phase: "settling",
        progress: 0.6,
        since: 0,
        from: 0.6,
      }),
    ).toBe("spread");
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
