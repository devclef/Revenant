// Feature: 09-demo-polish (H2 step 1)
//
// The four ritual cards are list items of one ordered list, in step order.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BRAND_COPY } from "@/components/brand/copy";

import { RitualSection } from "./RitualSection";

const here = fileURLToPath(new URL(".", import.meta.url));
const landingCss = readFileSync(join(here, "landing.module.css"), "utf8");

/** Returns the body of the first top-level block that starts with `prefix`. */
function blockAfter(css: string, prefix: string): string {
  const start = css.indexOf(prefix);
  if (start === -1) return "";
  const open = css.indexOf("{", start);
  let depth = 1;
  let end = open + 1;
  while (end < css.length && depth > 0) {
    if (css[end] === "{") depth++;
    if (css[end] === "}") depth--;
    end++;
  }
  return css.slice(open + 1, end - 1);
}

describe("RitualSection list markup", () => {
  it("renders the four cards as li elements of one ol, in step order", () => {
    const html = renderToStaticMarkup(<RitualSection />);

    const lists = html.match(/<ol\b[^>]*>[\s\S]*?<\/ol>/g) ?? [];
    expect(lists).toHaveLength(1);
    const list = lists[0] ?? "";
    expect(list).toContain("ritualList");

    const items = list.match(/<li\b[^>]*>[\s\S]*?<\/li>/g) ?? [];
    expect(items).toHaveLength(4);
    expect(list.match(/<li\b/g)?.length).toBe(4);

    BRAND_COPY.ritualSteps.forEach((step, index) => {
      expect(items[index]).toContain("ritualCard");
      expect(items[index]).toContain(`>${index + 1}<`);
      expect(items[index]).toContain(step.name);
      expect(items[index]).toContain(step.line);
    });
  });

  it("lays the ritual cards out as a grid with equal gaps and stretched cards", () => {
    const base = blockAfter(landingCss, ".ritualList {");
    expect(base).toMatch(/display:\s*grid;/);
    expect(base).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\);/);
    expect(base).toMatch(/gap:\s*0\.75rem;/);
    expect(base).toMatch(/align-items:\s*stretch;/);
    expect(base).not.toMatch(/flex/);
  });

  it("uses one, two and four columns at the three breakpoints", () => {
    // The file has two 600 px blocks; the ritual rule sits in the later one.
    const tablet = blockAfter(
      landingCss.slice(landingCss.lastIndexOf("@media (min-width: 600px)")),
      ".ritualList {",
    );
    expect(tablet).toMatch(
      /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
    );

    const desktop = blockAfter(
      landingCss.slice(landingCss.indexOf("@media (min-width: 1024px)")),
      ".ritualList {",
    );
    expect(desktop).toMatch(
      /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/,
    );
  });

  it("gives no colour to the ritual grid or its cards", () => {
    const grid = blockAfter(landingCss, ".ritualList {");
    expect(grid).not.toMatch(/color|background/);
  });
});
