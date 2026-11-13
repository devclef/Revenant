import { describe, expect, it } from "vitest";

import { lineOf, readSourceFiles } from "./source-scan";

/**
 * Type-scope guard (spec 09, L2.3; design.md "L. Letters and type", Type scale
 * and Guards). The serif (EB Garamond, --font-serif) is the Letter_Text alone.
 * Only the Letter_Text module may set it; every other CSS file stays in the
 * sans. This test fails if any CSS file other than the Letter_Text module sets
 * `font-family` to a serif or references `--font-serif`.
 *
 * The Letter_Text module is reveal.module.css, whose `.letter` rule is the
 * sealed letter text (see src/components/reveal/retired-tokens.test.ts, which
 * fixes the same contract). CSS comments are stripped before scanning, so a
 * comment that merely names the serif font variable (e.g. globals.css noting
 * the fallbacks) is not a violation; only a real declaration is.
 */

const LETTER_TEXT_MODULE = "src/components/reveal/reveal.module.css";

/**
 * The serif modules: the sealed letter text (reveal) and the letter textarea on
 * the live Write step (live/letter-field, spec 09 W1). Nothing else sets it.
 */
const SERIF_MODULES = new Set([
  LETTER_TEXT_MODULE,
  "src/components/live/letter-field.module.css",
]);

/** `--font-serif` used anywhere, or `font-family`/`font` shorthand naming a serif. */
const SERIF_USE = /--font-serif|font-family\s*:[^;{}]*serif|font\s*:[^;{}]*serif/i;

/** Remove /* ... *\/ CSS comments so a documented mention is not a hit. */
function stripComments(css: string): string {
  // Replace comment bodies with equal-length blank runs so offsets stay aligned.
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

const cssFiles = readSourceFiles(["src"], [".css"]);

describe("the serif stays in the Letter_Text module only", () => {
  it("reads at least one CSS file (the scan is wired up)", () => {
    expect(cssFiles.length).toBeGreaterThan(0);
  });

  it("the Letter_Text module exists and keeps the serif", () => {
    const letterText = cssFiles.find((f) => f.path === LETTER_TEXT_MODULE);
    expect(letterText, `${LETTER_TEXT_MODULE} is scanned`).toBeDefined();
    expect(SERIF_USE.test(stripComments(letterText!.text))).toBe(true);
  });

  it("the live letter field is the only other serif module", () => {
    const field = cssFiles.find(
      (f) => f.path === "src/components/live/letter-field.module.css",
    );
    expect(field, "letter-field.module.css is scanned").toBeDefined();
    expect(SERIF_USE.test(stripComments(field!.text))).toBe(true);
  });

  it("no other CSS file sets a serif or references --font-serif", () => {
    const hits: string[] = [];
    for (const file of cssFiles) {
      if (SERIF_MODULES.has(file.path)) continue;
      const body = stripComments(file.text);
      const match = SERIF_USE.exec(body);
      if (match) hits.push(`${file.path}:${lineOf(body, match.index)}`);
    }
    expect(hits, `serif used outside the Letter_Text module: ${hits.join(", ")}`).toEqual([]);
  });
});
