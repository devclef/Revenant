// Feature: 07-judge-journey, spec 07 task 2: one emerging status line.
//
// The emerging Stage's role=status line and the envelope's visible statement
// must be the same string. This pins emergingStatus to the REVEAL_COPY strings
// the envelope uses, and checks the old line is gone from the Stage copy.

import { describe, expect, it } from "vitest";

import { CEREMONY_COPY } from "./copy";
import { emergingStatus } from "./stages";
import { REVEAL_COPY } from "../reveal/copy";

describe("emergingStatus (one line for the emerging Stage)", () => {
  it("gives the loading statement for loading", () => {
    expect(emergingStatus("loading")).toBe("Bringing the letter into the light.");
    expect(emergingStatus("loading")).toBe(REVEAL_COPY.loading);
  });

  it("gives the verifying statement for openable and verifying", () => {
    expect(emergingStatus("openable")).toBe("Checking the seal.");
    expect(emergingStatus("verifying")).toBe("Checking the seal.");
    expect(emergingStatus("verifying")).toBe(REVEAL_COPY.verifying);
  });

  it("no longer has the old 'being brought out' line in the Stage copy", () => {
    expect(JSON.stringify(CEREMONY_COPY)).not.toContain("being brought out");
  });
});
