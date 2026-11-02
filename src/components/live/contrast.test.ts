// Feature: 06-lock-and-unlock, Task 5 (R19.6, WCAG 2.2 AA contrast)
//
// The live demo draws its text on two surfaces:
//   * the paper panel of the Seal_Page and Unavailable state, which sets its own
//     --ink and --ink-soft (live.module.css `.panel`) on the paper tokens;
//   * the dark desk of the Demo_Index page, where LiveEntry uses the desk tokens
//     (ceremony.module.css) on the desk and its lit pool.
//
// Every text/surface pair is read from the real CSS files, so the test tracks
// the tokens rather than a copy of them. Each pair must reach WCAG 2.2 AA
// (>= 4.5:1 for normal text). The contrast formula is the WCAG relative
// luminance ratio, the same one reveal/contrast.test.ts uses. No DOM, no
// rendering: plain arithmetic over parsed hex strings.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
// src/components/live -> src
const srcRoot = resolve(here, "..", "..");
const globalsCss = readFileSync(resolve(srcRoot, "app", "globals.css"), "utf8");
const ceremonyCss = readFileSync(
  resolve(srcRoot, "components", "ceremony", "ceremony.module.css"),
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

/** Read a `--token: #rrggbb;` declaration from inside one CSS rule block. */
function readHexInBlock(css: string, selector: string, token: string): string {
  const block = css.match(
    new RegExp(`${selector.replace(/\./g, "\\.")}\\s*\\{([^}]*)\\}`),
  );
  if (!block) throw new Error(`rule ${selector} not found`);
  return readHexToken(block[1], token);
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

// Paper tokens from globals.css, and the panel's own text tokens.
const paper = readHexToken(globalsCss, "--paper");
const paperDeep = readHexToken(globalsCss, "--paper-deep");
const seal = readHexToken(globalsCss, "--seal");
const panelInk = readHexInBlock(liveCss, ".panel", "--ink");
const panelInkSoft = readHexInBlock(liveCss, ".panel", "--ink-soft");

// Desk tokens from ceremony.module.css.
const desk = readHexToken(ceremonyCss, "--desk");
const deskLit = readHexToken(ceremonyCss, "--desk-lit");
const deskLitMax = readHexToken(ceremonyCss, "--desk-lit-max");
const deskInk = readHexToken(ceremonyCss, "--desk-ink");
const deskInkSoft = readHexToken(ceremonyCss, "--desk-ink-soft");

/** Each pair names the element that uses it, so a failure points at the rule. */
const PAPER_PAIRS: ReadonlyArray<readonly [string, string, string]> = [
  ["panel ink (heading, labels, figure names)", panelInk, paper],
  ["panel ink on deep paper (figure rows, warning box)", panelInk, paperDeep],
  ["panel ink-soft (hints, counts, figure meta)", panelInkSoft, paper],
  ["panel ink-soft on deep paper (disabled button, fixture tag)", panelInkSoft, paperDeep],
  ["primary button text (paper on wax seal)", paper, seal],
];

const DESK_PAIRS: ReadonlyArray<readonly [string, string, string]> = [
  ["desk ink (LiveEntry heading and link) on desk", deskInk, desk],
  ["desk ink on the lit pool", deskInk, deskLit],
  ["desk ink on the brightest desk value", deskInk, deskLitMax],
  ["desk ink-soft (LiveEntry body) on desk", deskInkSoft, desk],
  ["desk ink-soft on the lit pool", deskInkSoft, deskLit],
  ["desk ink-soft on the brightest desk value", deskInkSoft, deskLitMax],
];

describe("live demo tokens were read from the real CSS", () => {
  it("parsed every token as a 6-digit hex value", () => {
    for (const hex of [
      paper,
      paperDeep,
      seal,
      panelInk,
      panelInkSoft,
      desk,
      deskLit,
      deskLitMax,
      deskInk,
      deskInkSoft,
    ]) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("computes the reference 21:1 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 2);
  });
});

describe("paper panel text meets WCAG 2.2 AA (R19.6)", () => {
  it.each(PAPER_PAIRS)("%s is at least 4.5:1", (_label, text, surface) => {
    expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(
      WCAG_AA_NORMAL,
    );
  });
});

describe("desk text meets WCAG 2.2 AA (R19.6)", () => {
  it.each(DESK_PAIRS)("%s is at least 4.5:1", (_label, text, surface) => {
    expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(
      WCAG_AA_NORMAL,
    );
  });
});
