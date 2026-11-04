// Feature: 06-lock-and-unlock, Task 5 (R19.6, WCAG 2.2 AA contrast)
// Feature: 07-judge-journey, task 3 (R17.6, R17.7, R17.8, R4.1)
//
// The live demo draws its text on the paper panel of the Seal_Page and
// Unavailable state, and on the Letter_Page. Both load the scene tokens in
// src/components/ceremony/scene/tokens.css (LiveLetter and SealPage import it),
// so the paper, ink, Accent and on-Accent values are read from that file. The
// paper-deep surface still comes from globals.css.
//
// Every text/surface pair is read from the real CSS files, so the test tracks
// the tokens rather than a copy of them. Each pair must reach WCAG 2.2 AA
// (>= 4.5:1 for normal text). The contrast formula is the WCAG relative
// luminance ratio. No DOM, no rendering: plain arithmetic over parsed hex
// strings.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
// src/components/live -> src
const srcRoot = resolve(here, "..", "..");
const globalsCss = readFileSync(resolve(srcRoot, "app", "globals.css"), "utf8");
const tokensCss = readFileSync(
  resolve(srcRoot, "components", "ceremony", "scene", "tokens.css"),
  "utf8",
);
const liveCss = readFileSync(resolve(here, "live.module.css"), "utf8");

const WCAG_AA_NORMAL = 4.5;

/** Read a `--token: #rrggbb;` declaration. Only 6-digit hex is accepted. */
function readHexToken(css: string, token: string): string {
  const re = new RegExp(`${token}\\s*:\\s*(#[0-9a-fA-F]{6})\\b`);
  const match = css.match(re);
  if (!match) {
    throw new Error(`token ${token} not found as a 6-digit hex`);
  }
  return match[1].toLowerCase();
}

/** Every declaration block whose selector is exactly `selector`. */
function ruleBlocks(css: string, selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|[\\s},])${escaped}\\s*\\{([^}]*)\\}`, "g");
  return [...css.matchAll(re)].map((m) => m[1]);
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
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Scene tokens (tokens.css) and the paper-deep surface (globals.css).
const paper = readHexToken(tokensCss, "--paper");
const ink = readHexToken(tokensCss, "--ink");
const inkSoft = readHexToken(tokensCss, "--ink-soft");
const accent = readHexToken(tokensCss, "--accent");
const onAccent = readHexToken(tokensCss, "--on-accent");
const paperDeep = readHexToken(globalsCss, "--paper-deep");

/** Each pair names the element that uses it, so a failure points at the rule. */
const PAPER_PAIRS: ReadonlyArray<readonly [string, string, string]> = [
  ["panel ink (heading, labels, figure names)", ink, paper],
  ["panel ink on deep paper (figure rows, warning box)", ink, paperDeep],
  ["panel ink-soft (hints, counts, figure meta)", inkSoft, paper],
  ["panel ink-soft on deep paper (disabled button, fixture tag)", inkSoft, paperDeep],
  ["primary button text (on-accent on the Accent)", onAccent, accent],
  ["passkey and backup key warning text (.warning p, ink on paper-deep)", ink, paperDeep],
  ["passkey and backup key warning label (.warningLabel, ink on paper)", ink, paper],
];

describe("live demo tokens were read from the real CSS", () => {
  it("parsed every token as a 6-digit hex value", () => {
    for (const hex of [paper, ink, inkSoft, accent, onAccent, paperDeep]) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("computes the reference 21:1 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 2);
  });

  it("reads the panel, warning and primary rules from live.module.css", () => {
    expect(ruleBlocks(liveCss, ".warning p").length).toBeGreaterThan(0);
    expect(ruleBlocks(liveCss, ".warningLabel").length).toBeGreaterThan(0);
    expect(ruleBlocks(liveCss, ".primary").length).toBeGreaterThan(0);
  });
});

describe("paper panel text meets WCAG 2.2 AA (R19.6, R17.8)", () => {
  it.each(PAPER_PAIRS)("%s is at least 4.5:1", (_label, text, surface) => {
    expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(
      WCAG_AA_NORMAL,
    );
  });
});

describe("passkey and backup key warnings stay plain (R17.6, R17.7)", () => {
  const WARNING_RULES = [".warning", ".warning p", ".warningLabel"];
  const EFFECT_PROPERTIES =
    /(^|[;\s])(opacity|animation|animation-[a-z-]+|transition|transition-[a-z-]+|text-shadow|filter|backdrop-filter|mix-blend-mode|visibility)\s*:|display\s*:\s*none/;

  it.each(WARNING_RULES)("%s has no fade, glow, animation or hiding", (selector) => {
    for (const block of ruleBlocks(liveCss, selector)) {
      expect(block).not.toMatch(EFFECT_PROPERTIES);
    }
  });

  it("has no media query that restyles the warnings, so Calm_Mode cannot change them", () => {
    const mediaBlocks = [...liveCss.matchAll(/@media[^{]*\{([\s\S]*?\n\})/g)].map(
      (m) => m[1],
    );
    for (const block of mediaBlocks) {
      expect(block).not.toMatch(/\.warning/);
    }
  });

  it("keeps the warning text in ink, not a soft or faded token", () => {
    for (const block of ruleBlocks(liveCss, ".warning p")) {
      expect(block).toMatch(/color:\s*var\(--ink\)/);
    }
  });
});

describe("the rendered colours are the tokens the pairs were read from", () => {
  const liveDir = here;
  const sealPage = readFileSync(resolve(liveDir, "SealPage.tsx"), "utf8");
  const liveLetter = readFileSync(resolve(liveDir, "LiveLetter.tsx"), "utf8");
  const envelopeCss = readFileSync(
    resolve(srcRoot, "components", "ceremony", "envelope", "Envelope.module.css"),
    "utf8",
  );

  it("loads tokens.css on both the Seal_Page and the Letter_Page", () => {
    const IMPORT = 'import "@/components/ceremony/scene/tokens.css";';
    expect(sealPage).toContain(IMPORT);
    expect(liveLetter).toContain(IMPORT);
  });

  it("sets no colour literal in live.module.css except the print and QR surfaces", () => {
    // The print block forces black and white for the printed card, and the QR
    // quiet zone is white by design. Every other colour comes from a token.
    const withoutPrint = liveCss.replace(/@media print\s*\{[\s\S]*?\n\}\n/, "");
    const literals = [...withoutPrint.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) =>
      m[0].toLowerCase(),
    );
    expect(literals.every((hex) => hex === "#ffffff")).toBe(true);
  });

  it("gives the envelope text its scene ink from tokens.css", () => {
    expect(envelopeCss).toContain("color: var(--env-ink);");
    expect(readHexToken(tokensCss, "--env-ink")).toMatch(/^#[0-9a-f]{6}$/);
  });
});
