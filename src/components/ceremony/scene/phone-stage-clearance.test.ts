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

// Spec 10 C1.5: the phone Ghost layer is anchored to the top of the document and
// scrolls with the persona page. It is not a fixed or 100 % height box.
describe("phone Ghost layer is anchored to the document (spec 10 C1.5)", () => {
  const phoneBlock = css.match(/@media \(max-width: 599\.98px\) \{\s*\.scene:has\(\[data-persona-column\]\) \.ghostLayer \{([^}]*)\}/)?.[1] ?? "";

  it("targets the Ghost layer under the Scene that holds the persona column", () => {
    // The persona Stage nests the layer inside its ceremony wrapper, so the
    // layer is not a direct child of .scene. A .personaColumn descendant
    // selector never matched, so the rule is scoped with :has on the Scene.
    expect(css).not.toMatch(/\.personaColumn \.ghostLayer/);
    expect(phoneBlock).not.toBe("");
  });

  it("is absolute, inset to the top and full width, at 100vh", () => {
    expect(phoneBlock).toMatch(/position:\s*absolute;/);
    expect(phoneBlock).toMatch(/inset:\s*0 0 auto 0;/);
    expect(phoneBlock).toMatch(/height:\s*100vh;/);
  });

  it("has no top, left, width or 100 % height in the phone rule", () => {
    expect(phoneBlock).not.toMatch(/\btop:/);
    expect(phoneBlock).not.toMatch(/\bleft:/);
    expect(phoneBlock).not.toMatch(/\bwidth:/);
    expect(phoneBlock).not.toMatch(/height:\s*100%/);
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
