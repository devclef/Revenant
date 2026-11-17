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

  it("keeps a non-zero column gap between steps (3rem), not gap: 0.5rem 0", () => {
    const steps = ruleBody(".steps");
    expect(steps).toMatch(/gap:\s*0\.5rem\s+3rem/);
    expect(steps).not.toMatch(/gap:\s*0\.5rem\s+0\b/);
  });

  it("ends each hairline strictly before the next step, with the gap read from the stylesheet", () => {
    // The hairline starts at calc(100% + <offset>rem) and runs for its own
    // width. Its end must sit inside the column gap, with room to spare, so it
    // does not touch the next label at 1280 and 1366 px. Both values are read
    // from the stylesheet, not repeated here.
    const hairline = ruleBody(".step:not(:last-child)::after");
    const offset = hairline.match(/left:\s*calc\(100%\s*\+\s*([\d.]+)rem\)/);
    const width = hairline.match(/width:\s*([\d.]+)px/);
    const gap = ruleBody(".steps").match(/gap:\s*[\d.]+rem\s+([\d.]+)rem/);
    expect(offset).not.toBeNull();
    expect(width).not.toBeNull();
    expect(gap).not.toBeNull();
    const rootPx = 16;
    const endPx =
      Number(offset?.[1]) * rootPx + Number(width?.[1]);
    const columnGapPx = Number(gap?.[1]) * rootPx;
    expect(endPx).toBeLessThan(columnGapPx);
  });

  it("leaves at least 0.5rem (8px) between each hairline end and the next step", () => {
    // Labels at 13px Inter run close to the column gap at 1280 and 1366 px.
    // A margin floor stops a later gap cut from touching the next label.
    const hairline = ruleBody(".step:not(:last-child)::after");
    const offset = hairline.match(/left:\s*calc\(100%\s*\+\s*([\d.]+)rem\)/);
    const width = hairline.match(/width:\s*([\d.]+)px/);
    const gap = ruleBody(".steps").match(/gap:\s*[\d.]+rem\s+([\d.]+)rem/);
    const rootPx = 16;
    const endPx = Number(offset?.[1]) * rootPx + Number(width?.[1]);
    const clearancePx = Number(gap?.[1]) * rootPx - endPx;
    expect(clearancePx).toBeGreaterThanOrEqual(0.5 * rootPx);
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
