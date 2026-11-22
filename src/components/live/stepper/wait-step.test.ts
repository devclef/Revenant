// The Wait step sits on the desk with one Demo label and no wax seal on its
// letter card (issue #588, D2). These checks read the source of the components
// and the step table, so a change to the markup or the step order fails here.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "../copy";
import { LIVE_STEPS, LIVE_STEP_NAMES, hasPrimaryCard } from "./live-steps";

const waitStepSource = readFileSync(join(__dirname, "LiveWaitStep.tsx"), "utf8");
const letterCardSource = readFileSync(join(__dirname, "..", "LetterCard.tsx"), "utf8");

describe("Wait step on the desk (issue #588, D2)", () => {
  it("does not render a DemoLabel inside the Wait panel", () => {
    expect(waitStepSource).not.toMatch(/DemoLabel/);
  });

  it("passes showSeal={false} to the keepsakes, so the letter card has no wax seal", () => {
    expect(waitStepSource).toMatch(/showSeal=\{false\}/);
  });

  it("keeps the Wait heading string unchanged", () => {
    expect(LIVE_COPY.waitStep).toBe("Wait");
    expect(LIVE_STEP_NAMES[LIVE_STEPS.indexOf("wait")]).toBe("Wait");
  });

  it("keeps the step order unchanged", () => {
    expect([...LIVE_STEPS]).toEqual([
      "write",
      "seal",
      "wait",
      "testify",
      "break",
      "receipts",
    ]);
  });

  it("keeps the Wait step off the primary card", () => {
    expect(hasPrimaryCard("wait")).toBe(false);
  });

  it("defaults the LetterCard showSeal prop to true", () => {
    expect(letterCardSource).toMatch(/showSeal\s*=\s*true/);
  });
});
