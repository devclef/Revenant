// Static-markup tests for LiveStepper and StepIndicator (spec 09, D2). Rendered
// with renderToStaticMarkup, as the other live tests are, because the test
// environment is Node. Effects, including the focus move on a step change, do
// not run here; the stepper's focus rule is tested through movesFocus in
// live-steps.test.ts.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "../copy";

import { LiveStepper, type StepView } from "./LiveStepper";
import {
  LIVE_STEPS,
  LIVE_STEP_NAMES,
  initialStepperState,
  type LiveStep,
} from "./live-steps";
import { StepIndicator } from "./StepIndicator";

function render(
  initialStep: LiveStep,
  content: (view: StepView) => ReactNode = () => null,
): string {
  return renderToStaticMarkup(
    createElement(LiveStepper, {
      state: initialStepperState(initialStep),
      dispatch: () => undefined,
      renderStep: content,
    }),
  );
}

/** The step names in the order the Step_Indicator lists them. */
function indicatorNames(html: string): string[] {
  const list = html.match(/<ol[\s\S]*?<\/ol>/)?.[0] ?? "";
  const names: string[] = [];
  const pattern = /<span class="[^"]*name[^"]*">([^<]*)<\/span>/g;
  for (const match of list.matchAll(pattern)) {
    names.push(match[1] ?? "");
  }
  return names;
}

