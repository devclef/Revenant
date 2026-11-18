// Feature: spec 10 X2.1 (GT1, ghost-over-text)
//
// On the phone the Top_Bar controls ("Turn off motion", "Turn sound on", Skip)
// must not sit over the Ghost_Body_Box at any scroll position. The Ghost is on
// the right of the phone frame and its layer scrolls with the page, so the
// controls go on the left and the brand follows them. These tests read
// scene.module.css and check that the sub-600 px Compact_Top_Bar block carries
// that placement. Pure file read, no DOM. The browser check (layout-check GT1)
// measures the real geometry.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(resolve(here, "scene.module.css"), "utf8");
const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * The body of the first `@media (max-width: 599.98px)` block that contains
 * `marker`. Braces are matched, so nested rules are included.
 */
function phoneBlockWith(marker: string): string {
  const head = "@media (max-width: 599.98px) {";
  let from = css.indexOf(marker);
  while (from !== -1) {
    const start = css.lastIndexOf(head, from);
    if (start !== -1) {
      let depth = 0;
      for (let i = start + head.length - 1; i < css.length; i += 1) {
        if (css[i] === "{") depth += 1;
        if (css[i] === "}") {
          depth -= 1;
          if (depth === 0) return css.slice(start + head.length, i);
        }
      }
    }
    from = css.indexOf(marker, from + 1);
  }
  return "";
}

/** The declarations of every rule with `selector` in `block`, joined. */
function ruleIn(block: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?:^|[\\s}])${escaped}\\s*\\{([^}]*)\\}`, "g");
  return [...block.matchAll(pattern)].map((m) => m[1]).join("\n");
}

describe("phone Top_Bar controls sit on the left, clear of the Ghost (spec 10 X2.1)", () => {
  const block = phoneBlockWith(".controls {\n    flex-wrap: nowrap;");

  it("finds the sub-600 px Compact_Top_Bar block", () => {
    expect(block).not.toBe("");
  });

  it("puts the controls first and the brand after them below 600 px", () => {
    expect(ruleIn(block, ".controls")).toMatch(/order:\s*0;/);
    expect(ruleIn(block, ".brand")).toMatch(/order:\s*1;/);
  });

  it("removes the auto left margin so the controls do not return to the right edge", () => {
    expect(ruleIn(block, ".controls")).toMatch(/margin-left:\s*0;/);
  });

  it("keeps the 44 px icon controls and their names (no display or size change)", () => {
    const control = ruleIn(block, ".control");
    expect(control).toMatch(/width:\s*44px;/);
    expect(control).toMatch(/height:\s*44px;/);
  });

  it("does not move the controls back to the right with an order above the brand", () => {
    // The base rule sets .controls to order 2. The phone rule must win over it,
    // so the phone block must declare the order itself, not rely on the base.
    expect(ruleIn(block, ".controls")).not.toMatch(/order:\s*2;/);
  });
});

describe("phone Top_Bar height and notice row (spec 14 B1.2, B1.4)", () => {
  const block = phoneBlockWith(".controls {\n    flex-wrap: nowrap;");

  it("keeps a page without the persona notice at one 56 px row", () => {
    const bar = ruleIn(block, ".topbar");
    expect(bar).toMatch(/flex-wrap:\s*nowrap;/);
    expect(bar).toMatch(/height:\s*56px;/);
    expect(bar).toMatch(/max-height:\s*56px;/);
  });

  it("lets the persona bar wrap, so the notice takes the second row", () => {
    const personaBar = ruleIn(
      block,
      '.topbar:has([data-topbar-slot="notice"])',
    );
    expect(personaBar).toMatch(/flex-wrap:\s*wrap;/);
    expect(personaBar).toMatch(/height:\s*auto;/);
  });

  it("caps the persona bar at 96 px (TOP_BAR_MAX_PX)", () => {
    expect(ruleIn(block, '.topbar:has([data-topbar-slot="notice"])')).toMatch(
      /max-height:\s*96px;/,
    );
  });

  it("gives the notice a full-width basis, so it never shares the first row", () => {
    // The base .notice rule sits outside the phone block, so read the whole file.
    expect(ruleIn(css, ".notice")).toMatch(/flex-grow:\s*1;/);
    expect(ruleIn(css, ".notice")).toMatch(/flex-basis:\s*100%;/);
  });
});

describe("Top_Bar slot boxes do not change by Stage or sequence (spec 14 B1.2)", () => {
  it("fixes the chip, Calm, sound and Skip boxes with flex: none", () => {
    expect(ruleIn(css, ".chip")).toMatch(/flex:\s*none;/);
    expect(ruleIn(css, ".control")).toMatch(/flex:\s*none;/);
    expect(ruleIn(css, ".brand")).toMatch(/flex:\s*none;/);
  });

  it("keeps the disabled Skip at 40 % opacity", () => {
    expect(ruleIn(css, '[data-topbar-slot="skip"]:disabled')).toMatch(
      /opacity:\s*0\.4;/,
    );
  });
});
