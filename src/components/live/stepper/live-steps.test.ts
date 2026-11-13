import { describe, expect, it } from "vitest";

import { BRAND_COPY } from "@/components/brand/copy";
import { CEREMONY_COPY } from "@/components/ceremony/copy";
import type { Stage } from "@/components/ceremony/stages";
import type { FlowState } from "@/components/reveal/opening-machine";

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
  stepForFlowPhase,
  stepForStage,
  stepName,
  type LiveStep,
} from "./live-steps";

// Changed in issue #385: the seal break ("Break the seal") is a sixth step
// between Testify and See the receipts, so the stepper shows it until the seal
// is broken. Spec 11 (L1.6) had five steps with no break step.
describe("step order and names", () => {
  it("lists the six steps in the order write, seal, wait, testify, break, receipts", () => {
    expect([...LIVE_STEPS]).toEqual([
      "write",
      "seal",
      "wait",
      "testify",
      "break",
      "receipts",
    ]);
  });

  it("names the steps Write, Press the seal, Wait, Testify, Break the seal, See the receipts", () => {
    expect([...LIVE_STEP_NAMES]).toEqual([
      "Write",
      "Press the seal",
      "Wait",
      "Testify",
      "Break the seal",
      "See the receipts",
    ]);
  });

  it("takes the names from Brand_Copy and CEREMONY_COPY, Wait from LIVE_COPY", () => {
    const ritual = BRAND_COPY.ritualSteps.map((step) => step.name);
    expect(LIVE_STEP_NAMES[0]).toBe(ritual[0]);
    expect(LIVE_STEP_NAMES[1]).toBe(ritual[1]);
    expect(LIVE_STEP_NAMES[2]).toBe(LIVE_COPY.waitStep);
    expect(LIVE_STEP_NAMES[3]).toBe(ritual[2]);
    expect(LIVE_STEP_NAMES[4]).toBe(CEREMONY_COPY.steps[1]);
    expect(LIVE_STEP_NAMES[5]).toBe(ritual[3]);
  });

  it("gives each step its name", () => {
    expect(stepName("seal")).toBe("Press the seal");
    expect(stepName("wait")).toBe("Wait");
  });

  it("uses the headline the spec gives for /demo/live", () => {
    expect(LIVE_COPY.liveHeading).toBe("Seal your own letter");
  });
});

// Issue #385: stepForStage maps the reveal Stage to the Break and Receipts
// steps. stepForFlowPhase no longer moves on reveal, so Break is reached from
// the Stage (the seal break) and not from the flow phase.
describe("stepForStage (issue #385)", () => {
  it("maps marks and seal to the break step", () => {
    expect(stepForStage("marks")).toBe("break");
    expect(stepForStage("seal")).toBe("break");
  });

  it("maps letter, figures and close to the receipts step", () => {
    expect(stepForStage("letter")).toBe("receipts");
    expect(stepForStage("figures")).toBe("receipts");
    expect(stepForStage("close")).toBe("receipts");
  });

  it("returns null for the Stages before the seal break and for error", () => {
    const earlier: Stage[] = [
      "emerging",
      "sealed",
      "envelope",
      "recall",
      "error",
    ];
    for (const stage of earlier) {
      expect(stepForStage(stage), stage).toBeNull();
    }
  });
});

describe("stepForFlowPhase (issue #385)", () => {
  it("keeps testify for recall, submitting and submit_failed", () => {
    expect(stepForFlowPhase("recall")).toBe("testify");
    expect(stepForFlowPhase("submitting")).toBe("testify");
    expect(stepForFlowPhase("submit_failed")).toBe("testify");
  });

  it("returns null for reveal, so the reveal Stage moves the stepper", () => {
    expect(stepForFlowPhase("reveal")).toBeNull();
  });

  it("returns null for every other phase", () => {
    const others: FlowState["tag"][] = [
      "loading",
      "sealed",
      "openable",
      "awaiting_key",
      "unlocking",
      "verifying",
    ];
    for (const tag of others) {
      expect(stepForFlowPhase(tag), tag).toBeNull();
    }
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
    const later: LiveStep[] = ["wait", "testify", "break", "receipts"];
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
    // Testify, the seal break and Receipts keep the flow mounted even if the
    // countdown state is reported as not done, so a later re-render cannot
    // unmount it.
    expect(flowMounted("testify", false)).toBe(true);
    expect(flowMounted("break", false)).toBe(true);
    expect(flowMounted("receipts", false)).toBe(true);
    expect(flowPortalTarget(host, "testify", false)).toBe(host);
    expect(flowPortalTarget(host, "break", false)).toBe(host);
    expect(flowPortalTarget(host, "receipts", false)).toBe(host);
  });
});

// Issue #385: a STAGE action stores the reveal Stage and moves the stepper
// forward to the step that Stage maps to, in the same update.
describe("reduceStepper STAGE (issue #385)", () => {
  it("starts with the emerging Stage stored", () => {
    expect(initialStepperState().stage).toBe("emerging");
  });

  it("moves to the seal break step at marks", () => {
    const state = reduceStepper(initialStepperState("testify"), {
      type: "STAGE",
      stage: "marks",
    });
    expect(state.step).toBe("break");
    expect(state.stage).toBe("marks");
  });

  // The Skip_Link on marks sends SHOW_ALL, so the Stage becomes letter. The
  // indicator must reach See the receipts in that same update, not in two.
  it("moves to See the receipts at letter, in one update", () => {
    const state = reduceStepper(initialStepperState("break"), {
      type: "STAGE",
      stage: "letter",
    });
    expect(state.step).toBe("receipts");
    expect(state.stage).toBe("letter");
  });

  it("keeps the step for a Stage that maps to no step, and stores the Stage", () => {
    const state = reduceStepper(initialStepperState("testify"), {
      type: "STAGE",
      stage: "recall",
    });
    expect(state.step).toBe("testify");
    expect(state.stage).toBe("recall");
  });

  it("never moves the step back for an earlier Stage", () => {
    const state = reduceStepper(initialStepperState("receipts"), {
      type: "STAGE",
      stage: "marks",
    });
    expect(state.step).toBe("receipts");
    expect(state.stage).toBe("marks");
  });

  it("returns the same state when nothing changes", () => {
    const state = reduceStepper(initialStepperState("break"), {
      type: "STAGE",
      stage: "marks",
    });
    expect(reduceStepper(state, { type: "STAGE", stage: "marks" })).toBe(state);
  });

  it("keeps Back unavailable after the seal is stored, whatever the Stage", () => {
    let state = initialStepperState("seal");
    state = reduceStepper(state, { type: "SEALED" });
    state = reduceStepper(state, { type: "STAGE", stage: "marks" });
    expect(state.step).toBe("break");
    expect(canGoBack(state.step, state.sealed)).toBe(false);
  });
});

