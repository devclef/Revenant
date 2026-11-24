// Feature: 15-the-flow (spec 15, task 9; prototype screens 9 to 15).
//
// The state of the two presses for each seal state. Only one press is ever
// current, and the current press is the only one that carries a hint.

import { describe, expect, it } from "vitest";

import { LIVE_COPY, REAL_COPY } from "../copy";
import { PRESS_COPY } from "../press/copy";
import { sealStepsView } from "./seal-steps";

describe("Seal step wording (spec 16, Requirement 14)", () => {
  it("pins the step paragraph, the first press hint and the passkey made hint", () => {
    expect(LIVE_COPY.sealParagraph).toBe(
      "Press the wax twice: once to make your passkey, once to set the seal.",
    );
    expect(PRESS_COPY.stepOneHint).toBe(
      'Press the wax. The passkey is saved as "Revenant demo".',
    );
    expect(PRESS_COPY.stepPasskeyMade).toBe(
      'Passkey made. Saved as "Revenant demo".',
    );
  });
});

describe("sealStepsView", () => {
  it("leaves both presses pending before a backup choice (seal-choose)", () => {
    const view = sealStepsView({ tag: "write", backupChoice: null });
    expect(view.one).toEqual({
      state: "pending",
      hint: PRESS_COPY.stepOneHint,
    });
    expect(view.two).toEqual({ state: "pending", hint: null });
  });

  it("makes the first press current once a choice is made (seal-step-1)", () => {
    const view = sealStepsView({ tag: "write", backupChoice: "skip" });
    expect(view.one).toEqual({
      state: "current",
      hint: PRESS_COPY.stepOneHint,
    });
    expect(view.two.state).toBe("pending");
  });

  it("marks the passkey made and the second press current with no hint (seal-step-2)", () => {
    const view = sealStepsView({ tag: "created", backupChoice: "card" });
    expect(view.one).toEqual({
      state: "done",
      hint: PRESS_COPY.stepPasskeyMade,
    });
    expect(view.two).toEqual({ state: "current", hint: null });
  });

  it("keeps the first press current while its passkey prompt runs", () => {
    const view = sealStepsView({ tag: "creating", backupChoice: "card" });
    expect(view.one).toEqual({
      state: "current",
      hint: PRESS_COPY.stepOneHint,
    });
    expect(view.two.state).toBe("pending");
  });

  it("shows the second press current while it waits for the device", () => {
    const view = sealStepsView({ tag: "confirming", backupChoice: "card" });
    expect(view.one.state).toBe("done");
    expect(view.two).toEqual({
      state: "current",
      hint: PRESS_COPY.stepTwoHint,
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

describe("sealStepsView real input (spec 19, design 2)", () => {
  it("returns the demo hints when real is omitted or false", () => {
    for (const tag of ["write", "creating", "created", "confirming", "preparing", "sealing"] as const) {
      for (const backupChoice of [null, "card", "skip"] as const) {
        expect(sealStepsView({ tag, backupChoice })).toEqual(
          sealStepsView({ tag, backupChoice, real: false }),
        );
      }
    }
  });

  it("uses the REAL_COPY hints for the first press and the passkey made line", () => {
    const pending = sealStepsView({ tag: "write", backupChoice: null, real: true });
    expect(pending.one.hint).toBe(REAL_COPY.stepOneHint);
    const current = sealStepsView({ tag: "write", backupChoice: "card", real: true });
    expect(current.one).toEqual({ state: "current", hint: REAL_COPY.stepOneHint });
    const done = sealStepsView({ tag: "created", backupChoice: "card", real: true });
    expect(done.one).toEqual({ state: "done", hint: REAL_COPY.stepPasskeyMade });
    const sealing = sealStepsView({ tag: "sealing", backupChoice: "card", real: true });
    expect(sealing.one.hint).toBe(REAL_COPY.stepPasskeyMade);
  });

  it("keeps the same step states with real true", () => {
    for (const tag of ["write", "creating", "created", "confirming", "preparing", "sealing"] as const) {
      for (const backupChoice of [null, "card", "skip"] as const) {
        const demo = sealStepsView({ tag, backupChoice });
        const real = sealStepsView({ tag, backupChoice, real: true });
        expect(real.one.state).toBe(demo.one.state);
        expect(real.two).toEqual(demo.two);
      }
    }
  });
});