describe("Step_Indicator", () => {
  it("lists the five steps in order", () => {
    const html = renderToStaticMarkup(
      createElement(StepIndicator, { current: "write" }),
    );
    expect(indicatorNames(html)).toEqual([...LIVE_STEP_NAMES]);
  });

  it('marks only the current step with aria-current="step"', () => {
    const html = renderToStaticMarkup(
      createElement(StepIndicator, { current: "seal" }),
    );
    const matches = html.match(/aria-current="step"/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(html).toContain('data-state="current"');
  });

  it("gives the earlier steps the done state and the later ones todo", () => {
    // Six steps since issue #385: Testify is the fourth, so three are done and
    // two (Break the seal, See the receipts) are todo.
    const html = renderToStaticMarkup(
      createElement(StepIndicator, { current: "testify" }),
    );
    expect(html.match(/data-state="done"/g)).toHaveLength(3);
    expect(html.match(/data-state="todo"/g)).toHaveLength(2);
  });

  it("sits under the data-step-indicator hook and names the list", () => {
    const html = renderToStaticMarkup(
      createElement(StepIndicator, { current: "write" }),
    );
    expect(html).toContain("data-step-indicator");
    expect(html).toContain(`aria-label="${LIVE_COPY.stepsLabel}"`);
  });

  it("announces the step number and name politely", () => {
    const html = renderToStaticMarkup(
      createElement(StepIndicator, { current: "seal" }),
    );
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Step 2 of 6: Press the seal");
  });

  it("announces Wait as step 3 of 6", () => {
    const html = renderToStaticMarkup(
      createElement(StepIndicator, { current: "wait" }),
    );
    expect(html).toContain("Step 3 of 6: Wait");
  });
});

describe("LiveStepper", () => {
  it("renders the current step's heading with focus support", () => {
    const html = render("seal");
    expect(html).toContain('tabindex="-1"');
    expect(html).toMatch(/<h2[^>]*tabindex="-1"[^>]*>Press the seal<\/h2>/);
  });

  it("keeps the data-primary-control and data-card hooks on the Seal step", () => {
    const html = render("seal");
    expect(html).toMatch(/<section[^>]*data-card[^>]*data-step="seal"/);
    expect(html.match(/data-primary-control/g)).toHaveLength(1);
    expect(html).toMatch(/<h2[^>]*>Press the seal<\/h2>/);
  });

  it("puts the step card on a data-card root", () => {
    expect(render("write")).toContain("data-card");
  });

  it("puts the heading, fields and Next inside one data-primary-control group", () => {
    const html = render("write", () =>
      createElement("button", { type: "button" }, "Next"),
    );
    // The hook appears once. The group runs from its opening tag to the card's
    // closing </section>, so nested divs in the step content cannot cut it short.
    expect(html.match(/data-primary-control/g)).toHaveLength(1);
    const start = html.indexOf("data-primary-control");
    const end = html.indexOf("</section>", start);
    expect(end).toBeGreaterThan(start);
    const group = html.slice(start, end);
    expect(group).toContain(">Write</h2>");
    expect(group).toContain(">Next<");
  });

  it("carries the step on the card so the layout check can tell them apart", () => {
    expect(render("testify")).toContain('data-step="testify"');
  });

  it("gives the content the current step and offers no Back on Write", () => {
    let seen: StepView | null = null;
    render("write", (view) => {
      seen = view;
      return null;
    });
    expect(seen).not.toBeNull();
    const view = seen as unknown as StepView;
    expect(view.step).toBe("write");
    expect(view.canGoBack).toBe(false);
    expect(view.draft.text).toBe("");
  });

  it("offers Back on the seal step before sealing", () => {
    let seen: StepView | null = null;
    render("seal", (view) => {
      seen = view;
      return null;
    });
    const view = seen as unknown as StepView;
    expect(view.canGoBack).toBe(true);
  });

  it("renders the step names from Brand_Copy in order on the Step_Indicator", () => {
    const html = render("write");
    expect(indicatorNames(html)).toEqual([...LIVE_STEP_NAMES]);
  });
});

// Spec 12, X1. The Reveal_Host is a sibling after the Primary_Card on every
// step, so the portal target never moves. Testify and Receipts have no card.
describe("LiveStepper Reveal_Host and Primary_Card (X1)", () => {
  it("renders one reveal host as the last child after the card, on every step", () => {
    for (const step of LIVE_STEPS) {
      const html = render(step);
      expect(html.match(/data-reveal-host=""/g)).toHaveLength(1);
      // The host follows the section's closing tag and closes the stepper root.
      expect(html).toMatch(
        /<\/section><div[^>]*data-reveal-host=""[^>]*><\/div><\/div>$/,
      );
    }
  });

  // The host is a sibling of the card's section, not a child of it, so the
  // flow it holds never sits inside the Primary_Card (X1).
  it("keeps the reveal host outside the card section and out of the primary control", () => {
    for (const step of LIVE_STEPS) {
      const html = render(step);
      const host = html.indexOf("data-reveal-host");
      expect(host).toBeGreaterThan(-1);
      const sectionEnd = html.lastIndexOf("</section>", host);
      const primaryStart = html.indexOf("data-primary-control");
      if (primaryStart !== -1) {
        expect(sectionEnd).toBeGreaterThan(primaryStart);
      }
      expect(html.slice(sectionEnd, host)).not.toContain(
        "data-primary-control",
      );
    }
  });

  // The host element is set once by its ref and carries no key, so React keeps
  // the same DOM node, and the portal target, across every re-render (X1).
  it("sets the host from one ref and gives it no key", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/live/stepper/LiveStepper.tsx"),
      "utf8",
    );
    expect(source.match(/ref=\{setHost\}/g)).toHaveLength(1);
    expect(source).not.toMatch(/setHost\(/);
    expect(source).toMatch(
      /<div ref=\{setHost\} className=\{styles\.revealHost\} data-reveal-host="" \/>/,
    );
  });

  it("draws the Primary_Card on write, seal and wait", () => {
    for (const step of ["write", "seal", "wait"] as const) {
      expect(render(step)).toMatch(
        new RegExp(`<section[^>]*data-card=""[^>]*data-step="${step}"`),
      );
    }
  });

  it("draws no Primary_Card on testify or receipts", () => {
    for (const step of ["testify", "receipts"] as const) {
      const html = render(step);
      expect(html).toContain(`data-step="${step}"`);
      expect(html).not.toContain("data-card");
      expect(html).not.toContain("data-primary-control");
      expect(html).not.toContain("<h2");
    }
  });

  it("keeps the heading only on the card steps", () => {
    expect(render("wait")).toMatch(/<h2[^>]*>Wait<\/h2>/);
    expect(render("testify")).not.toMatch(/<h2/);
  });

  it("gives the content no host before the host has mounted", () => {
    let seen: StepView | null = null;
    render("testify", (view) => {
      seen = view;
      return null;
    });
    const view = seen as unknown as StepView;
    expect(view.host).toBeNull();
  });
});
