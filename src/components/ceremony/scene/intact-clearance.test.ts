// Feature: 07-judge-journey (spec 07 task 2 fix, G1 and G2)
//
// Spec 10 C1.3 removes the intact Stage. The narrow and wide rules that placed
// the intact seal card are gone with it. These tests read scene.module.css and
// check that no intact rule is left, that the rules for recall, marks and seal
// (the pinned stages) are kept, and that the step-row reserve stays out of the
// narrow block. Pure file read, no DOM.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "scene.module.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** The narrow (max-width 899.98px) block that holds the pinned stage rules. */
function narrowBlock(): string {
  const start = css.indexOf(
    '@media (max-width: 899.98px) {\n  .personaColumn:has(> [data-ceremony="recall"]),',
  );
  expect(start).toBeGreaterThan(-1);
  const end = css.indexOf("\n}\n", start);
  return css.slice(start, end);
}

/** The value of one declaration inside a block, or null when absent. */
function declaration(block: string, property: string): string | null {
  const match = block.match(new RegExp(`${property}:\\s*([^;]+);`));
  return match === null ? null : match[1].trim();
}

describe("the intact Stage is removed from scene.module.css (spec 10 C1.3)", () => {
  it("has no rule that names the intact Stage", () => {
    expect(css).not.toContain('data-ceremony="intact"');
  });

  it("has no wide intact headline size, so the headline keeps its base size in emerging", () => {
    expect(css).not.toContain("13ch");
    expect(css).not.toContain("clamp(2.5rem, 4.4vw, 3.5rem)");
  });
});

describe("narrow pinned stage rules (scene.module.css)", () => {
  it("applies the pinned rules to recall, marks and seal only, through :has() on the persona column", () => {
    const block = narrowBlock();
    expect(block).toContain('.personaColumn:has(> [data-ceremony="recall"])');
    expect(block).toContain('.personaColumn:has(> [data-ceremony="marks"])');
    expect(block).toContain('.personaColumn:has(> [data-ceremony="seal"])');
  });

  it("keeps recall, marks and seal pinned, not the flow layout", () => {
    expect(narrowBlock()).toContain('.personaColumn > [data-ceremony="recall"],');
    expect(declaration(narrowBlock(), "position")).toBe("absolute");
  });

  it("fills the window below the Top_Bar: min-height is the window less the main padding-top", () => {
    // `.main` sets padding-top: 6rem, so the column starts 6rem down the window.
    const mainPaddingTop = css.match(/\.main \{[^}]*padding-top:\s*([^;]+);/);
    expect(mainPaddingTop?.[1].trim()).toBe("6rem");
    expect(declaration(narrowBlock(), "min-height")).toBe("calc(100vh - 6rem)");
  });

  it("places the pinned region top at the Soil strip bottom (soil-top + soil-band), less the main padding", () => {
    expect(declaration(narrowBlock(), "top")).toBe(
      "calc(var(--soil-top) + var(--soil-band) + 0.25rem - 6rem)",
    );
  });
});

// Spec 10 X2.1 and G3: this step adds the step-row reserve below 600 px only.
describe("the step-row reserve stays out of the narrow pinned block (spec 10 X2)", () => {
  it("keeps the step-row reserve inside the phone block, not the narrow block", () => {
    const reserveAt = css.indexOf("[data-step-indicator]");
    expect(reserveAt).toBeGreaterThan(-1);
    const mediaStart = css.lastIndexOf("@media", reserveAt);
    expect(css.slice(mediaStart, reserveAt)).toContain("(max-width: 599.98px)");
    expect(narrowBlock()).not.toContain("[data-step-indicator]");
  });
});
