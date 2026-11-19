// Static-markup tests for the Step_Track (spec 14, S1). Rendered with
// renderToStaticMarkup because the test environment is Node.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LiveStepper } from "./LiveStepper";
import { StepTrack } from "./StepTrack";
import { LIVE_COPY } from "../copy";
import {
  LIVE_STEPS,
  LIVE_STEP_NAMES,
  initialStepperState,
  stepIndex,
} from "./live-steps";

function trackHtml(current: (typeof LIVE_STEPS)[number]): string {
  return renderToStaticMarkup(
    createElement(StepTrack, {
      steps: LIVE_STEP_NAMES,
      current: stepIndex(current),
      label: LIVE_COPY.stepsLabel,
      phoneTemplate: LIVE_COPY.stepTrackPhone,
    }),
  );
}

describe("StepTrack markup", () => {
  it("renders six li items in the order of the steps", () => {
    const html = trackHtml("seal");
    const items = html.match(/<li\b/g) ?? [];
    expect(items).toHaveLength(6);
    expect(html).toContain(">Write<");
    expect(html).toContain(">Press the seal<");
    expect(html).toContain(">Wait<");
    expect(html).toContain(">Testify<");
    expect(html).toContain(">Break the seal<");
    expect(html).toContain(">Receipts<");
  });

  it('puts aria-current="step" on exactly one item', () => {
    for (const step of LIVE_STEPS) {
      const html = trackHtml(step);
      const matches = html.match(/aria-current="step"/g) ?? [];
      expect(matches, step).toHaveLength(1);
    }
  });

  it('marks the current item with data-state="current"', () => {
    const html = trackHtml("testify");
    expect(html).toMatch(/data-state="current"[^>]*aria-current="step"/);
  });

  it("puts data-step-indicator and data-step-track on the root", () => {
    const html = trackHtml("write");
    expect(html).toMatch(/<div[^>]*data-step-indicator[^>]*data-step-track/);
  });

  it("shows the phone text aria-hidden, with the step number and name", () => {
    const html = trackHtml("wait");
    expect(html).toMatch(
      /<p[^>]*aria-hidden="true"[^>]*>Step 3 of 6 · Wait<\/p>/,
    );
  });

  it("adds no role=status, so the stepper keeps one live region", () => {
    for (const step of LIVE_STEPS) {
      expect(trackHtml(step)).not.toContain('role="status"');
    }
  });
});

describe("exactly one role=status across the stepper", () => {
  it("counts one live region in the rendered stepper", () => {
    const html = renderToStaticMarkup(
      createElement(LiveStepper, {
        state: initialStepperState("seal"),
        dispatch: () => undefined,
        renderStep: () => null,
      }),
    );
    const statuses = html.match(/role="status"/g) ?? [];
    expect(statuses).toHaveLength(1);
  });
});

// Keep the CSS path referenced so a rename shows up here as well.
describe("step-track.module.css exists beside the component", () => {
  it("is readable", () => {
    const css = readFileSync(join(__dirname, "step-track.module.css"), "utf8");
    expect(css.length).toBeGreaterThan(0);
  });
});
