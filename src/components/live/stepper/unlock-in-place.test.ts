import { describe, expect, it } from "vitest";

import {
  flowMounted,
  initialStepperState,
  reduceStepper,
  stepForFlowPhase,
} from "./live-steps";

describe("stepForFlowPhase (D5.4)", () => {
  it("moves to Testify for recall, submitting and submit_failed", () => {
    expect(stepForFlowPhase("recall")).toBe("testify");
    expect(stepForFlowPhase("submitting")).toBe("testify");
    expect(stepForFlowPhase("submit_failed")).toBe("testify");
  });

  it("moves to Receipts for reveal", () => {
    expect(stepForFlowPhase("reveal")).toBe("receipts");
  });

  it("does not move the stepper for the phases before and during unlock", () => {
    for (const tag of [
      "loading",
      "sealed",
      "openable",
      "awaiting_key",
      "unlocking",
      "verifying",
    ] as const) {
      expect(stepForFlowPhase(tag)).toBeNull();
    }
  });
});

describe("flowMounted (D5.2)", () => {
  it("does not mount the flow while the countdown runs on Wait", () => {
    expect(flowMounted("wait", false)).toBe(false);
  });

  it("mounts the flow on Wait once the countdown reaches zero", () => {
    expect(flowMounted("wait", true)).toBe(true);
  });

  it("keeps the flow mounted on Testify and Receipts", () => {
    expect(flowMounted("testify", true)).toBe(true);
    expect(flowMounted("receipts", true)).toBe(true);
  });

  it("never mounts the flow on an earlier step", () => {
    expect(flowMounted("seal", true)).toBe(false);
    expect(flowMounted("seal", false)).toBe(false);
  });
});

describe("advanceTo (GOTO), forward only", () => {
  it("moves forward to the requested step", () => {
    const state = reduceStepper(initialStepperState("wait"), {
      type: "GOTO",
      step: "testify",
    });
    expect(state.step).toBe("testify");
  });

  it("walks Wait, then Testify, then Receipts in that order", () => {
    let state = initialStepperState("wait");
    state = reduceStepper(state, { type: "GOTO", step: "testify" });
    expect(state.step).toBe("testify");
    state = reduceStepper(state, { type: "GOTO", step: "receipts" });
    expect(state.step).toBe("receipts");
  });

  it("never moves back, and returns the same state object", () => {
    const state = initialStepperState("testify");
    expect(reduceStepper(state, { type: "GOTO", step: "wait" })).toBe(state);
  });

  it("does nothing for the current step", () => {
    const state = initialStepperState("wait");
    expect(reduceStepper(state, { type: "GOTO", step: "wait" })).toBe(state);
  });
});
