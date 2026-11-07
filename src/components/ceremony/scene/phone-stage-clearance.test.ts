// Feature: 09-demo-polish (persona first screen, the intact stage below 600 px)
//
// The Ghost is fixed to the window above every Stage card, so the intact seal
// card must start below the Ghost's bottom edge (about 71vh) when the stage is
// scrolled into view. These tests read scene.module.css and check the rule that
// does this, below 600 px only. Pure file read, no DOM.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(resolve(here, "scene.module.css"), "utf8");
const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");

/** The body of the block that starts at `start` (its opening brace onward). */
function blockAt(text: string, start: number): string {
  const open = text.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  throw new Error("unbalanced block");
}

describe("phone intact stage scroll offset (scene.module.css)", () => {
  const selector = '.personaColumn:has(> [data-ceremony="intact"]) [data-stage-content]';
  const start = css.indexOf(selector);

  it("has the rule once, inside a block that only applies below 600 px", () => {
    expect(start).toBeGreaterThan(-1);
    expect(css.indexOf(selector, start + 1)).toBe(-1);
    const mediaStart = css.lastIndexOf("@media", start);
    expect(css.slice(mediaStart, start)).toContain("(max-width: 599.98px)");
  });

  it("offsets the stage content so its top clears the Ghost's bottom (71vh + 16px)", () => {
    const body = blockAt(css, start);
    expect(body).toMatch(/scroll-margin-top:\s*calc\(71vh \+ 16px\);/);
  });

  it("does not pin the intact stage or change its position", () => {
    const mediaStart = css.lastIndexOf("@media", start);
    const block = css.slice(mediaStart, css.indexOf("}\n}", start) + 3);
    expect(block).not.toMatch(/position:\s*absolute/);
    expect(block).not.toMatch(/\bfixed\b/);
  });
});
