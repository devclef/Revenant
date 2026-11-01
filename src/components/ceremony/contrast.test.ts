// Feature: 05-reveal-ceremony, Property 22
//
// Property 22 (design.md): desk text and focus rings clear AA on every desk
// surface. The Ceremony draws its text from desk tokens in ceremony.module.css
// (R1.7: the Ceremony never edits globals.css) and from the reveal's paper
// text tokens in src/app/globals.css. tone.md and data-integrity.md require
// body text, numbers and labels to clear WCAG 2.2 AA (>=4.5:1 for normal text),
// and focus rings to clear 3:1, on every surface they sit on.
//
// This test reads the real hex values out of the CSS files (so it tracks the
// tokens, not a copy of them), computes the sRGB relative-luminance contrast
// ratio with the WCAG formula, and asserts:
//   - every desk text token (--desk-ink, --desk-ink-soft, --desk-gold) on the
//     unlit desk (--desk) and the brightest lit desk (--desk-lit-max) is >=4.5,
//   - every reveal text token (--ink, --ink-soft, --seal, --gold-text) on each
//     paper surface (--paper, --paper-deep, --paper-shadowed) is >=4.5,
//   - the focus rings (--ink on paper, --desk-ink on the desk) are >=3.
//
// No colour here depends on any value or direction (neutrality.md, R10.1): a
// rise and a fall use the same tokens, so this test treats them identically.
//
// No DOM: a plain arithmetic check over parsed hex strings.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
// src/app/globals.css, from src/components/ceremony.
const globalsCssPath = resolve(here, "..", "..", "app", "globals.css");
// ceremony.module.css lives next to this test.
const ceremonyCssPath = resolve(here, "ceremony.module.css");

/** Reveal (paper) text tokens, from globals.css. */
const PAPER_TEXT_TOKENS = ["--ink", "--ink-soft", "--seal", "--gold-text"] as const;
/** Paper surfaces: two from globals.css, the deepest shading from the Ceremony. */
const GLOBALS_SURFACE_TOKENS = ["--paper", "--paper-deep"] as const;
const CEREMONY_SURFACE_TOKENS = ["--paper-shadowed"] as const;
/** Desk text tokens, from ceremony.module.css. */
const DESK_TEXT_TOKENS = ["--desk-ink", "--desk-ink-soft", "--desk-gold"] as const;
/** Desk surfaces: the unlit desk and the brightest the candle lifts it to. */
const DESK_SURFACE_TOKENS = ["--desk", "--desk-lit-max"] as const;

const WCAG_AA_NORMAL = 4.5;
const FOCUS_RING_MIN = 3;

/**
 * Read a `--token: #rrggbb;` declaration out of the CSS. Only full 6-digit hex
 * values are accepted; a token given as rgba() or missing fails loudly rather
 * than silently passing.
 */
function readHexToken(css: string, token: string, file: string): string {
  const re = new RegExp(`${token}\\s*:\\s*(#[0-9a-fA-F]{6})\\b`);
  const match = css.match(re);
  if (!match) {
    throw new Error(`token ${token} not found as a 6-digit hex in ${file}`);
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

describe("Property 22: desk and paper text and focus rings clear AA / 3:1", () => {
  const globalsCss = readFileSync(globalsCssPath, "utf8");
  const ceremonyCss = readFileSync(ceremonyCssPath, "utf8");

  const paperText = Object.fromEntries(
    PAPER_TEXT_TOKENS.map((t) => [t, readHexToken(globalsCss, t, "globals.css")]),
  ) as Record<(typeof PAPER_TEXT_TOKENS)[number], string>;

  const paperSurface = {
    ...Object.fromEntries(
      GLOBALS_SURFACE_TOKENS.map((s) => [
        s,
        readHexToken(globalsCss, s, "globals.css"),
      ]),
    ),
    ...Object.fromEntries(
      CEREMONY_SURFACE_TOKENS.map((s) => [
        s,
        readHexToken(ceremonyCss, s, "ceremony.module.css"),
      ]),
    ),
  } as Record<
    | (typeof GLOBALS_SURFACE_TOKENS)[number]
    | (typeof CEREMONY_SURFACE_TOKENS)[number],
    string
  >;

  const deskText = Object.fromEntries(
    DESK_TEXT_TOKENS.map((t) => [t, readHexToken(ceremonyCss, t, "ceremony.module.css")]),
  ) as Record<(typeof DESK_TEXT_TOKENS)[number], string>;

  const deskSurface = Object.fromEntries(
    DESK_SURFACE_TOKENS.map((s) => [s, readHexToken(ceremonyCss, s, "ceremony.module.css")]),
  ) as Record<(typeof DESK_SURFACE_TOKENS)[number], string>;

  it("parsed every token it needs from the CSS files", () => {
    // Guard: the loops below are only meaningful if the parse found real
    // values. A failed parse throws above, but assert the shape too so a
    // silently-empty object can never let the suite pass by iterating nothing.
    expect(Object.keys(paperText)).toHaveLength(PAPER_TEXT_TOKENS.length);
    expect(Object.keys(paperSurface)).toHaveLength(
      GLOBALS_SURFACE_TOKENS.length + CEREMONY_SURFACE_TOKENS.length,
    );
    expect(Object.keys(deskText)).toHaveLength(DESK_TEXT_TOKENS.length);
    expect(Object.keys(deskSurface)).toHaveLength(DESK_SURFACE_TOKENS.length);
    for (const hex of [
      ...Object.values(paperText),
      ...Object.values(paperSurface),
      ...Object.values(deskText),
      ...Object.values(deskSurface),
    ]) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  // Sanity-check the formula against a known pair: black on white is 21:1.
  it("computes the reference 21:1 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 2);
  });

  // Desk text on the unlit desk and the brightest lit desk.
  for (const token of DESK_TEXT_TOKENS) {
    for (const surfaceToken of DESK_SURFACE_TOKENS) {
      it(`${token} on ${surfaceToken} is at least ${WCAG_AA_NORMAL}:1`, () => {
        const ratio = contrastRatio(deskText[token], deskSurface[surfaceToken]);
        expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      });
    }
  }

  // Reveal (paper) text on every paper surface, including the deepest shading.
  const PAPER_SURFACE_TOKENS = [
    ...GLOBALS_SURFACE_TOKENS,
    ...CEREMONY_SURFACE_TOKENS,
  ] as const;
  for (const token of PAPER_TEXT_TOKENS) {
    for (const surfaceToken of PAPER_SURFACE_TOKENS) {
      it(`${token} on ${surfaceToken} is at least ${WCAG_AA_NORMAL}:1`, () => {
        const ratio = contrastRatio(paperText[token], paperSurface[surfaceToken]);
        expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      });
    }
  }

  // Focus rings (R11.8): --ink on every paper surface, --desk-ink on every
  // desk surface, each at least 3:1.
  for (const surfaceToken of PAPER_SURFACE_TOKENS) {
    it(`focus ring (--ink) on ${surfaceToken} is at least ${FOCUS_RING_MIN}:1`, () => {
      const ratio = contrastRatio(paperText["--ink"], paperSurface[surfaceToken]);
      expect(ratio).toBeGreaterThanOrEqual(FOCUS_RING_MIN);
    });
  }
  for (const surfaceToken of DESK_SURFACE_TOKENS) {
    it(`focus ring (--desk-ink) on ${surfaceToken} is at least ${FOCUS_RING_MIN}:1`, () => {
      const ratio = contrastRatio(deskText["--desk-ink"], deskSurface[surfaceToken]);
      expect(ratio).toBeGreaterThanOrEqual(FOCUS_RING_MIN);
    });
  }
});
