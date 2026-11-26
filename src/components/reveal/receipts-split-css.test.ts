// Feature: 15-the-flow, R12.2 (the receipts split).
//
// The repo has no DOM test environment, so these tests read the stylesheet and
// pin the split rules: two equal tracks from 900 px, a sticky letter column that
// scrolls on its own, and no accent colour in the split. The house style is in
// focus-rings.test.ts.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "receipts.module.css"), "utf8");

/** The text of the `@media (min-width: 900px)` block, from its opening brace to the end of the file. */
function splitMediaBlock(source: string): string {
  const start = source.indexOf("@media (min-width: 900px)");
  if (start === -1) return "";
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return source.slice(open + 1);
}

/** The declaration block of the first rule whose selector is exactly `selector`, inside `source`. */
function blockOf(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(source);
  return match === null ? "" : match[1];
}

const media = splitMediaBlock(css);

describe("receipts split CSS (R12.2)", () => {
  it("has a min-width 900px media query that holds the split rules", () => {
    expect(media).not.toBe("");
  });

  it("lays the split out as a grid with two minmax(280px, 1fr) tracks", () => {
    const body = blockOf(media, '.receipts[data-receipts-layout="split"]');
    expect(body).toMatch(/display:\s*grid;/);
    expect(body).toMatch(
      /grid-template-columns:\s*minmax\(280px,\s*1fr\)\s+minmax\(280px,\s*1fr\);/,
    );
  });

  it("keeps the receipts inline size, max inline size and inline margins", () => {
    const base = blockOf(css, ".receipts");
    expect(base).toMatch(/inline-size:\s*100%;/);
    expect(base).toMatch(/max-inline-size:\s*var\(--content-column-max\);/);
    expect(base).toMatch(/margin-inline:\s*auto;/);
  });

  it("places the letter in the second track across the three rows", () => {
    const body = blockOf(media, '.receipts[data-receipts-layout="split"] .letterColumn');
    expect(body).toMatch(/grid-column:\s*2;/);
    expect(body).toMatch(/grid-row:\s*1\s*\/\s*span 3;/);
  });

  it("makes the letter column sticky from the top bar clearance", () => {
    const body = blockOf(media, '.receipts[data-receipts-layout="split"] .letterColumn');
    expect(body).toMatch(/position:\s*sticky;/);
    expect(body).toMatch(/top:\s*var\(--topbar-clear\);/);
  });

  it("lets the letter column scroll on its own and keeps the scroll inside it", () => {
    const body = blockOf(media, '.receipts[data-receipts-layout="split"] .letterColumn');
    expect(body).toMatch(/overflow-y:\s*auto;/);
    expect(body).toMatch(/overscroll-behavior:\s*contain;/);
  });

  it("uses no accent colour in the split rules", () => {
    expect(media).not.toMatch(/--accent/);
  });
});
