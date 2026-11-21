import { describe, expect, it } from "vitest";

import { CEREMONY_COPY } from "../../components/ceremony/copy";

import {
  CALM_STATES,
  PRESS_HOLD_MS,
  PRESS_SIZES,
  PRESS_TARGETS,
  STEP_CHANGE_BUDGET_MS,
  calmToggleNeeded,
  checkPressScroll,
  checkPressStepChange,
  isCalmOnFromLabel,
  pressRunLabel,
  scrollHeld,
} from "./press-test-helpers";

describe("Press_Test helpers (spec 16, 1.11 and 1.12)", () => {
  it("covers the two viewports and the hold time from the spec", () => {
    expect(PRESS_SIZES.map((s) => `${s.width}x${s.height}`)).toEqual([
      "1440x900",
      "390x844",
    ]);
    expect(PRESS_HOLD_MS).toBe(600);
    expect(STEP_CHANGE_BUDGET_MS).toBe(2000);
  });

  it("names every press target of Requirement 1.12", () => {
    expect(PRESS_TARGETS.map((t) => t.id)).toEqual([
      "occasion-pill",
      "suggestion-pill",
      "write-my-own",
      "receipt-toggle",
      "remove",
      "fold",
    ]);
  });

  it("tests both Calm states", () => {
    expect([...CALM_STATES]).toEqual([true, false]);
  });

  describe("scrollHeld", () => {
    it("is true when the scroll position did not move", () => {
      expect(scrollHeld(420, 420)).toBe(true);
    });

    it("is false when the page scrolled during the press", () => {
      expect(scrollHeld(420, 436)).toBe(false);
    });
  });

  describe("checkPressScroll", () => {
    it("passes when scrollY is the same at pointer down and up", () => {
      const result = checkPressScroll({
        target: "the Fold_Button",
        before: 0,
        after: 0,
      });
      expect(result.ok).toBe(true);
      expect(result.message).toMatch(/^PASS /);
    });

    it("fails and names both positions when the page scrolled", () => {
      const result = checkPressScroll({
        target: "the Fold_Button",
        before: 300,
        after: 512,
      });
      expect(result.ok).toBe(false);
      expect(result.message).toContain("300 at pointer down");
      expect(result.message).toContain("512 at pointer up");
    });
  });

  describe("checkPressStepChange", () => {
    it("passes when Press the seal is current within the budget", () => {
      const result = checkPressStepChange({
        currentStep: "Press the seal",
        elapsedMs: 150,
      });
      expect(result.ok).toBe(true);
    });

    it("fails when the current step is still Write after the budget", () => {
      const result = checkPressStepChange({
        currentStep: "Write",
        elapsedMs: null,
      });
      expect(result.ok).toBe(false);
      expect(result.message).toContain('"Write"');
      expect(result.message).toContain("never within the wait");
    });

    it("fails when Press the seal arrives later than the budget", () => {
      const result = checkPressStepChange({
        currentStep: "Press the seal",
        elapsedMs: 2500,
      });
      expect(result.ok).toBe(false);
      expect(result.message).toContain("after 2500 ms");
    });
  });

  describe("Calm state", () => {
    it("reads calm as on when the control offers to turn motion back on", () => {
      expect(isCalmOnFromLabel(CEREMONY_COPY.calmOff)).toBe(true);
      expect(isCalmOnFromLabel(CEREMONY_COPY.calmOn)).toBe(false);
    });

    it("presses the control only when the current state differs", () => {
      expect(calmToggleNeeded(CEREMONY_COPY.calmOn, true)).toBe(true);
      expect(calmToggleNeeded(CEREMONY_COPY.calmOn, false)).toBe(false);
    });
  });

  it("builds a readable run label", () => {
    expect(pressRunLabel({ width: 390, height: 844 }, true, "touch tap")).toBe(
      "390x844, calm on, touch tap",
    );
  });
});
