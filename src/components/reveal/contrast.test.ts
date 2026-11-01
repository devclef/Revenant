// Feature: 03-persona-demo, Task 8 (R9.7 / R13.6, WCAG 2.2 AA contrast)
//
// The reveal draws its text and labels from a fixed set of colour tokens in
// src/app/globals.css. tone.md and data-integrity.md require body text, numbers
// and labels to clear WCAG 2.2 AA (>=4.5:1 for normal text) on the two paper
// surfaces the reveal sits on. This test reads the real hex values out of the
// CSS file (so it tracks the tokens, not a copy of them), computes the sRGB
// relative-luminance contrast ratio with the WCAG formula, and asserts every
// text/label token the reveal uses -- including the fixture label, which is ink
// text -- is at least 4.5:1 on both --paper and --paper-deep.
//
// No DOM: this is a plain arithmetic check over parsed hex strings.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
// src/app/globals.css, from src/components/reveal.
const globalsCssPath = resolve(here, "..", "..", "app", "globals.css");

/** The tokens the reveal depends on (see reveal.module.css). */
const TEXT_TOKENS = ["--ink", "--ink-soft", "--seal", "--gold-text"] as const;
const SURFACE_TOKENS = ["--paper", "--paper-deep"] as const;

const WCAG_AA_NORMAL = 4.5;

/**
 * Read a `--token: #rrggbb;` declaration out of the :root block. Only full
 * 6-digit hex values are accepted; a token given as rgba() or missing fails
 * loudly rather than silently passing.
 */
function readHexToken(css: string, token: string): string {
  const re = new RegExp(`${token}\\s*:\\s*(#[0-9a-fA-F]{6})\\b`);
  const match = css.match(re);
  if (!match) {
    throw new Error(`token ${token} not found as a 6-digit hex in globals.css`);
  }
  return match[1].toLowerCase();
}

/** sRGB hex -> the three 0..1 channels. */
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
  return channel <= 0.03928
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
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
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

describe("reveal colour tokens meet WCAG 2.2 AA on both paper surfaces", () => {
  const css = readFileSync(globalsCssPath, "utf8");

  const text = Object.fromEntries(
    TEXT_TOKENS.map((t) => [t, readHexToken(css, t)]),
  ) as Record<(typeof TEXT_TOKENS)[number], string>;
  const surface = Object.fromEntries(
    SURFACE_TOKENS.map((s) => [s, readHexToken(css, s)]),
  ) as Record<(typeof SURFACE_TOKENS)[number], string>;

  it("parsed every token it needs from globals.css", () => {
    // Guard: the loops below can only be meaningful if the parse found real
    // values. A failed parse throws above, but assert the shape too so a
    // silently-empty object can never let the suite pass by iterating nothing.
    expect(Object.keys(text)).toHaveLength(TEXT_TOKENS.length);
    expect(Object.keys(surface)).toHaveLength(SURFACE_TOKENS.length);
    for (const hex of [...Object.values(text), ...Object.values(surface)]) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  // Sanity-check the formula against a known pair: black on white is 21:1.
  it("computes the reference 21:1 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 2);
  });

  for (const token of TEXT_TOKENS) {
    for (const surfaceToken of SURFACE_TOKENS) {
      it(`${token} on ${surfaceToken} is at least ${WCAG_AA_NORMAL}:1`, () => {
        const ratio = contrastRatio(text[token], surface[surfaceToken]);
        expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      });
    }
  }

  // The "fixture data" / historical-record label is ink text (see
  // reveal.module.css .fixtureLabel: color: var(--ink)), so its visible text
  // must clear AA on both surfaces too. This is the same --ink pair asserted
  // above, pinned here explicitly so the fixture label's contrast is a named
  // guarantee (R13.6, R16.4).
  for (const surfaceToken of SURFACE_TOKENS) {
    it(`fixture label (ink text) on ${surfaceToken} is at least ${WCAG_AA_NORMAL}:1`, () => {
      const ratio = contrastRatio(text["--ink"], surface[surfaceToken]);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });
  }
});
