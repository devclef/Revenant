// Feature: 07-judge-journey (task 5)
//
// Property 22, break clause (design.md "Property 22", R12.10, R12.9, R12.8): in
// Calm the break plan is empty and the Ghost unmounts in the ADVANCE render.
// The Ghost stays mounted only for the leave of a full-motion break.

import { describe, expect, it } from "vitest";

import { planSealBreak } from "../seal/SealBreak";
import { ghostPresent } from "./ghost-presence";

describe("Property 22: break clause (R12.10, R12.9, R12.8)", () => {
  it("plans no break steps in Calm", () => {
    expect(planSealBreak({ calm: true }).steps).toEqual([]);
  });

  it("unmounts the Ghost in the ADVANCE render when no leave is running (Calm, Skip)", () => {
    expect(ghostPresent({ tag: "reveal", stage: 2, leaving: false })).toBe(false);
  });

  it("keeps the Ghost mounted through the leave of a full-motion break", () => {
    expect(ghostPresent({ tag: "reveal", stage: 2, leaving: true })).toBe(true);
  });

  it("removes the Ghost at once for Show everything, which jumps to stage 3", () => {
    expect(ghostPresent({ tag: "reveal", stage: 3, leaving: false })).toBe(false);
  });
});

describe("Ghost presence before and during the break (design.md \"The dissolve on break\")", () => {
  it("mounts the Ghost for every pre-reveal state, so the envelope is held", () => {
    for (const tag of ["loading", "sealed", "openable", "verifying", "verified", "recall"]) {
      expect(ghostPresent({ tag, stage: null, leaving: false })).toBe(true);
    }
  });

  it("mounts the Ghost while holding the seal at stage 1", () => {
    expect(ghostPresent({ tag: "reveal", stage: 1, leaving: false })).toBe(true);
  });
});
