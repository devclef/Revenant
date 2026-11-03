// Feature: 07-judge-journey, Property 9 (design.md), R4.1 to R4.9.
//
// Every Scene token pair clears its contrast threshold. This test reads
// scene/tokens.module.css directly, so it tracks the real values. It composites
// partly transparent tokens over the surface beneath them (R4.2), then checks
// each pair with the WCAG 2.2 relative-luminance formula:
//   - normal text and the --env-ink pair: 4.5 : 1 (R4.3),
//   - control boundaries and focus rings: 3 : 1 (R4.4).
// Text on --purple other than --on-purple fails by name (R4.5). The Accent
// ring inside the Letter_Block fails by name (R4.9). --env-ink on the darkest
// dirt is computed and shown to fail (R4.7).
//
// The envelope text-box geometry in Property 9 needs the Envelope component,
// which lands in a later task. It is not checked here.
//
// Pure arithmetic over the parsed CSS. No DOM.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const tokensCss = readFileSync(resolve(here, "tokens.module.css"), "utf8");

const NORMAL = 4.5;
const LARGE_OR_CONTROL = 3;

type Rgb = [number, number, number];
interface Colour {
  rgb: Rgb;
  alpha: number;
}

const COLOUR_VALUE = String.raw`(#[0-9a-fA-F]{6}|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[0-9.]+\s*\))`;

/** Read one token's value. Accepts a 6-digit hex (opaque) or an rgba(). */
function readToken(token: string): Colour {
  const match = tokensCss.match(
    new RegExp(String.raw`(?<![\w-])${token}\s*:\s*` + COLOUR_VALUE),
  );
  if (!match) {
    throw new Error(`token ${token} not found as a hex or rgba colour in tokens.module.css`);
  }
  const value = match[1];
  if (value.startsWith("#")) {
    const n = value.slice(1);
    return {
      rgb: [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)],
      alpha: 1,
    };
  }
  const parts = value
    .slice(value.indexOf("(") + 1, -1)
    .split(",")
    .map((p) => Number(p.trim()));
  return { rgb: [parts[0], parts[1], parts[2]], alpha: parts[3] };
}

/** Composite a possibly transparent colour over an opaque surface (R4.2). */
function composite(top: Colour, below: Colour): Rgb {
  if (below.alpha !== 1) {
    throw new Error("the surface beneath a composite must be opaque");
  }
  return top.rgb.map((c, i) => top.alpha * c + (1 - top.alpha) * below.rgb[i]) as Rgb;
}

