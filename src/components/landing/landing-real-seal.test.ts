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

const tokens = readFileSync(
  resolve(here, "../ceremony/scene/tokens.css"),
  "utf8",
);

/** Reads one colour token from tokens.css, as a #rrggbb string. */
function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(tokens);
  if (!match) throw new Error(`token not found: --${name}`);
  return match[1];
}

/** Returns the declarations of the first rule whose selector matches exactly. */
function body(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(
    css,
  );
  if (!match) throw new Error(`rule not found: ${selector}`);
  return match[1];
}

/** The text of one @media block, from its opening line to the next column-0 brace. */
function media(query: string): string {
  const start = css.indexOf(query);
  if (start < 0) throw new Error(`media block not found: ${query}`);
  return css.slice(start, css.indexOf("\n}\n", start));
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
  it("has a .realSeal rule on the desk background, in the text colour, with no class named for accent", () => {
    const seal = body(".realSeal");
    expect(seal).toMatch(/background:\s*var\(--bg\)/);
    expect(seal).toMatch(/color:\s*var\(--text\)/);
    expect(css).not.toMatch(/\.realSeal[\w-]*accent/i);
  });

  it("aligns the .realSeal box to the start of the hero column", () => {
    expect(body(".realSeal")).toMatch(/align-self:\s*flex-start/);
  });

  it("pulls the .realSeal box up by a negative top margin on desktop", () => {
    expect(media("@media (min-width: 600px) {")).toMatch(
      /\.realSeal\s*\{\s*margin-top:\s*-\d+(\.\d+)?rem;\s*\}/,
    );
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

  it("puts the real seal link at order 1 with a phone margin-top, after the calls to action", () => {
    const phone = media("@media (max-width: 599.98px) {");
    expect(phone).toMatch(
      /\.realSeal\s*\{\s*order:\s*1;\s*margin-top:\s*0\.25rem;\s*\}/,
    );
    expect(phone).toMatch(/\.actions\s*\{\s*order:\s*1;\s*\}/);
  });

  it("keeps the --text on --bg pair above 4.5:1, using the scene tokens", () => {
    expect(contrast(token("text"), token("bg"))).toBeGreaterThan(4.5);
  });
});
