// Feature: 09-demo-polish (F1, F2)
//
// Pins the landing layout rules from issues #435 (F1 and F2): the ritual card
// padding, body text size and gaps, the two-column sections at 900 px and wider
// with the single column below it, and the rule that no copy changed.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BRAND_COPY } from "@/components/brand/copy";

import { LANDING_SECTION_COPY } from "./copy";
import { RitualSection } from "./RitualSection";

const here = fileURLToPath(new URL(".", import.meta.url));
const css = readFileSync(join(here, "landing.module.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Returns the text between the braces that open at `open` (index of "{"). */
function bodyFrom(source: string, open: number): string {
  let depth = 1;
  let end = open + 1;
  while (end < source.length && depth > 0) {
    if (source[end] === "{") depth++;
    if (source[end] === "}") depth--;
    end++;
  }
  return source.slice(open + 1, end - 1);
}

/** The body of a rule that starts at the beginning of a line, e.g. `.ritualCard`. */
function topRule(source: string, selector: string): string {
  const match = new RegExp(`(?:^|\\n)${escapeRegExp(selector)} \\{`).exec(
    source,
  );
  expect(match, `top-level rule ${selector} should exist`).not.toBeNull();
  const open = (match?.index ?? 0) + (match?.[0].length ?? 0) - 1;
  return bodyFrom(source, open);
}

/** The bodies of every @media block with the given query, in file order. */
function mediaBodies(source: string, query: string): string[] {
  const header = `@media ${query} {`;
  const bodies: string[] = [];
  let at = source.indexOf(header);
  while (at !== -1) {
    bodies.push(bodyFrom(source, at + header.length - 1));
    at = source.indexOf(header, at + header.length);
  }
  return bodies;
}

/** The body of a rule with the given selector inside a media body. */
function ruleIn(media: string, selector: string): string | undefined {
  const at = media.indexOf(`${selector} {`);
  if (at === -1) return undefined;
  return bodyFrom(media, at + selector.length + 1);
}

describe("F2 ritual cards: padding, text size and gaps", () => {
  it("gives each card 24 px (1.5rem) padding at every width", () => {
    const card = topRule(css, ".ritualCard");
    expect(card).toMatch(/padding:\s*1\.5rem;/);
  });

  it("sets the body text to 16 px (1rem) with line height 1.5", () => {
    const line = topRule(css, ".ritualLine");
    expect(line).toMatch(/font-size:\s*1rem;/);
    expect(line).toMatch(/line-height:\s*1\.5;/);
  });

  it("keeps the stacked phone and tablet gap at 0.75rem", () => {
    const list = topRule(css, ".ritualList");
    expect(list).toMatch(/gap:\s*0\.75rem;/);
  });

  it("puts 24 px (1.5rem) between the four desktop cards at 1024 px and wider", () => {
    const desktop = mediaBodies(css, "(min-width: 1024px)");
    expect(desktop).toHaveLength(1);
    const list = ruleIn(desktop[0] ?? "", ".ritualList");
    expect(list).toBeDefined();
    expect(list).toMatch(/grid-template-columns:\s*repeat\(4,/);
    expect(list).toMatch(/gap:\s*1\.5rem;/);
  });

  it("does not shrink the card padding or text size in any media block", () => {
    const allMedia = [
      ...mediaBodies(css, "(max-width: 599.98px)"),
      ...mediaBodies(css, "(min-width: 600px)"),
      ...mediaBodies(css, "(max-width: 899.98px)"),
      ...mediaBodies(css, "(min-width: 900px)"),
      ...mediaBodies(css, "(min-width: 1024px)"),
    ];
    for (const media of allMedia) {
      expect(ruleIn(media, ".ritualCard") ?? "").not.toMatch(/padding:/);
      expect(ruleIn(media, ".ritualLine") ?? "").not.toMatch(/font-size:/);
    }
  });
});

describe("F1 section layout: two halves at 900 px and wider", () => {
  it("keeps the base section a single column, with no grid", () => {
    const section = topRule(css, ".section");
    expect(section).not.toMatch(/display:\s*grid/);
    expect(section).not.toMatch(/grid-template-columns/);
  });

  it("makes the section a two-column grid only at 900 px and wider", () => {
    const wide = mediaBodies(css, "(min-width: 900px)");
    const grid = wide
      .map((media) => ruleIn(media, ".section"))
      .find((rule) => rule !== undefined);
    expect(grid).toBeDefined();
    expect(grid).toMatch(/display:\s*grid;/);
    expect(grid).toMatch(
      /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(0,\s*1fr\);/,
    );
    expect(grid).toMatch(/padding-right:\s*0;/);
  });

  it("puts the heading in the left half and the body in the right half", () => {
    const wide = mediaBodies(css, "(min-width: 900px)").join("\n");
    expect(wide).toMatch(/\.section > :first-child \{\s*grid-column:\s*1;/);
    expect(wide).toMatch(/\.section > \* \{\s*grid-column:\s*2;/);
  });

  it("spans the ritual list across both halves at 900 px and wider", () => {
    const wide = mediaBodies(css, "(min-width: 900px)").join("\n");
    expect(wide).toMatch(
      /\.section > \.ritualList \{\s*grid-column:\s*1 \/ -1;/,
    );
  });

  it("does not place the list across two columns below 900 px", () => {
    const narrow = [
      ...mediaBodies(css, "(max-width: 599.98px)"),
      ...mediaBodies(css, "(min-width: 600px)"),
      ...mediaBodies(css, "(max-width: 899.98px)"),
    ].join("\n");
    expect(narrow).not.toMatch(/grid-column:\s*1 \/ -1/);
    expect(narrow).not.toMatch(/\.section > \* \{/);
  });
});

describe("no copy change in the landing sections", () => {
  it("renders only the section title, step numbers, names and lines from copy", () => {
    const html = renderToStaticMarkup(<RitualSection />);
    const visibleText = html.replace(/<[^>]+>/g, "");
    const expected =
      LANDING_SECTION_COPY.ritualTitle +
      BRAND_COPY.ritualSteps
        .map((step, index) => `${index + 1}${step.name}${step.line}`)
        .join("");
    expect(visibleText).toBe(escapeHtml(expected));
  });
});
