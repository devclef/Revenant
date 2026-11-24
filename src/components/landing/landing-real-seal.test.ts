// Feature: 09-demo-polish (landing hero, Requirement B1: real seal link).
//
// Reads the rule text of landing.module.css for the real seal link. Pure file
// read, no DOM. The layout check measures the real render.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

const css = readFileSync(resolve(here, "landing.module.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** Returns the declarations of the first rule whose selector matches exactly. */
function body(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(
    css,
  );
  if (!match) throw new Error(`rule not found: ${selector}`);
  return match[1];
}

/** WCAG 2.x relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("landing real seal link CSS", () => {
  it("has a .realSeal rule in the text colour with no class named for accent", () => {
    expect(body(".realSeal")).toMatch(/color:\s*var\(--text\)/);
    expect(css).not.toMatch(/\.realSeal[\w-]*accent/i);
  });

  it("sets the link to at least 2.75rem tall and wide, in --text, with no fill or border", () => {
    const link = body(".realSealLink");
    expect(link).toMatch(/min-height:\s*2\.75rem/);
    expect(link).toMatch(/min-width:\s*2\.75rem/);
    expect(link).toMatch(/color:\s*var\(--text\)/);
    expect(link).toMatch(/background:\s*none/);
    expect(link).toMatch(/border:\s*none/);
    expect(link).not.toMatch(/var\(--accent\)/);
  });

  it("draws a 3px solid accent focus outline with an offset", () => {
    const focus = body(".realSealLink:focus-visible");
    expect(focus).toMatch(/outline:\s*3px solid var\(--accent\)/);
    expect(focus).toMatch(/outline-offset:\s*\d+px/);
  });

  it("puts the real seal link at order 1 on phones", () => {
    const start = css.indexOf("@media (max-width: 599.98px) {");
    expect(start).toBeGreaterThanOrEqual(0);
    const phone = css.slice(start, css.indexOf("\n}\n", start));
    expect(phone).toMatch(/\.realSeal\s*\{\s*order:\s*1;\s*\}/);
  });

  it("keeps the --text on --bg pair above 4.5:1", () => {
    expect(contrast("#f5f3ff", "#0b0912")).toBeGreaterThan(4.5);
  });
});
