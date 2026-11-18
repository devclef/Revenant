// Feature: 14-write-desk, Task 7 (W1 to W3, G2.8). Reads desk.module.css and
// checks the Write desk's layout, header and Occasion pill values. Pure file
// read, no DOM.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "desk.module.css"), "utf8");

interface Rule {
  selectors: string[];
  body: string;
}

/** Comments removed, so a documented value is not read as a declaration. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Every plain `selector { body }` rule. Media blocks are read through their inner rules. */
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

/** The inner text of the @media block whose header contains `query`. */
function mediaBody(source: string, query: string): string {
  const clean = stripComments(source);
  const start = clean.indexOf(`@media (${query})`);
  if (start < 0) throw new Error(`no @media (${query})`);
  const open = clean.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < clean.length; i++) {
    if (clean[i] === "{") depth++;
    if (clean[i] === "}") {
      depth--;
      if (depth === 0) return clean.slice(open + 1, i);
    }
  }
  throw new Error(`unclosed @media (${query})`);
}

/** The value of `prop` in every rule for `selector`, comments stripped. */
function valuesOf(source: string, selector: string, prop: string): string[] {
  const values: string[] = [];
  for (const rule of rulesIn(source)) {
    if (!rule.selectors.includes(selector)) continue;
    for (const decl of rule.body.split(";")) {
      const [name, ...rest] = decl.split(":");
      if (name?.trim() === prop) values.push(rest.join(":").trim());
    }
  }
  return values;
}

describe("the Write desk container and row (W1)", () => {
  it.each([
    [".container", "max-width", "1240px"],
    [".container", "padding-inline", "32px"],
    [".container", "margin-inline", "auto"],
    [".row", "display", "flex"],
    [".row", "flex-wrap", "wrap"],
    [".row", "gap", "32px"],
    [".row", "margin-top", "28px"],
    [".sheetColumn", "flex", "999 1 620px"],
    [".panelColumn", "flex", "1 1 340px"],
  ])("%s sets %s to %s", (selector, prop, value) => {
    expect(valuesOf(css, selector, prop)).toContain(value);
  });

  it("gives the desk surface its own light text colour", () => {
    expect(valuesOf(css, ".container", "color")).toContain("#ffffff");
  });

  it("keeps the panel column at the start of its row so it can stick (W1.3)", () => {
    expect(valuesOf(css, ".panelColumn", "align-self")).toContain("flex-start");
  });
});

describe("the Write step header (W2)", () => {
  it("sets the eyebrow to 12 px weight 600, .16em tracking, capitals, #bdb4dc", () => {
    expect(valuesOf(css, ".eyebrow", "font-size")).toContain("12px");
    expect(valuesOf(css, ".eyebrow", "font-weight")).toContain("600");
    expect(valuesOf(css, ".eyebrow", "letter-spacing")).toContain("0.16em");
    expect(valuesOf(css, ".eyebrow", "text-transform")).toContain("uppercase");
    expect(valuesOf(css, ".eyebrow", "color")).toContain("#bdb4dc");
  });

  it("sets the h1 to Inter 56 px, weight 900, -0.03em, 1.02 line height, #ffffff", () => {
    expect(valuesOf(css, ".heading", "font-size")).toContain("56px");
    expect(valuesOf(css, ".heading", "font-weight")).toContain("900");
    expect(valuesOf(css, ".heading", "letter-spacing")).toContain("-0.03em");
    expect(valuesOf(css, ".heading", "line-height")).toContain("1.02");
    expect(valuesOf(css, ".heading", "color")).toContain("#ffffff");
  });

  it("drops the h1 to 36 px below 600 px", () => {
    expect(mediaBody(css, "max-width: 599px")).toMatch(
      /\.heading\s*\{[^}]*font-size:\s*36px/,
    );
  });

  it("sets the intro to 17 px #bdb4dc, at most 620 px wide", () => {
    expect(valuesOf(css, ".intro", "font-size")).toContain("17px");
    expect(valuesOf(css, ".intro", "color")).toContain("#bdb4dc");
    expect(valuesOf(css, ".intro", "max-width")).toContain("620px");
  });
});

describe("the Occasion pills (W3)", () => {
  it("makes each pill 44 px tall, fully rounded, with 16 px side padding", () => {
    expect(valuesOf(css, ".pill", "min-height")).toContain("44px");
    expect(valuesOf(css, ".pill", "border-radius")).toContain("999px");
    expect(valuesOf(css, ".pill", "padding")).toContain("0 16px");
  });

  it("sets the pill text to 14 px weight 500 and white", () => {
    expect(valuesOf(css, ".pill", "font-size")).toContain("14px");
    expect(valuesOf(css, ".pill", "font-weight")).toContain("500");
    expect(valuesOf(css, ".pill", "color")).toContain("#ffffff");
  });

  it("gives an unselected pill a transparent background and a 1 px #4a4266 border", () => {
    expect(valuesOf(css, ".pill", "background")).toContain("transparent");
    expect(valuesOf(css, ".pill", "border")).toContain("1px solid #4a4266");
  });

  it("gives the selected pill a solid white fill and #0b0912 text", () => {
    expect(valuesOf(css, '.pill[aria-pressed="true"]', "background")).toContain(
      "#ffffff",
    );
    expect(valuesOf(css, '.pill[aria-pressed="true"]', "color")).toContain(
      "#0b0912",
    );
  });

  it("keeps the pills on one line that scrolls sideways below 600 px (W3.5)", () => {
    const phone = mediaBody(css, "max-width: 599px");
    expect(phone).toMatch(/\.pills\s*\{[^}]*flex-wrap:\s*nowrap/);
    expect(phone).toMatch(/\.pills\s*\{[^}]*overflow-x:\s*auto/);
    expect(phone).toMatch(/\.pills\s*\{[^}]*overscroll-behavior-x:\s*contain/);
  });
});

describe("no desk module changes font synthesis (G2.8)", () => {
  it("sets font-synthesis: none in no desk module", () => {
    const dir = here;
    const modules = readdirSync(dir).filter((name) =>
      name.endsWith(".module.css"),
    );
    expect(modules.length).toBeGreaterThan(0);
    for (const name of modules) {
      const source = stripComments(readFileSync(join(dir, name), "utf8"));
      expect(source, name).not.toMatch(/font-synthesis\s*:\s*none/);
    }
  });
});
