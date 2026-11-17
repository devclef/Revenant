// Every S1.1 and S1.2 value of the Step_Track, read from its stylesheet
// (spec 14, S1). The stylesheet is the only place these values live, so the
// test reads the file and checks each declaration.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "step-track.module.css"), "utf8");

/** The declarations of the first rule whose selector matches exactly. */
function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

describe("Step_Track stylesheet (S1.1, S1.2)", () => {
  it("sets the step labels to 13px", () => {
    expect(ruleBody(".step")).toMatch(/font-size:\s*13px/);
  });

  it("draws the hairline 36px by 1px in #3a3350", () => {
    const hairline = ruleBody(".step:not(:last-child)::after");
    expect(hairline).toMatch(/width:\s*36px/);
    expect(hairline).toMatch(/height:\s*1px/);
    expect(hairline).toMatch(/background-color:\s*#3a3350/);
  });

  it("sizes the current dot 12px in #ff7b1c with a 4px rgba(255,123,28,.22) halo", () => {
    const current = ruleBody('.step[data-state="current"] .dot');
    expect(current).toMatch(/width:\s*12px/);
    expect(current).toMatch(/height:\s*12px/);
    expect(current).toMatch(/background-color:\s*#ff7b1c/);
    expect(current).toMatch(
      /box-shadow:\s*0 0 0 4px rgba\(255,\s*123,\s*28,\s*0\.22\)/,
    );
  });

  it("gives the current label white and weight 700", () => {
    const label = ruleBody('.step[data-state="current"] .label');
    expect(label).toMatch(/color:\s*#ffffff/);
    expect(label).toMatch(/font-weight:\s*700/);
  });

  it("sizes the done dot 8px in #bdb4dc with a #bdb4dc label", () => {
    const dot = ruleBody('.step[data-state="done"] .dot');
    expect(dot).toMatch(/background-color:\s*#bdb4dc/);
    expect(ruleBody(".dot")).toMatch(/width:\s*8px/);
    expect(ruleBody('.step[data-state="done"] .label')).toMatch(
      /color:\s*#bdb4dc/,
    );
  });

  it("sizes the future dot 8px in #3a3350 with a #8f86ad label", () => {
    expect(ruleBody(".dot")).toMatch(/background-color:\s*#3a3350/);
    expect(ruleBody(".dot")).toMatch(/height:\s*8px/);
    expect(ruleBody(".label")).toMatch(/color:\s*#8f86ad/);
  });

  it("shows the phone text and hides the per-step labels below 600px", () => {
    expect(css).toMatch(/@media \(max-width:\s*599px\)/);
    const phoneRule = ruleBody(".phone");
    expect(phoneRule).toMatch(/display:\s*none/);
    expect(css).toMatch(/\.phone\s*\{[^}]*display:\s*block/);
  });
});
