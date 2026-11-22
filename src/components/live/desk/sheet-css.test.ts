// Feature: 14-write-desk, Task 7 (W4 and W5, G2.8). Reads sheet.module.css and
// letter-field.module.css and checks the Letter_Sheet and Letter_Field values.
// Pure file read, no DOM.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "sheet.module.css"), "utf8");
const letterFieldCss = readFileSync(
  join(here, "..", "letter-field.module.css"),
  "utf8",
);

interface Rule {
  selectors: string[];
  body: string;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

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

/** The values of `prop` in every rule for `selector`. */
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

/** Every rule body for `selector`, joined, with whitespace collapsed. */
function bodyOf(source: string, selector: string): string {
  return rulesIn(source)
    .filter((rule) => rule.selectors.includes(selector))
    .map((rule) => rule.body)
    .join(" ")
    .replace(/\s+/g, " ");
}

describe("the Letter_Sheet paper (W4.1)", () => {
  it("sets the paper, radius, padding and shadow", () => {
    expect(valuesOf(css, ".sheet", "background-color")).toContain("#f6ead4");
    expect(valuesOf(css, ".sheet", "border-radius")).toContain("6px");
    expect(valuesOf(css, ".sheet", "padding")).toContain(
      "48px var(--sheet-pad-x) 40px",
    );
    expect(valuesOf(css, ".sheet", "--sheet-pad-x")).toContain("56px");
    expect(valuesOf(css, ".sheet", "box-shadow")).toContain(
      "0 30px 80px rgba(0, 0, 0, 0.55)",
    );
  });

  it("drops the padding to 24 px 20 px below 600 px", () => {
    expect(mediaBody(css, "max-width: 599.98px")).toMatch(
      /\.sheet\s*\{[^}]*padding:\s*24px 20px/,
    );
  });

  it("sets the sheet ink to #1f1b16", () => {
    expect(valuesOf(css, ".sheet", "color")).toContain("#1f1b16");
  });
});

describe("the top and bottom rows (W4.2, W4.4)", () => {
  it("lays both rows out space-between on one wrapping line", () => {
    for (const selector of [".topRow", ".bottomRow"]) {
      expect(valuesOf(css, selector, "display"), selector).toContain("flex");
      expect(valuesOf(css, selector, "justify-content"), selector).toContain(
        "space-between",
      );
      expect(valuesOf(css, selector, "flex-wrap"), selector).toContain("wrap");
    }
  });

  it("stacks the top row and left-aligns it below 600 px", () => {
    const phone = mediaBody(css, "max-width: 599.98px");
    expect(phone).toMatch(/\.topRow\s*\{[^}]*flex-direction:\s*column/);
    expect(phone).toMatch(/\.topRow\s*\{[^}]*align-items:\s*flex-start/);
  });
});

describe("the salutation, date, sign-off and count (W4.2, W4.4)", () => {
  it("sets the salutation to 26 px #1f1b16", () => {
    expect(valuesOf(css, ".salutation", "font-size")).toContain("26px");
    expect(valuesOf(css, ".salutation", "color")).toContain("#1f1b16");
  });

  it("sets the date to 13 px #4a4036", () => {
    expect(valuesOf(css, ".date", "font-size")).toContain("13px");
    expect(valuesOf(css, ".date", "color")).toContain("#4a4036");
  });

  it("sets the sign-off to 20 px #4a4036", () => {
    expect(valuesOf(css, ".signOff", "font-size")).toContain("20px");
    expect(valuesOf(css, ".signOff", "color")).toContain("#4a4036");
  });

  it("sets the count to 12 px #4a4036", () => {
    expect(valuesOf(css, ".count", "font-size")).toContain("12px");
    expect(valuesOf(css, ".count", "color")).toContain("#4a4036");
  });

  it("leaves the serif of the salutation and sign-off to letter-field.module.css", () => {
    // sheet.module.css may not set a font-family on them, so the one serif rule
    // is the only font declaration that applies (serif-scope guard).
    expect(valuesOf(css, ".salutation", "font-family")).toEqual([]);
    expect(valuesOf(css, ".signOff", "font-family")).toEqual([]);
    expect(valuesOf(letterFieldCss, ".sheetSerif", "font-family")).toContain(
      "var(--font-serif)",
    );
    expect(valuesOf(letterFieldCss, ".sheetSerif", "font-style")).toContain(
      "italic",
    );
  });
});

describe("the Letter_Field (W5.1 to W5.4)", () => {
  const letter = bodyOf(css, ".letter");

  it("has no border and a transparent background (W5.1)", () => {
    expect(valuesOf(css, ".letter", "border")).toContain("0");
    expect(valuesOf(css, ".letter", "background-color")).toContain(
      "transparent",
    );
  });

  it("sets 21 px text on a 32 px line in #1f1b16 (W5.1)", () => {
    expect(valuesOf(css, ".letter", "font-size")).toContain("21px");
    expect(valuesOf(css, ".letter", "line-height")).toContain("32px");
    expect(valuesOf(css, ".letter", "color")).toContain("#1f1b16");
  });

  it("draws a rule every 32 px in rgba(74, 64, 54, 0.16) (W5.2)", () => {
    expect(letter).toMatch(/repeating-linear-gradient\(/);
    expect(letter).toMatch(
      /transparent 0 31px, rgba\(74, 64, 54, 0\.16\) 31px 32px/,
    );
  });

  it("moves the rules with the text when the field scrolls (W5.2)", () => {
    expect(valuesOf(css, ".letter", "background-attachment")).toContain(
      "local",
    );
    expect(valuesOf(css, ".letter", "--rule-offset")).toContain("7px");
    expect(valuesOf(css, ".letter", "background-position")).toContain(
      "0 var(--rule-offset, 7px)",
    );
  });

  it("is at least 296 px tall (W5.3)", () => {
    expect(valuesOf(css, ".letter", "min-height")).toContain("296px");
  });

  it("shows an italic #6b5f51 placeholder (W5.4)", () => {
    expect(valuesOf(css, ".letter::placeholder", "font-style")).toContain(
      "italic",
    );
    expect(valuesOf(css, ".letter::placeholder", "color")).toContain("#6b5f51");
  });

  it("shows the orange focus ring with a 1 px #1f1b16 line (W5.1)", () => {
    expect(valuesOf(css, ".letter:focus-visible", "outline")).toContain(
      "2px solid #ff7b1c",
    );
    expect(valuesOf(css, ".letter:focus-visible", "box-shadow")).toContain(
      "0 1px 0 0 #1f1b16",
    );
  });

  it("sets no maxlength in the stylesheet", () => {
    expect(stripComments(css)).not.toMatch(/maxlength/i);
  });
});

// Spec 14 W6 to W8 (task 3 and 4 of #471): the Perforation, the Question_Section,
// the Question_Row and its Wax_Disc, and the Suggestion_Pills. Each value is read
// from the module that owns it.
const sectionCss = readFileSync(
  join(here, "question-section.module.css"),
  "utf8",
);
const waxDiscCss = readFileSync(join(here, "wax-disc.module.css"), "utf8");

describe("the Perforation (W6.1)", () => {
  it("runs edge to edge with negative margins equal to --sheet-pad-x", () => {
    expect(valuesOf(css, ".sheet", "--sheet-pad-x")).toContain("56px");
    expect(mediaBody(css, "max-width: 599.98px")).toMatch(
      /--sheet-pad-x:\s*20px/,
    );
    expect(valuesOf(css, ".perforation", "margin")).toContain(
      "36px calc(var(--sheet-pad-x) * -1) 32px",
    );
  });

  it("is a 2 px dashed line in rgba(74, 64, 54, 0.28)", () => {
    expect(valuesOf(css, ".perforation", "border-top")).toContain(
      "2px dashed rgba(74, 64, 54, 0.28)",
    );
  });
});

describe("the Question_Section rows and legend (W6.2 to W6.4)", () => {
  it("sets rows 22 px apart", () => {
    expect(valuesOf(sectionCss, ".rows", "row-gap")).toContain("22px");
  });

  it("sets the legend to 26 px weight 500 in #1f1b16", () => {
    expect(valuesOf(sectionCss, ".legend", "font-size")).toContain("26px");
    expect(valuesOf(sectionCss, ".legend", "font-weight")).toContain("500");
    expect(valuesOf(sectionCss, ".legend", "color")).toContain("var(--ink)");
    expect(valuesOf(sectionCss, ".questions", "--ink")).toContain("#1f1b16");
  });

  it("sets the intro to 14 px #4a4036 at most 560 px wide", () => {
    expect(valuesOf(sectionCss, ".intro", "font-size")).toContain("14px");
    expect(valuesOf(sectionCss, ".intro", "max-width")).toContain("560px");
    expect(valuesOf(sectionCss, ".questions", "--ink-muted")).toContain(
      "#4a4036",
    );
  });
});

describe("the Question_Row (W7.1, W7.3, W7.5)", () => {
  it("is a flex row with a 16 px gap", () => {
    expect(valuesOf(sectionCss, ".row", "display")).toContain("flex");
    expect(valuesOf(sectionCss, ".row", "gap")).toContain("16px");
  });

  it("sets the input to 21 px italic serif with a 1 px bottom rule", () => {
    expect(valuesOf(sectionCss, ".qInput", "font-size")).toContain("21px");
    expect(valuesOf(sectionCss, ".qInput", "background")).toContain(
      "transparent",
    );
    expect(valuesOf(sectionCss, ".qInput", "border-bottom")).toContain(
      "1px solid rgba(31, 27, 22, 0.35)",
    );
    expect(
      valuesOf(sectionCss, ".qInput:hover", "border-bottom-color"),
    ).toContain("var(--ink)");
  });

  it("sets the Lock_Line to 13 px #4a4036 with 10 px above it", () => {
    expect(valuesOf(sectionCss, ".lock", "font-size")).toContain("13px");
    expect(valuesOf(sectionCss, ".lock", "color")).toContain(
      "var(--ink-muted)",
    );
    expect(valuesOf(sectionCss, ".lock", "margin")).toContain("10px 0 0");
  });

  it("sets the Edit control to 12 px with a 24 px target", () => {
    expect(valuesOf(sectionCss, ".edit", "font-size")).toContain("12px");
    expect(valuesOf(sectionCss, ".edit", "min-width")).toContain("24px");
    expect(valuesOf(sectionCss, ".edit", "min-height")).toContain("24px");
  });
});

describe("the Wax_Disc (W7.2)", () => {
  it("is a 30 px #ff7b1c circle with #0b0912 text", () => {
    expect(valuesOf(waxDiscCss, ".disc", "width")).toContain("30px");
    expect(valuesOf(waxDiscCss, ".disc", "height")).toContain("30px");
    expect(valuesOf(waxDiscCss, ".disc", "border-radius")).toContain("50%");
    expect(valuesOf(waxDiscCss, ".disc", "background")).toContain("#ff7b1c");
    expect(valuesOf(waxDiscCss, ".disc", "color")).toContain("#0b0912");
  });

  it("sets the number to 13 px weight 800 with the inset shadow", () => {
    expect(valuesOf(waxDiscCss, ".disc", "font-size")).toContain("13px");
    expect(valuesOf(waxDiscCss, ".disc", "font-weight")).toContain("800");
    expect(valuesOf(waxDiscCss, ".disc", "box-shadow")).toContain(
      "inset 0 -2px 0 rgba(0, 0, 0, 0.18)",
    );
  });
});

describe("the Suggestion_Pills (W8.1, W8.2)", () => {
  it("sets the label to 13 px #4a4036", () => {
    expect(valuesOf(sectionCss, ".askLabel", "font-size")).toContain("13px");
    expect(valuesOf(sectionCss, ".askLabel", "color")).toContain(
      "var(--ink-muted)",
    );
  });

  it("makes each pill 44 px tall, fully rounded, with a 1 px rgba(74, 64, 54, 0.35) border", () => {
    expect(valuesOf(sectionCss, ".pill", "min-height")).toContain("44px");
    expect(valuesOf(sectionCss, ".pill", "border-radius")).toContain("999px");
    expect(valuesOf(sectionCss, ".pill", "border")).toContain(
      "1px solid rgba(74, 64, 54, 0.35)",
    );
    expect(valuesOf(sectionCss, ".pill", "overflow-wrap")).toContain(
      "anywhere",
    );
  });

  it("sets the pill text to 17 px italic", () => {
    expect(valuesOf(sectionCss, ".pill", "font-size")).toContain("17px");
    expect(valuesOf(sectionCss, ".pill", "font-style")).toContain("italic");
  });

  it('sets "+ Write my own" to 14 px weight 600 in the sans face', () => {
    expect(valuesOf(sectionCss, ".writeOwn", "font-family")).toContain(
      "var(--font-sans)",
    );
    expect(valuesOf(sectionCss, ".writeOwn", "font-size")).toContain("14px");
    expect(valuesOf(sectionCss, ".writeOwn", "font-weight")).toContain("600");
  });
});
