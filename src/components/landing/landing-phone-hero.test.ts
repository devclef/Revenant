// Feature: 09-demo-polish (landing hero below 600 px, layout-check LG1)
//
// The Landing_Ghost is drawn at a fixed place in the Scene backdrop, with its
// bottom at about 71vh. Below 600 px the calls to action stay in the flow and
// the reserved ghost box comes before them, so the actions start below the
// drawn ghost (LG1). These tests read landing.module.css and check that rule.
// Pure file read, no DOM.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "landing.module.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** The text of the phone block (max-width 599.98px) that sets the actions order. */
function phoneBlock(): string {
  const start = css.indexOf("@media (max-width: 599.98px) {\n  .actions {");
  expect(start).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("\n}\n", start) + 3);
}

describe("landing hero below 600 px (landing.module.css)", () => {
  it("puts the actions after the reserved ghost box, in the flow", () => {
    const block = phoneBlock();
    expect(block).toMatch(/\.actions \{\s*order: 1;\s*\}/);
    expect(block).not.toMatch(/position:\s*absolute/);
  });

  it("sizes the reserved ghost box to 71vh less 380px, never below zero", () => {
    const block = phoneBlock();
    expect(block).toMatch(/\.ghost \{\s*height: max\(0px, calc\(71vh - 380px\)\);\s*\}/);
  });
});

describe("landing Landing_Ghost box below 600 px (spec 10 X2.5)", () => {
  it("sets the phone ghost box rule inside the phone block, and keeps the base ghost rule outside it", () => {
    const block = phoneBlock();
    expect(block).toMatch(/\.hero \.ghost \{\s*height: max\(0px, calc\(71vh - 380px\)\);\s*\}/);
    // Outside the phone block, the wide ghost rule is still the base 30svh rule.
    expect(css).toMatch(/\.ghost \{\s*width: 100%;\s*height: 30vh;/);
  });
});
