import { describe, expect, it } from "vitest";

import { REVEAL_COPY } from "./copy";
import { letterTrackStep } from "./letter-track";
import type { FlowState } from "./opening-machine";

/**
 * Tests for the three-step track on `/l/{id}` (spec 15, R10.1, R10.2). Each
 * flow tag maps to one of unlock (0), Testify (1) or receipts (2), and the
 * still-sealed state shows no track.
 */

describe("letterTrackStep", () => {
  it("is unlock (0) while the letter is fetched and the key is asked for", () => {
    for (const tag of [
      "loading",
      "openable",
      "awaiting_key",
      "unlocking",
      "verifying",
    ] as const) {
      expect(letterTrackStep(tag), tag).toBe(0);
    }
  });

  it("is Testify (1) from the recall step to the reading view", () => {
    for (const tag of [
      "recall",
      "submitting",
      "submit_failed",
      "reading",
    ] as const) {
      expect(letterTrackStep(tag), tag).toBe(1);
    }
  });

  it("is receipts (2) on the reveal", () => {
    expect(letterTrackStep("reveal")).toBe(2);
  });

  it("is null while the letter is still sealed, so only the notice shows (R10.2)", () => {
    expect(letterTrackStep("sealed")).toBeNull();
  });

  it("is null for the error states, which have no step", () => {
    for (const tag of [
      "not_placed",
      "unreachable",
      "verification_failed",
      "open_failed",
    ] as const) {
      expect(letterTrackStep(tag as FlowState["tag"]), tag).toBeNull();
    }
  });

  it("names the three steps in order", () => {
    expect([...REVEAL_COPY.letterTrackSteps]).toEqual([
      "Unlock",
      "Remember",
      "Receipts",
    ]);
  });
});
