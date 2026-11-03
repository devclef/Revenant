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

// ---------------------------------------------------------------------------
// Spec 07 (judge journey), R4 and Property 9: Scene token pairs.
//
// The Scene's colours live in scene/tokens.module.css. This block reads them,
// composites partly transparent tokens over the surface beneath them (R4.2),
// and checks each R4.1 pair. Normal text needs 4.5:1. Large text, control
// boundaries and focus rings need 3:1 (R4.3, R4.4). A failure names the pair
// and its ratio. The rule checks (R4.5 text on purple, R4.9 Accent ring inside
// the Letter_Block) and the dirt pair (R4.7) are asserted to fail by name.
// The desk pairs above stay untouched until task 9 (R4.8).

type Rgb = [number, number, number];
interface Colour {
  rgb: Rgb;
  alpha: number;
}
interface PairResult {
  pair: string;
  ratio: number;
  threshold: number;
  ok: boolean;
}

const tokensCssPath = resolve(here, "scene", "tokens.module.css");

/** A 6-digit hex or an rgba() value, as tokens.module.css writes them. */
const COLOUR_VALUE = String.raw`(#[0-9a-fA-F]{6}|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[0-9.]+\s*\))`;

/** Read a Scene colour token. Accepts hex (opaque) and rgba() (with alpha). */
function readColourToken(css: string, token: string, file: string): Colour {
  const match = css.match(
    new RegExp(String.raw`(?<![\w-])${token}\s*:\s*` + COLOUR_VALUE),
  );
  if (!match) {
    throw new Error(`token ${token} not found as a hex or rgba colour in ${file}`);
  }
  const value = match[1];
  if (value.startsWith("#")) {
    return { rgb: hexToRgb(value), alpha: 1 };
  }
  const parts = value
    .slice(value.indexOf("(") + 1, -1)
    .split(",")
    .map((p) => Number(p.trim()));
  return { rgb: [parts[0], parts[1], parts[2]], alpha: parts[3] };
}

/** 6-digit hex to 0..255 channels. */
function hexToRgb(hex: string): Rgb {
  const n = hex.replace("#", "");
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
  ];
}

/** Composite a (possibly transparent) colour over an opaque surface. */
function composite(top: Colour, below: Colour): Rgb {
  if (below.alpha !== 1) {
    throw new Error("the surface beneath a composite must be opaque");
  }
  return top.rgb.map(
    (c, i) => top.alpha * c + (1 - top.alpha) * below.rgb[i],
  ) as Rgb;
}

