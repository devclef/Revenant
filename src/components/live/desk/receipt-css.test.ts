// Feature: 14-write-desk, Task 6 (W10 to W12, G2.8). Reads panel.module.css
// and checks the receipt card rules: no decoration on the own number classes,
// the selected Figure_Row keyed on aria-pressed only, and the contrast of each
// text and control colour on the surface it sits on. The ratios are computed
// here, not written into the source. Pure file read, no DOM.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "panel.module.css"), "utf8");

/** Comments removed, so a documented value is not read as a declaration. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

interface Rule {
  selectors: string[];
  body: string;
}

/** Every plain `selector { body }` rule, comments removed. */
function rulesIn(source: string): Rule[] {
  const rules: Rule[] = [];
  for (const match of stripComments(source).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    rules.push({
      selectors: (match[1] ?? "").split(",").map((s) => s.trim()),
      body: match[2] ?? "",
    });
  }
  return rules;
}

/** The value of `prop` in every rule whose selector list includes `selector`. */
function valuesOf(selector: string, prop: string): string[] {
  const values: string[] = [];
  for (const rule of rulesIn(css)) {
    if (!rule.selectors.includes(selector)) continue;
    for (const decl of rule.body.split(";")) {
      const [name, ...rest] = decl.split(":");
      if (name?.trim() === prop) values.push(rest.join(":").trim());
    }
  }
  return values;
}

/** WCAG 2.x relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const channel = (offset: number) => {
    const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Contrast ratio of two #rrggbb colours (WCAG 2.x). */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/** Composites an rgb colour at alpha over a #rrggbb background. */
function composite(
  rgb: [number, number, number],
  alpha: number,
  bg: string,
): string {
  const back = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16));
  return (
    "#" +
    rgb
      .map((v, i) => Math.round(v * alpha + (back[i] ?? 0) * (1 - alpha)))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

const CARD = "#15111f";
const ROW = "#0b0912";
const TEXT_MUTED = "#bdb4dc";
const CHECK_BORDER = "#6d6488";
const PLACEHOLDER = "#8f86ad";
const TINT = composite([245, 243, 255], 0.06, CARD);

describe("receipt card: own number classes (W12.5)", () => {
  it("adds no pseudo-element and no side border to an .own* class", () => {
    const offenders: string[] = [];
    for (const rule of rulesIn(css)) {
      for (const selector of rule.selectors) {
        if (!/\.own/.test(selector)) continue;
        if (/::(before|after)/.test(selector)) offenders.push(selector);
        if (/border-(left|right)/.test(rule.body)) offenders.push(selector);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("receipt card: Figure_Row states (W11.3 to W11.5, X2.2)", () => {
  it("keys the selected state on aria-pressed and gives it a white border and tint", () => {
    expect(valuesOf('.figureRow[aria-pressed="true"]', "border")).toEqual([
      "1.5px solid #ffffff",
    ]);
    expect(valuesOf('.figureRow[aria-pressed="true"]', "background")).toEqual([
      "rgba(245, 243, 255, 0.06)",
    ]);
  });

  it("never styles a Figure_Row by :focus (only by the focus ring)", () => {
    const focusRules = rulesIn(css).filter((rule) =>
      rule.selectors.some((s) => /\.figureRow:focus(?!-visible)/.test(s)),
    );
    expect(focusRules).toEqual([]);
  });

  it("draws the focus ring as the only change on focus-visible", () => {
    expect(valuesOf(".figureRow:focus-visible", "outline")).toEqual([
      "2px solid #ff7b1c",
    ]);
    expect(valuesOf(".figureRow:focus-visible", "background")).toEqual([]);
  });
});

describe("receipt card contrast (G2.8, WCAG 2.2 AA)", () => {
  it("passes the muted text on the card, the unselected row and the selected tint", () => {
    expect(contrast(TEXT_MUTED, CARD)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(TEXT_MUTED, ROW)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(TEXT_MUTED, TINT)).toBeGreaterThanOrEqual(4.5);
  });

  it("passes the white text on the card and on the selected tint", () => {
    expect(contrast("#ffffff", CARD)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", TINT)).toBeGreaterThanOrEqual(4.5);
  });

  it("passes the unselected Figure_Row check square at 3:1 for non-text contrast", () => {
    expect(contrast(CHECK_BORDER, ROW)).toBeGreaterThanOrEqual(3);
  });

  it("passes the placeholder text in the own number inputs", () => {
    expect(contrast(PLACEHOLDER, ROW)).toBeGreaterThanOrEqual(4.5);
  });

  it("passes the active toggle text on its white pill", () => {
    expect(valuesOf(".toggleOn", "color")).toEqual(["#0b0912"]);
    expect(valuesOf(".toggleOn", "background")).toEqual(["#ffffff"]);
    expect(contrast("#0b0912", "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
});
