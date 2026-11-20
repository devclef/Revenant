// Feature: 15-the-flow (spec 15, task 9; prototype screens 9 to 15).
//
// The state of the two presses for each seal state. Only one press is ever
// current, and the current press is the only one that carries a hint.

import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "../copy";
import { sealStepsView } from "./seal-steps";

describe("sealStepsView", () => {
  it("leaves both presses pending before a backup choice (seal-choose)", () => {
    const view = sealStepsView({ tag: "write", backupChoice: null });
    expect(view.one).toEqual({ state: "pending", hint: null });
    expect(view.two).toEqual({ state: "pending", hint: null });
  });

  it("makes the first press current once a choice is made (seal-step-1)", () => {
    const view = sealStepsView({ tag: "write", backupChoice: "skip" });
    expect(view.one).toEqual({
      state: "current",
      hint: LIVE_COPY.sealStepOneHint,
    });
    expect(view.two.state).toBe("pending");
  });

  it("marks the passkey made and the second press current (seal-step-2)", () => {
    const view = sealStepsView({ tag: "created", backupChoice: "card" });
    expect(view.one).toEqual({
      state: "done",
      hint: LIVE_COPY.sealStepPasskeyMade,
    });
    expect(view.two).toEqual({
      state: "current",
      hint: LIVE_COPY.sealStepTwoHint,
    });
  });

  it("keeps the first press current while its passkey prompt runs", () => {
    const view = sealStepsView({ tag: "creating", backupChoice: "card" });
    expect(view.one.state).toBe("current");
    expect(view.two.state).toBe("pending");
  });

  it("shows the second press current while it waits for the device", () => {
    const view = sealStepsView({ tag: "confirming", backupChoice: "card" });
    expect(view.one.state).toBe("done");
    expect(view.two).toEqual({
      state: "current",
      hint: LIVE_COPY.sealStepTwoHint,
    });
  });

  it("keeps the second press current without a hint while sealing (seal-sealing)", () => {
    for (const tag of ["preparing", "sealing"] as const) {
      const view = sealStepsView({ tag, backupChoice: "card" });
      expect(view.one.state).toBe("done");
      expect(view.two).toEqual({ state: "current", hint: null });
    }
  });

  it("never has more than one current press in any state", () => {
    const tags = [
      "write",
      "creating",
      "created",
      "confirming",
      "preparing",
      "sealing",
    ] as const;
    for (const tag of tags) {
      for (const backupChoice of [null, "card", "skip"] as const) {
        const view = sealStepsView({ tag, backupChoice });
        const current = [view.one, view.two].filter(
          (step) => step.state === "current",
        );
        expect(current.length).toBeLessThanOrEqual(1);
      }
    }
  });
});