/** WCAG relative luminance of 0..255 channels. */
function luminanceOf(rgb: Rgb): number {
  const [r, g, b] = rgb.map((c) => linearise(c / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two 0..255 colours (order-independent). */
function ratioOf(a: Rgb, b: Rgb): number {
  const la = luminanceOf(a);
  const lb = luminanceOf(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function checkPair(pair: string, fg: Rgb, bg: Rgb, threshold: number): PairResult {
  const ratio = ratioOf(fg, bg);
  return { pair, ratio, threshold, ok: ratio >= threshold };
}

function describeResult(r: PairResult): string {
  return `${r.pair} is ${r.ratio.toFixed(2)}:1, below the ${r.threshold}:1 it needs`;
}

/**
 * R4.5: text on purple uses --on-purple only, whatever the ratio. Any other
 * token that sits on --purple (the Accent, --text, near-black) throws by name.
 */
function assertTextOnPurple(token: string, purple: Rgb, colourOf: (t: string) => Rgb): void {
  if (token !== "--on-purple") {
    throw new Error(
      `text token ${token} on --purple fails: only --on-purple may sit on purple (R4.5, R3.17)`,
    );
  }
  const r = checkPair(`${token} on --purple`, colourOf(token), purple, WCAG_AA_NORMAL);
  if (!r.ok) throw new Error(describeResult(r));
}

/**
 * R4.9 and R3.15: a focus ring inside the Letter_Block is white (--on-purple),
 * never the Accent. The Accent ring throws by name; any other ring is checked
 * at 3:1 against --purple.
 */
function assertLetterBlockFocusRing(token: string, purple: Rgb, colourOf: (t: string) => Rgb): void {
  if (token === "--accent") {
    throw new Error(
      `focus ring ${token} inside the Letter_Block fails: the ring there must be --on-purple (R4.9, R3.15)`,
    );
  }
  const r = checkPair(
    `focus ring ${token} inside the Letter_Block (on --purple)`,
    colourOf(token),
    purple,
    FOCUS_RING_MIN,
  );
  if (!r.ok) throw new Error(describeResult(r));
}

describe("Spec 07 R4 and Property 9: Scene token pairs", () => {
  const tokensCss = readFileSync(tokensCssPath, "utf8");
  const scene = (token: string): Colour =>
    readColourToken(tokensCss, token, "tokens.module.css");
  const sceneRgb = (token: string): Rgb => scene(token).rgb;

  // The crease: --ink at 8 % over --paper (R13.2, design "Creases").
  const creaseRgb = composite({ ...scene("--ink"), alpha: 0.08 }, scene("--paper"));
  // --dirt is one translucent colour, so its darkest point is its composite
  // over --env (R4.7).
  const darkestDirtRgb = composite(scene("--dirt"), scene("--env"));

  // Normal text (4.5:1). Pairs from R4.1 and the spec 07 surfaces.
  const normalPairs: Array<{ pair: string; fg: Rgb; bg: Rgb }> = [
    { pair: "--text on --bg", fg: sceneRgb("--text"), bg: sceneRgb("--bg") },
    { pair: "--muted on --bg", fg: sceneRgb("--muted"), bg: sceneRgb("--bg") },
    { pair: "--on-purple on --purple", fg: sceneRgb("--on-purple"), bg: sceneRgb("--purple") },
    { pair: "--accent on --bg", fg: sceneRgb("--accent"), bg: sceneRgb("--bg") },
    { pair: "--on-accent on --accent", fg: sceneRgb("--on-accent"), bg: sceneRgb("--accent") },
    { pair: "--text on --error-surface", fg: sceneRgb("--text"), bg: sceneRgb("--error-surface") },
    { pair: "--ink on --paper", fg: sceneRgb("--ink"), bg: sceneRgb("--paper") },
    { pair: "--ink-soft on --paper", fg: sceneRgb("--ink-soft"), bg: sceneRgb("--paper") },
    { pair: "--ink on the crease (--ink at 8% over --paper)", fg: sceneRgb("--ink"), bg: creaseRgb },
    { pair: "--env-ink on --env", fg: sceneRgb("--env-ink"), bg: sceneRgb("--env") },
  ];

  for (const { pair, fg, bg } of normalPairs) {
    it(`${pair} clears ${WCAG_AA_NORMAL}:1 (R4.3)`, () => {
      const r = checkPair(pair, fg, bg, WCAG_AA_NORMAL);
      expect(r.ok, describeResult(r)).toBe(true);
    });
  }

  // Control boundaries and focus rings (3:1). The white ring inside the
  // Letter_Block, the Accent ring on --bg, and the --line control border.
  const ringPairs: Array<{ pair: string; fg: Rgb; bg: Rgb }> = [
    {
      pair: "focus ring --on-purple on --purple (inside the Letter_Block)",
      fg: sceneRgb("--on-purple"),
      bg: sceneRgb("--purple"),
    },
    {
      pair: "focus ring --accent on --bg (outside the Letter_Block)",
      fg: sceneRgb("--accent"),
      bg: sceneRgb("--bg"),
    },
    { pair: "control border --line on --bg", fg: sceneRgb("--line"), bg: sceneRgb("--bg") },
  ];

  for (const { pair, fg, bg } of ringPairs) {
    it(`${pair} clears ${FOCUS_RING_MIN}:1 (R4.4, R3.14)`, () => {
      const r = checkPair(pair, fg, bg, FOCUS_RING_MIN);
      expect(r.ok, describeResult(r)).toBe(true);
    });
  }

  // R4.5: any text token other than --on-purple on purple fails by name.
  for (const token of ["--accent", "--text", "--bg"]) {
    it(`${token} as text on --purple fails by name (R4.5)`, () => {
      expect(() => assertTextOnPurple(token, sceneRgb("--purple"), sceneRgb)).toThrow(token);
    });
  }
  it("--on-purple as text on --purple passes (R4.5)", () => {
    expect(() => assertTextOnPurple("--on-purple", sceneRgb("--purple"), sceneRgb)).not.toThrow();
  });

  // R4.9: the Accent focus ring inside the Letter_Block fails by name.
  it("the Accent focus ring inside the Letter_Block fails by name (R4.9)", () => {
    expect(() => assertLetterBlockFocusRing("--accent", sceneRgb("--purple"), sceneRgb)).toThrow(
      /focus ring --accent inside the Letter_Block/,
    );
  });
  it("the white focus ring inside the Letter_Block passes (R4.9)", () => {
    expect(() =>
      assertLetterBlockFocusRing("--on-purple", sceneRgb("--purple"), sceneRgb),
    ).not.toThrow();
  });

  // R4.7: --env-ink on the darkest dirt over --env is computed and must fail.
  // No Envelope_Front text may sit on the dirt band (design, Envelope "Dirt and text").
  it("--env-ink on the darkest --dirt over --env fails 4.5:1 by name (R4.7)", () => {
    const r = checkPair(
      "--env-ink on the darkest --dirt over --env",
      sceneRgb("--env-ink"),
      darkestDirtRgb,
      WCAG_AA_NORMAL,
    );
    expect(r.ok, describeResult(r)).toBe(false);
    expect(r.pair).toContain("--env-ink on the darkest --dirt");
    expect(r.ratio).toBeLessThan(WCAG_AA_NORMAL);
  });
});
