// Feature: 09-demo-polish, A8 (controls fit) and A12 (focus only for the keyboard).
//
// These tests read the stylesheets and check the rules the spec names: a
// heading that takes focus from a script or a pointer draws no outline, every
// control keeps a :focus-visible ring, and no button label is forced onto one
// line or given a fixed width. The repo has no DOM test environment, so the
// rules are read from source (the house style, see region-outline.test.ts).

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const componentsRoot = resolve(here, "..");
const appRoot = resolve(here, "..", "..", "app");

const read = (path: string): string => readFileSync(path, "utf8");

const globalsCss = read(resolve(appRoot, "globals.css"));
const ceremonyCss = read(resolve(componentsRoot, "ceremony", "ceremony.module.css"));
const revealCss = read(resolve(componentsRoot, "reveal", "reveal.module.css"));
const liveCss = read(resolve(componentsRoot, "live", "live.module.css"));
const recallPagerCss = read(
  resolve(componentsRoot, "ceremony", "recall", "RecallPager.module.css"),
);

/** The declaration block of the first rule whose selector is exactly `selector`. */
function blockOf(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (match === null) {
    throw new Error(`no rule for ${selector}`);
  }
  return match[1] ?? "";
}

describe("A12.1: a heading focused by script or pointer draws no outline", () => {
  it("hides the outline on heading elements with tabIndex -1 unless :focus-visible matches", () => {
    expect(globalsCss).toMatch(
      /:where\(h1, h2, h3, h4, h5, h6\)\[tabindex="-1"\]:focus:not\(:focus-visible\)\s*\{\s*outline:\s*none;/,
    );
  });

  it("removes the generic .desk and .onPaper :focus rings", () => {
    expect(ceremonyCss).not.toMatch(/\.desk :focus\s*\{/);
    expect(ceremonyCss).not.toMatch(/\.onPaper :focus\s*\{/);
  });

  it("gives the figures heading a ring for the keyboard only", () => {
    expect(revealCss).toMatch(/\.figuresThenNow h2:focus-visible\s*\{/);
    expect(revealCss).not.toMatch(/h2:focus\s*\{/);
  });

  it("keeps the ring on the Ceremony headings for the keyboard (:focus-visible)", () => {
    expect(blockOf(ceremonyCss, ".desk :focus-visible")).toMatch(/outline:\s*2px solid var\(--text\)/);
  });
});

describe("A12.2: every control keeps a :focus-visible ring", () => {
  it("has a :focus-visible rule for each control class", () => {
    expect(blockOf(ceremonyCss, ".deskControl:focus-visible")).toMatch(/outline:\s*2px/);
    expect(revealCss).toMatch(/\.button:focus-visible\s*\{\s*outline:\s*2px/);
    expect(recallPagerCss).toMatch(/\.cta:focus-visible,/);
    expect(recallPagerCss).toMatch(/\.link:focus-visible,/);
    expect(liveCss).toMatch(/\.primary:focus-visible,/);
    expect(liveCss).toMatch(/\.secondary:focus-visible\s*\{/);
  });

  it("gives the Caption_Block its own light focus ring on the dark (spec 09 L6.2; replaces the spec 07 R3.15 white Letter_Block ring)", () => {
    const letterCss = read(resolve(componentsRoot, "ceremony", "letter", "LetterBlock.module.css"));
    expect(letterCss).toMatch(/\.caption :focus-visible\s*\{\s*outline:\s*2px solid var\(--text/);
  });
});

describe("A12.3: the Figures_Heading focus move still lands on that heading", () => {
  const figuresSource = read(resolve(componentsRoot, "reveal", "FiguresThenNow.tsx"));
  const rootSource = read(resolve(componentsRoot, "ceremony", "CeremonyRoot.tsx"));

  it("keeps the Figures_Heading focusable (tabIndex -1) with its marker", () => {
    expect(figuresSource).toMatch(/<h2 tabIndex=\{-1\} data-figures-heading="">/);
  });

  it("keeps the focus move to figures-heading in CeremonyRoot", () => {
    expect(rootSource).toMatch(/figures-heading/);
    expect(rootSource).toMatch(/heading\.focus\(\{ preventScroll: true \}\)/);
  });
});

describe("A8.1: button labels wrap and have no fixed width", () => {
  const buttons: Array<[string, string, string]> = [
    ["reveal/reveal.module.css", revealCss, ".button"],
    ["ceremony/ceremony.module.css", ceremonyCss, ".deskControl"],
    ["ceremony/recall/RecallPager.module.css", recallPagerCss, ".cta"],
    ["ceremony/recall/RecallPager.module.css", recallPagerCss, ".link"],
    ["live/live.module.css", liveCss, ".primary"],
    ["live/live.module.css", liveCss, ".secondary"],
  ];

  for (const [file, css, selector] of buttons) {
    it(`${file} ${selector} wraps and sets no nowrap or fixed width`, () => {
      const body = blockOf(css, selector);
      expect(body).not.toMatch(/white-space:\s*nowrap/);
      expect(body).toMatch(/white-space:\s*normal/);
      expect(body).not.toMatch(/(?:^|[;\s])width:/);
    });
  }
});

describe("A8.4: cards and fieldsets allow shrinking", () => {
  it("gives the live card min-width 0", () => {
    expect(blockOf(liveCss, ".card")).toMatch(/min-width:\s*0/);
  });

  it("gives the reveal and recall fieldsets min-width 0", () => {
    expect(blockOf(revealCss, ".fieldset")).toMatch(/min-width:\s*0/);
    expect(blockOf(recallPagerCss, ".fieldset")).toMatch(/min-width:\s*0/);
  });
});

describe("A8.4: button labels are not shrunk below body text size", () => {
  it("keeps the narrow Next control at body text size", () => {
    const narrow = /@media \(max-width: 899px\) \{([\s\S]*?)\n\}/.exec(recallPagerCss);
    expect(narrow).not.toBeNull();
    const cta = /\.cta\s*\{([^}]*)\}/.exec(narrow?.[1] ?? "");
    expect(cta).not.toBeNull();
    expect(cta?.[1]).toMatch(/font-size:\s*1rem/);
  });
});
