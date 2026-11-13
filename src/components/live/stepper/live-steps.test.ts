import { describe, expect, it } from "vitest";

import { BRAND_COPY } from "@/components/brand/copy";

import { LIVE_COPY } from "../copy";
import { CLEARED_WRITE_DRAFT, INITIAL_WRITE_DRAFT } from "../write-draft";

import {
  LIVE_STEPS,
  LIVE_STEP_NAMES,
  canGoBack,
  flowMounted,
  flowPortalTarget,
  hasPrimaryCard,
  initialStepperState,
  movesFocus,
  reduceStepper,
  stepName,
  type LiveStep,
} from "./live-steps";

// Changed in L1.6 (spec 11): the figures step is gone, so the stepper has five
// steps. The old six-step expectations were replaced with this order.
describe("step order and names", () => {
  it("lists the five steps in the spec order", () => {
    expect([...LIVE_STEPS]).toEqual([
      "write",
      "seal",
      "wait",
      "testify",
      "receipts",
    ]);
  });

  it("names the steps Write, Press the seal, Wait, Testify, See the receipts", () => {
    expect([...LIVE_STEP_NAMES]).toEqual([
      "Write",
      "Press the seal",
      "Wait",
      "Testify",
      "See the receipts",
    ]);
  });

  it("takes the four names other than Wait from Brand_Copy", () => {
    const ritual = BRAND_COPY.ritualSteps.map((step) => step.name);
    expect(LIVE_STEP_NAMES[0]).toBe(ritual[0]);
    expect(LIVE_STEP_NAMES[1]).toBe(ritual[1]);
    expect(LIVE_STEP_NAMES[3]).toBe(ritual[2]);
    expect(LIVE_STEP_NAMES[4]).toBe(ritual[3]);
  });

  it("gives each step its name", () => {
    expect(stepName("seal")).toBe("Press the seal");
    expect(stepName("wait")).toBe("Wait");
  });

  it("uses the headline the spec gives for /demo/live", () => {
    expect(LIVE_COPY.liveHeading).toBe("Seal your own letter");
  });
});

describe("canGoBack", () => {
  it("offers no Back on the first step", () => {
    expect(canGoBack("write", false)).toBe(false);
  });

  it("offers Back from the seal step before sealing", () => {
    expect(canGoBack("seal", false)).toBe(true);
  });

  it("offers no Back from wait on", () => {
    const later: LiveStep[] = ["wait", "testify", "receipts"];
    for (const step of later) {
      expect(canGoBack(step, false), step).toBe(false);
    }
  });

  it("offers no Back once the seal is stored, on any step", () => {
    for (const step of LIVE_STEPS) {
      expect(canGoBack(step, true), step).toBe(false);
    }
  });
});

describe("movesFocus", () => {
  it("moves focus only when the step changes", () => {
    expect(movesFocus("write", "seal")).toBe(true);
    expect(movesFocus("seal", "seal")).toBe(false);
  });
});

