// Feature: 07-judge-journey (spec 07 task 2 fix, G1 and G2)
//
// Layout rules for the narrow intact stage in scene.module.css. The seal card
// must sit below the Ghost's eyes and held Envelope at 360 x 640 (G1, no text on
// the Ghost_Body_Box). These tests read the rules from the CSS and check the
// values the fix relies on, so reverting or changing them fails a test. The
// overlap itself is checked in a real browser (see the commit message), not here.
// Pure file read, no DOM.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "scene.module.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** The narrow (max-width 899.98px) block that holds the intact rules. */
function narrowIntactBlock(): string {
  const start = css.indexOf("@media (max-width: 899.98px) {\n  .personaColumn:has(");
  expect(start).toBeGreaterThan(-1);
  const end = css.indexOf("\n}\n", start);
  return css.slice(start, end);
}

/** The value of one declaration inside a block, or null when absent. */
function declaration(block: string, property: string): string | null {
  const match = block.match(new RegExp(`${property}:\\s*([^;]+);`));
  return match === null ? null : match[1].trim();
}

describe("narrow intact stage rules (scene.module.css)", () => {
  it("applies only to the intact stage, through :has() on the persona column", () => {
    const block = narrowIntactBlock();
    expect(block).toContain('.personaColumn:has(> [data-ceremony="intact"])');
    expect(block).toContain('.personaColumn > [data-ceremony="intact"]');
  });

  it("fills the window below the Top_Bar: min-height is the window less the main padding-top", () => {
    // `.main` sets padding-top: 6rem, so the column starts 6rem down the window.
    const mainPaddingTop = css.match(/\.main \{[^}]*padding-top:\s*([^;]+);/);
    expect(mainPaddingTop?.[1].trim()).toBe("6rem");
    expect(declaration(narrowIntactBlock(), "min-height")).toBe("calc(100vh - 6rem)");
  });

  it("pushes the region to the foot of the column with margin-top: auto", () => {
    expect(declaration(narrowIntactBlock(), "margin-top")).toBe("auto");
  });

  it("lowers the region past the foot by a negative margin-bottom of 2.75rem", () => {
    expect(declaration(narrowIntactBlock(), "margin-bottom")).toBe("-2.75rem");
  });

  it("does not change the wide layout: the only intact rule there is the headline size", () => {
    const wide = css.slice(css.indexOf("@media (min-width: 900px)"));
    const selectors = (wide.match(/[^{}]*\[data-ceremony="intact"\][^{}]*\{/g) ?? []).map((m) => m.trim());
    expect(selectors).toEqual(['.personaColumn:has(> [data-ceremony="intact"]) .headline {']);
  });
});

describe("wide intact headline rule (scene.module.css)", () => {
  // At 1280 x 800 the seal card must end above soilTopPx (592). The headline
  // size on the intact stage is what brings the card up; these values are the
  // ones the browser check measured (card bottom near y 575).
  function intactHeadlineRule(): string {
    const wide = css.slice(css.indexOf("@media (min-width: 900px)"));
    const start = wide.indexOf('.personaColumn:has(> [data-ceremony="intact"]) .headline');
    expect(start).toBeGreaterThan(-1);
    return wide.slice(start, wide.indexOf("}", start));
  }

  it("applies only to the intact stage, through :has() on the persona column", () => {
    expect(intactHeadlineRule()).toContain('.personaColumn:has(> [data-ceremony="intact"]) .headline');
  });

  it("caps the intact headline at 13ch so it wraps to three lines", () => {
    expect(declaration(intactHeadlineRule(), "max-width")).toBe("13ch");
  });

  it("sizes the intact headline at most 3.5rem so the card clears the soil strip", () => {
    expect(declaration(intactHeadlineRule(), "font-size")).toBe("clamp(2.5rem, 4.4vw, 3.5rem)");
  });
});
