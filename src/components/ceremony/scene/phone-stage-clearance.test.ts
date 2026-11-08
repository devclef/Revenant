// Feature: 09-demo-polish (persona first screen, the intact stage below 600 px)
//
// Spec 10 C1.3 removes the intact Stage, so its phone scroll offset
// (scroll-margin-top on the intact stage content) is removed too. These tests
// read scene.module.css and check that the offset is gone, and they keep the
// phone Step_Indicator row rule (spec 10 X2.2 and X2.3). Pure file read, no DOM.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(resolve(here, "scene.module.css"), "utf8");
const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");

describe("phone intact stage scroll offset is removed (scene.module.css, spec 10 C1.3)", () => {
  it("has no intact stage selector and no scroll-margin-top rule", () => {
    expect(css).not.toContain('[data-ceremony="intact"]');
    expect(css).not.toMatch(/scroll-margin-top:/);
  });
});

// Spec 10 X2.2 and X2.3: the Step_Indicator row rule exists below 600 px only.
describe("phone Step_Indicator row (StepIndicator.module.css)", () => {
  const stepCss = readFileSync(
    resolve(here, "..", "..", "ui", "StepIndicator.module.css"),
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, "");

  it("has the phone .steps rule inside a block that only applies below 600 px", () => {
    const mediaStart = stepCss.indexOf("@media (max-width: 599.98px)");
    expect(mediaStart).toBeGreaterThan(-1);
    const phone = stepCss.slice(mediaStart);
    expect(phone).toMatch(/\.steps \{\s*gap: 0\.25rem 0\.75rem;\s*font-size: 0\.8rem;\s*\}/);
    // The base .steps rule stays above the phone block, unchanged.
    expect(stepCss.slice(0, mediaStart)).toMatch(/\.steps \{[^}]*flex-wrap: wrap;/);
  });

  it("keeps each step name on one line (nowrap is set on the items above)", () => {
    expect(stepCss).toMatch(/\.step \{[^}]*white-space: nowrap;/);
    expect(stepCss).toMatch(/\.current \{[^}]*white-space: nowrap;/);
  });
});
