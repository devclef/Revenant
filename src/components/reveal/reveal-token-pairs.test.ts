// Feature: 05-reveal-ceremony, issue #119 (WCAG 2.2 AA contrast on reveal surfaces)
//
// Every text colour the reveal draws with is read from reveal.module.css, not
// from a hand-kept list, so a new `color: var(--token)` on a reveal class is
// checked automatically. Each token is resolved to its hex value in the CSS
// that defines it, and its contrast ratio is computed against every surface a
// reveal stage can sit on:
//   - the two ParchmentSurface paper variants (--paper, --paper-deep), which
//     each stage panel uses (StagePanel), and
//   - the ceremony desk (--desk), where the desk text tokens are drawn.
//
// Threshold: 4.5:1 for every text pair. That is the AA bar for normal text and
// is stricter than the 3:1 bar for large text, so headings pass too.
//
// No DOM: plain arithmetic over parsed hex strings.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const revealCssPath = resolve(here, "reveal.module.css");
const globalsCssPath = resolve(here, "..", "..", "app", "globals.css");
const ceremonyCssPath = resolve(here, "..", "ceremony", "ceremony.module.css");

const WCAG_AA_NORMAL = 4.5;

/** Read a `--token: #rrggbb;` declaration. Missing or non-hex values throw. */
function readHexToken(css: string, token: string, source: string): string {
  const re = new RegExp(`${token}\\s*:\\s*(#[0-9a-fA-F]{6})\\b`);
  const match = css.match(re);
  if (!match) {
    throw new Error(`token ${token} not found as a 6-digit hex in ${source}`);
  }
  return match[1].toLowerCase();
}

/** Every distinct token used as `color: var(--token)` in a stylesheet. */
function textTokensUsed(css: string): string[] {
  const found = new Set<string>();
  for (const match of css.matchAll(/(?:^|[\s;{])color\s*:\s*var\((--[a-z0-9-]+)\)/g)) {
    found.add(match[1]);
  }
  return [...found].sort();
}

function hexToChannels(hex: string): [number, number, number] {
  const n = hex.replace("#", "");
  return [
    parseInt(n.slice(0, 2), 16) / 255,
    parseInt(n.slice(2, 4), 16) / 255,
    parseInt(n.slice(4, 6), 16) / 255,
  ];
}

/** WCAG sRGB channel linearisation. */
function linearise(channel: number): number {
  return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of an sRGB hex colour. */
function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToChannels(hex).map(linearise);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours (order-independent). */
function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe("reveal text token pairs meet WCAG 2.2 AA", () => {
  const revealCss = readFileSync(revealCssPath, "utf8");
  const globalsCss = readFileSync(globalsCssPath, "utf8");
  const ceremonyCss = readFileSync(ceremonyCssPath, "utf8");

  const textTokens = textTokensUsed(revealCss);

  // Guard: the scan must find the reveal's text colours. An empty list would
  // let every pair loop below pass by iterating nothing.
  it("finds the text colour tokens the reveal uses", () => {
    expect(textTokens).toContain("--ink");
    expect(textTokens).toContain("--ink-soft");
    expect(textTokens).toContain("--seal");
    for (const token of textTokens) {
      expect(token).toMatch(/^--[a-z0-9-]+$/);
    }
  });

  const paperSurfaces = ["--paper", "--paper-deep"] as const;
  const paper = Object.fromEntries(
    paperSurfaces.map((s) => [s, readHexToken(globalsCss, s, "globals.css")]),
  ) as Record<(typeof paperSurfaces)[number], string>;

  for (const token of textTokens) {
    for (const surface of paperSurfaces) {
      it(`${token} on ${surface} is at least ${WCAG_AA_NORMAL}:1`, () => {
        const text = readHexToken(globalsCss, token, "globals.css");
        expect(contrastRatio(text, paper[surface])).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      });
    }
  }

  // Desk text tokens, drawn on the ceremony desk that the reveal sits on.
  const deskTextTokens = ["--desk-ink", "--desk-ink-soft", "--desk-gold"] as const;
  const desk = readHexToken(ceremonyCss, "--desk", "ceremony.module.css");

  for (const token of deskTextTokens) {
    it(`${token} on --desk is at least ${WCAG_AA_NORMAL}:1`, () => {
      const text = readHexToken(ceremonyCss, token, "ceremony.module.css");
      expect(contrastRatio(text, desk)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });
  }

  // Sanity-check the formula against a known pair.
  it("computes the reference 21:1 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 2);
  });
});
