// Feature: 05-reveal-ceremony, issue #119
//
// Source controls use a neutral ink colour, not the wax red (--seal). Up and
// down figures get the same treatment, so no colour implies a direction.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const revealCss = readFileSync(resolve(here, "reveal.module.css"), "utf8");
const figureTsx = readFileSync(resolve(here, "FigureLine.tsx"), "utf8");

/** The colour declared for a selector, or undefined when none is declared. */
function colourFor(css: string, selector: string): string | undefined {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return block?.[1].match(/color:\s*([^;]+);/)?.[1].trim();
}

describe("Source control colour (issue #119)", () => {
  it("the Source summary uses the neutral ink token, not the wax red", () => {
    const colour = colourFor(revealCss, ".source summary");
    expect(colour).toBe("var(--ink)");
    expect(colour).not.toMatch(/--seal\b/);
  });

  it("the reveal stylesheet declares no red or green colour", () => {
    // Literal hex colours that are clearly red or clearly green are the
    // judgement colours neutrality.md rules out.
    const hexes = [...revealCss.matchAll(/#([0-9a-fA-F]{6})\b/g)].map((m) => m[1]);
    for (const hex of hexes) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const red = r > g + 60 && r > b + 60;
      const green = g > r + 40 && g > b + 40;
      expect(red || green, `#${hex} is a judgement colour`).toBe(false);
    }
  });

  it("figure lines carry no direction-specific class or colour", () => {
    expect(figureTsx).not.toMatch(/\b(up|down|increase|decrease|rise|fall)(Class|Colour|Color)\b/i);
    expect(revealCss).not.toMatch(/\.(up|down|increase|decrease|rise|fall)\b/);
  });
});
