// Feature: 05-reveal-ceremony, issue #119
//
// The Demo label sits on the dark ceremony desk on the persona page, and on
// the paper index page. Its text and rule colours come from two tokens, which
// DeskScene overrides on the desk. This test reads those declarations from the
// CSS files and checks the contrast for each surface.
//
// Text: 4.5:1 (WCAG 2.2 AA normal text). Rule: 3:1 (WCAG 1.4.11 non-text).

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(resolve(here, ...parts), "utf8");

const ceremonyCss = read("..", "ceremony.module.css");
const deskCss = read("DeskScene.module.css");
const labelCss = read("..", "..", "demo", "DemoLabel.module.css");
const globalsCss = read("..", "..", "..", "app", "globals.css");

function readHex(css: string, token: string, source: string): string {
  const match = css.match(new RegExp(`${token}\\s*:\\s*(#[0-9a-fA-F]{6})\\b`));
  if (!match) throw new Error(`token ${token} not found as hex in ${source}`);
  return match[1].toLowerCase();
}

function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe("Demo label contrast (issue #119)", () => {
  it("the desk sets the Demo label tokens to desk ink and desk gold", () => {
    expect(deskCss).toMatch(/--demo-label-ink:\s*var\(--desk-ink\)/);
    expect(deskCss).toMatch(/--demo-label-rule:\s*var\(--desk-gold\)/);
  });

  it("the Demo label reads its colours from those tokens", () => {
    expect(labelCss).toMatch(/color:\s*var\(--demo-label-ink,/);
    expect(labelCss).toMatch(/border:\s*1px solid var\(--demo-label-rule,/);
  });

  const deskSurfaces = ["--desk", "--desk-lit", "--desk-lit-max"] as const;
  for (const surface of deskSurfaces) {
    it(`desk ink on ${surface} is at least 4.5:1`, () => {
      const ink = readHex(ceremonyCss, "--desk-ink", "ceremony.module.css");
      const bg = readHex(ceremonyCss, surface, "ceremony.module.css");
      expect(contrast(ink, bg)).toBeGreaterThanOrEqual(4.5);
    });
  }

  for (const surface of ["--paper", "--paper-deep"] as const) {
    it(`paper ink-soft default on ${surface} is at least 4.5:1`, () => {
      const ink = readHex(globalsCss, "--ink-soft", "globals.css");
      const bg = readHex(globalsCss, surface, "globals.css");
      expect(contrast(ink, bg)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("the desk gold rule clears 3:1 on every desk surface", () => {
    const rule = readHex(ceremonyCss, "--desk-gold", "ceremony.module.css");
    for (const surface of deskSurfaces) {
      const bg = readHex(ceremonyCss, surface, "ceremony.module.css");
      expect(contrast(rule, bg), `${surface}`).toBeGreaterThanOrEqual(3);
    }
  });
});
