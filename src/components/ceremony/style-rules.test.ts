// Focused checks for the persona-page styling rules (contrast, button styling
// and the seal glyph). These are source-level checks, the same way the other
// Ceremony and reveal guards read their CSS and TSX files.
//
// - The seal draws no six-pointed star and no five-point star (neutrality
//   copy test C6: no star symbols on the seal).
// - The letter panel sets a paper surface and its own --ink text colour.
// - Calm and Skip use the shared `.button` class, and that class is defined.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const waxSealSource = readFileSync(
  resolve(here, "envelope", "WaxSeal.tsx"),
  "utf8",
);
const ceremonyRootSource = readFileSync(
  resolve(here, "CeremonyRoot.tsx"),
  "utf8",
);
const ceremonyCss = readFileSync(resolve(here, "ceremony.module.css"), "utf8");
const revealCss = readFileSync(
  resolve(here, "..", "reveal", "reveal.module.css"),
  "utf8",
);

/** The body of the first CSS rule whose selector is exactly `selector`. */
function ruleBody(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) return "";
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

/** The text of the GLYPHS array, from its declaration to the end of the file. */
function glyphSource(): string {
  const start = waxSealSource.indexOf("const GLYPHS");
  expect(start).toBeGreaterThan(-1);
  return waxSealSource.slice(start);
}

describe("seal glyph (no star symbols)", () => {
  it("has no six-point star path", () => {
    // The old six-point star was the two-triangle path starting at M50 37.
    expect(glyphSource()).not.toContain("M50 37 L61 56 L39 56 Z");
  });

  it("has no five-point star path", () => {
    expect(glyphSource()).not.toContain("M50 37 L53.5 47.5");
  });

  it("keeps the glyph count at twelve, so existing seal keys still map", () => {
    const glyphs = glyphSource();
    const entries = glyphs.match(/\/\/ \d+ — /g) ?? [];
    expect(entries).toHaveLength(12);
  });
});

describe("letter panel", () => {
  const letter = ruleBody(revealCss, ".letter");

  it("sets a paper surface", () => {
    expect(letter).toMatch(/background-color:\s*var\(--paper\)/);
  });

  it("sets its text in --ink", () => {
    expect(letter).toMatch(/color:\s*var\(--ink\)/);
  });
});

describe("Calm and Skip controls", () => {
  it("Calm toggle uses the shared button class", () => {
    expect(ceremonyRootSource).toMatch(
      /<button type="button" className=\{styles\.button\} onClick=\{\(\) => setCalm/,
    );
  });

  it("Skip uses the shared button class", () => {
    expect(ceremonyRootSource).toMatch(
      /<button type="button" className=\{styles\.button\} onClick=\{skipAll\}/,
    );
  });

  it("the shared .button class is defined in ceremony.module.css", () => {
    const body = ruleBody(ceremonyCss, ".button");
    expect(body).toMatch(/background-color:\s*var\(--paper-deep\)/);
    expect(body).toMatch(/color:\s*var\(--ink\)/);
  });
});
