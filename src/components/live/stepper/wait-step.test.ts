// The Wait step sits on the desk with one Demo label and no wax seal on its
// letter card (issue #588, D2). These checks read the source of the components
// and the step table, so a change to the markup or the step order fails here.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DemoLabel } from "@/components/demo/DemoLabel";
import { DEMO_COPY } from "@/components/demo/copy";
import { WaxSeal } from "@/components/ui/WaxSeal";

import { LIVE_COPY } from "../copy";
import { LIVE_STEPS, LIVE_STEP_NAMES, hasPrimaryCard } from "./live-steps";

const waitStepSource = readFileSync(join(__dirname, "LiveWaitStep.tsx"), "utf8");
const stepperSource = readFileSync(join(__dirname, "LiveStepper.tsx"), "utf8");
const letterCardSource = readFileSync(join(__dirname, "..", "LetterCard.tsx"), "utf8");

describe("Wait step on the desk (issue #588, D2)", () => {
  it("does not render a DemoLabel inside the Wait panel", () => {
    expect(waitStepSource).not.toMatch(/<DemoLabel\b/);
    expect(waitStepSource).not.toMatch(/import \{ DemoLabel \}/);
  });

  it("passes showSeal={false} and showDemoLabel={false} to the keepsakes, so the letter card has no seal and no in-card label", () => {
    expect(waitStepSource).toMatch(/showSeal=\{false\}/);
    expect(waitStepSource).toMatch(/showDemoLabel=\{false\}/);
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

  it("defaults the LetterCard showDemoLabel prop to true", () => {
    expect(letterCardSource).toMatch(/showDemoLabel\s*=\s*true/);
  });

  it("sets the step heading's data-surface from the card flag, paper on a card and desk off it", () => {
    expect(stepperSource).toMatch(
      /data-surface=\{card \? "paper" : "desk"\}/,
    );
    expect(stepperSource).toMatch(/const card = hasPrimaryCard\(state\.step\)/);
  });

  it("renders the Demo label with its data attribute", () => {
    const html = renderToStaticMarkup(createElement(DemoLabel));
    expect(html).toContain("data-demo-label");
    expect(html).toContain(DEMO_COPY.demoLabel);
  });

  it("renders the wax seal with its data attribute", () => {
    const html = renderToStaticMarkup(
      createElement(WaxSeal, { hash: "a".repeat(64) }),
    );
    expect(html).toContain("data-wax-seal");
  });
});