describe("reduceStepper", () => {
  it("starts on Write with an empty draft", () => {
    const state = initialStepperState();
    expect(state.step).toBe("write");
    expect(state.draft).toEqual(INITIAL_WRITE_DRAFT);
    expect(state.sealed).toBe(false);
  });

  it("moves forward one step per NEXT and stops at the last step", () => {
    let state = initialStepperState();
    for (let i = 0; i < 10; i += 1) {
      state = reduceStepper(state, { type: "NEXT" });
    }
    expect(state.step).toBe("receipts");
  });

  // Changed in L1.6: there is no figures step, so Back from the seal step
  // reaches Write in one press. The draft (text, receipts and backup decision)
  // must survive the round trip.
  it("keeps the text, figures and backup decision across Back", () => {
    const initialQuestions = initialStepperState().draft.questions;
    let state = initialStepperState();
    state = reduceStepper(state, {
      type: "DRAFT",
      event: { type: "TEXT_CHANGED", text: "Dear me" },
    });
    state = reduceStepper(state, {
      type: "DRAFT",
      event: { type: "FIGURE_TOGGLED", metricId: "us-gasoline-regular" },
    });
    state = reduceStepper(state, {
      type: "DRAFT",
      event: { type: "BACKUP_CARD_CHANGED", ticked: true },
    });
    state = reduceStepper(state, { type: "NEXT" });
    expect(state.step).toBe("seal");

    state = reduceStepper(state, { type: "BACK" });

    expect(state.step).toBe("write");
    expect(state.draft).toMatchObject({
      text: "Dear me",
      metricIds: ["us-gasoline-regular"],
      warningTicked: false,
      backupCardTicked: true,
      selfReported: [],
    });
    expect(state.draft.questions).toEqual(initialQuestions);
  });

  it("does not go back past the first step", () => {
    const state = initialStepperState();
    expect(reduceStepper(state, { type: "BACK" })).toBe(state);
  });

  it("drops the draft and removes Back once the seal is stored", () => {
    let state = initialStepperState("seal");
    state = reduceStepper(state, {
      type: "DRAFT",
      event: { type: "TEXT_CHANGED", text: "Private words" },
    });
    state = reduceStepper(state, { type: "SEALED" });

    expect(state.sealed).toBe(true);
    expect(state.draft).toEqual(CLEARED_WRITE_DRAFT);
    expect(reduceStepper(state, { type: "BACK" }).step).toBe("seal");
  });

  it("ignores draft changes after the seal is stored", () => {
    let state = initialStepperState("seal");
    state = reduceStepper(state, { type: "SEALED" });
    const after = reduceStepper(state, {
      type: "DRAFT",
      event: { type: "TEXT_CHANGED", text: "Too late" },
    });
    expect(after.draft.text).toBe("");
  });
});

// Spec 12, X1: the Primary_Card is drawn for Write, Seal and Wait only. Testify
// and Receipts sit on the desk, inside the Reveal_Host below the card.
describe("hasPrimaryCard (X1)", () => {
  it("is true for write, seal and wait", () => {
    expect(hasPrimaryCard("write")).toBe(true);
    expect(hasPrimaryCard("seal")).toBe(true);
    expect(hasPrimaryCard("wait")).toBe(true);
  });

  it("is false for testify and receipts", () => {
    expect(hasPrimaryCard("testify")).toBe(false);
    expect(hasPrimaryCard("receipts")).toBe(false);
  });
});

// Spec 12, X1: the flow portals into the host only once the flow is mounted
// (D5.2), so the target is null before zero and stays the host from zero on.
describe("flowPortalTarget (X1)", () => {
  const host = { name: "reveal-host" };

  it("is null before the countdown ends, so no flow is portalled", () => {
    expect(flowPortalTarget(host, "wait", false)).toBeNull();
  });

  it("is the host from zero on the wait step", () => {
    expect(flowPortalTarget(host, "wait", true)).toBe(host);
  });

  it("is the same host on testify and receipts", () => {
    expect(flowPortalTarget(host, "testify", true)).toBe(host);
    expect(flowPortalTarget(host, "receipts", true)).toBe(host);
  });

  it("is null when the host has not mounted yet", () => {
    expect(flowPortalTarget<typeof host>(null, "testify", true)).toBeNull();
  });

  it("is null on the write and seal steps", () => {
    expect(flowPortalTarget(host, "write", true)).toBeNull();
    expect(flowPortalTarget(host, "seal", true)).toBeNull();
  });

  // Not remounted across re-renders (X1): once the flow is mounted, every later
  // step gets the same host object, so the portal container never changes and
  // the flow keeps its state from Wait through Testify to Receipts.
  it("returns the identical host object for every step once mounted", () => {
    const steps: LiveStep[] = ["wait", "testify", "receipts", "wait"];
    const targets = steps.map((step) => flowPortalTarget(host, step, true));
    for (const target of targets) {
      expect(target).toBe(host);
    }
  });

  it("never goes back to null once the flow has mounted", () => {
    // Testify and Receipts keep the flow mounted even if the countdown state
    // is reported as not done, so a later re-render cannot unmount it.
    expect(flowMounted("testify", false)).toBe(true);
    expect(flowMounted("receipts", false)).toBe(true);
    expect(flowPortalTarget(host, "testify", false)).toBe(host);
    expect(flowPortalTarget(host, "receipts", false)).toBe(host);
  });
});