function luminanceOf(rgb: Rgb): number {
  const [r, g, b] = rgb.map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, order-independent. */
function ratioOf(a: Rgb, b: Rgb): number {
  const la = luminanceOf(a);
  const lb = luminanceOf(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const opaque = (token: string): Rgb => readToken(token).rgb;

// The crease is --ink at 8 % over --paper (R13.2). The darkest dirt is the
// translucent --dirt composited over --env (R4.7).
const creaseRgb = composite({ ...readToken("--ink"), alpha: 0.08 }, readToken("--paper"));
const darkestDirtRgb = composite(readToken("--dirt"), readToken("--env"));

interface Pair {
  pair: string;
  fg: Rgb;
  bg: Rgb;
  threshold: number;
}

const PAIRS: Pair[] = [
  // Normal text (4.5 : 1).
  { pair: "--text on --bg", fg: opaque("--text"), bg: opaque("--bg"), threshold: NORMAL },
  { pair: "--muted on --bg", fg: opaque("--muted"), bg: opaque("--bg"), threshold: NORMAL },
  { pair: "--accent on --bg (text)", fg: opaque("--accent"), bg: opaque("--bg"), threshold: NORMAL },
  { pair: "--on-purple on --purple", fg: opaque("--on-purple"), bg: opaque("--purple"), threshold: NORMAL },
  { pair: "--on-accent on --accent", fg: opaque("--on-accent"), bg: opaque("--accent"), threshold: NORMAL },
  { pair: "--text on --error-surface", fg: opaque("--text"), bg: opaque("--error-surface"), threshold: NORMAL },
  { pair: "--ink on --paper", fg: opaque("--ink"), bg: opaque("--paper"), threshold: NORMAL },
  { pair: "--ink-soft on --paper", fg: opaque("--ink-soft"), bg: opaque("--paper"), threshold: NORMAL },
  { pair: "--ink on the crease (--ink at 8% over --paper)", fg: opaque("--ink"), bg: creaseRgb, threshold: NORMAL },
  { pair: "--env-ink on --env", fg: opaque("--env-ink"), bg: opaque("--env"), threshold: NORMAL },
  // Control boundaries and focus rings (3 : 1).
  { pair: "control border --line on --bg", fg: opaque("--line"), bg: opaque("--bg"), threshold: LARGE_OR_CONTROL },
  { pair: "focus ring --accent on --bg", fg: opaque("--accent"), bg: opaque("--bg"), threshold: LARGE_OR_CONTROL },
  { pair: "focus ring --on-purple on --purple (inside the Letter_Block)", fg: opaque("--on-purple"), bg: opaque("--purple"), threshold: LARGE_OR_CONTROL },
];

describe("Property 9: every Scene token pair clears its threshold", () => {
  it("parses every token from tokens.module.css", () => {
    for (const { pair, fg, bg } of PAIRS) {
      expect(fg, pair).toHaveLength(3);
      expect(bg, pair).toHaveLength(3);
    }
    expect(PAIRS.length).toBeGreaterThan(0);
  });

  for (const { pair, fg, bg, threshold } of PAIRS) {
    it(`${pair} clears ${threshold}:1`, () => {
      const ratio = ratioOf(fg, bg);
      expect(ratio, `${pair} is ${ratio.toFixed(2)}:1, below ${threshold}:1`).toBeGreaterThanOrEqual(threshold);
    });
  }

  // R4.5: only --on-purple may be text on --purple. Any other text token is
  // checked, then rejected by name, whatever its ratio.
  const assertTextOnPurple = (token: string): void => {
    const ratio = ratioOf(opaque(token), opaque("--purple"));
    if (token !== "--on-purple") {
      throw new Error(`text ${token} on --purple (${ratio.toFixed(2)}:1) fails: only --on-purple may sit on purple (R4.5)`);
    }
    expect(ratio).toBeGreaterThanOrEqual(NORMAL);
  };
  for (const token of ["--accent", "--text", "--bg"]) {
    it(`text ${token} on --purple fails by name (R4.5)`, () => {
      expect(() => assertTextOnPurple(token)).toThrow(token);
    });
  }
  it("--on-purple as text on --purple passes (R4.5)", () => {
    expect(() => assertTextOnPurple("--on-purple")).not.toThrow();
  });

  // R4.9: the focus ring inside the Letter_Block must be --on-purple. The
  // Accent ring fails by name.
  const assertLetterBlockRing = (token: string): void => {
    if (token === "--accent") {
      throw new Error("focus ring --accent inside the Letter_Block fails: the ring there must be --on-purple (R4.9)");
    }
    const ratio = ratioOf(opaque(token), opaque("--purple"));
    expect(ratio).toBeGreaterThanOrEqual(LARGE_OR_CONTROL);
  };
  it("the Accent focus ring inside the Letter_Block fails by name (R4.9)", () => {
    expect(() => assertLetterBlockRing("--accent")).toThrow(/focus ring --accent inside the Letter_Block/);
  });
  it("the white focus ring inside the Letter_Block passes (R4.9)", () => {
    expect(() => assertLetterBlockRing("--on-purple")).not.toThrow();
  });

  // R4.7: --env-ink on the darkest dirt is computed and must fail 4.5 : 1.
  // No Envelope_Front text may sit on the dirt band.
  it("--env-ink on the darkest --dirt over --env is computed and fails 4.5:1 (R4.7)", () => {
    const ratio = ratioOf(opaque("--env-ink"), darkestDirtRgb);
    expect(ratio).toBeLessThan(NORMAL);
  });
});
