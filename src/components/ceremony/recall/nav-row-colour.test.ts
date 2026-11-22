// Source test for the Previous question control (issue #578). The control sits
// on the cream paper surface, so its text and border must use the paper ink.
// Pure file reads. No DOM.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = __dirname;

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

const navCss = stripComments(
  readFileSync(resolve(here, "NavRow.module.css"), "utf8"),
);
const navSource = readFileSync(resolve(here, "NavRow.tsx"), "utf8");
const copySource = readFileSync(
  resolve(here, "../../reveal/copy.ts"),
  "utf8",
);

// Body of the .previous rule (not .previous:focus-visible).
const previousRule = (() => {
  const match = navCss.match(/(^|\n)\.previous\s*\{([^}]*)\}/);
  return match ? match[2] : "";
})();

describe("Previous question control colour (issue #578)", () => {
  it("has a .previous rule in NavRow.module.css", () => {
    expect(previousRule).not.toBe("");
  });

  it("sets the text colour to var(--ink)", () => {
    expect(previousRule).toMatch(/(^|[;\s])color:\s*var\(--ink\)\s*;/);
  });

  it("sets a 1px solid var(--ink) border", () => {
    expect(previousRule).toMatch(
      /(^|[;\s])border:\s*1px\s+solid\s+var\(--ink\)\s*;/,
    );
  });

  it("keeps the 'Previous question' label in the Nav_Row", () => {
    // NavRow.tsx renders REVEAL_COPY.previousQuestion, whose value is the string.
    expect(navSource).toContain("REVEAL_COPY.previousQuestion");
    expect(copySource).toContain('previousQuestion: "Previous question"');
  });
});
