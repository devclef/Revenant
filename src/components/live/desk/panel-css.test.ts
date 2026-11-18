// Feature: 14-write-desk, Task 5.6 (W9, W13, G1.6, G2.8). Reads
// panel.module.css and checks every W9 and W13 value, that the Accent colours
// appear only in the Fold_Button, the marker and the focus ring, and the
// contrast of the Fold_Button text. The ratios are computed here, not written
// into the source. Pure file read, no DOM.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "panel.module.css"), "utf8");

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

/** The inner text of the @media block whose query is `query`. */
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

/** The value of `prop` in every rule for `selector` (comments stripped). */
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

/** The one value of `prop` for `selector`. Fails when it is missing or set twice. */
function valueOf(source: string, selector: string, prop: string): string {
  const values = valuesOf(source, selector, prop);
  expect(values, `${selector} ${prop}`).toHaveLength(1);
  return values[0] ?? "";
}

/** WCAG 2.x relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const channel = (offset: number) => {
    const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
  );
}

/** WCAG contrast ratio between two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The Accent selectors that may carry the Accent colours: the Fold_Button, the
 * marker and the focus rings (G1.6). The receipt card's focus rings are added
 * here too (W10.3, W11.5, W12), since a focus ring is the one other Accent use.
 */
const ACCENT_SELECTORS = [
  ".markerOn",
  ".fold",
  ".fold:hover",
  ".fold:focus-visible",
  ".toggleOn:focus-visible",
  ".toggleOff:focus-visible",
  ".figureRow:focus-visible",
  ".detailsButton:focus-visible",
  ".ownInput:focus-visible",
  ".receiptSummary:focus-visible",
];
const ACCENT_PATTERN = /#ff7b1c|#ff8f3d|rgba\(\s*255\s*,\s*123\s*,\s*28\s*,/i;

describe("panel.module.css (spec 14, W9)", () => {
  it("spaces the Envelope_Panel's cards 20 px apart", () => {
    expect(valueOf(css, ".panel", "gap")).toBe("20px");
  });

  it("gives each card its background, border, radius and padding", () => {
    expect(valueOf(css, ".card", "background")).toBe("#15111f");
    expect(valueOf(css, ".card", "border")).toBe("1px solid #2a2340");
    expect(valueOf(css, ".card", "border-radius")).toBe("10px");
    expect(valueOf(css, ".card", "padding")).toBe("24px");
  });

  it("sets the eyebrow in 12 px weight 600, .16em spacing, #bdb4dc, capitals", () => {
    expect(valueOf(css, ".eyebrow", "font-size")).toBe("12px");
    expect(valueOf(css, ".eyebrow", "font-weight")).toBe("600");
    expect(valueOf(css, ".eyebrow", "letter-spacing")).toBe("0.16em");
    expect(valueOf(css, ".eyebrow", "color")).toBe("#bdb4dc");
    expect(valueOf(css, ".eyebrow", "text-transform")).toBe("uppercase");
  });

  it("draws the small envelope 150 px tall in #f1e4c8 with a #e6d5b2 flap", () => {
    expect(valueOf(css, ".smallEnvelope", "height")).toBe("150px");
    expect(valueOf(css, ".smallEnvelope", "background")).toBe("#f1e4c8");
    expect(valueOf(css, ".smallFlap", "background")).toBe("#e6d5b2");
  });

  it("sets the small seal at 35 % opacity, and full opacity once data-ready is set", () => {
    expect(valueOf(css, ".smallSeal", "opacity")).toBe("0.35");
    expect(valueOf(css, ".smallSeal[data-ready]", "opacity")).toBe("1");
  });

  it("sets the Checklist_Lines in 14 px with 12 px between lines", () => {
    expect(valueOf(css, ".checklist", "font-size")).toBe("14px");
    expect(valueOf(css, ".checklist", "row-gap")).toBe("12px");
  });

  it("draws each marker as a 20 px circle", () => {
    expect(valueOf(css, ".markerOn", "width")).toBe("20px");
    expect(valueOf(css, ".markerOn", "height")).toBe("20px");
    expect(valueOf(css, ".markerOn", "border-radius")).toBe("50%");
    expect(valueOf(css, ".markerOff", "border")).toBe("1.5px dashed #6d6488");
  });

  it("fills a present marker #ff7b1c with a dark tick", () => {
    expect(valueOf(css, ".markerOn", "background")).toBe("#ff7b1c");
    expect(valueOf(css, ".markerOn", "color")).toBe("#0b0912");
  });

  it("sets each Checklist_Line value in #bdb4dc and each label in #ffffff", () => {
    expect(valueOf(css, ".value", "color")).toBe("#bdb4dc");
    expect(valueOf(css, ".label", "color")).toBe("#ffffff");
  });

  it("shows the phone line only below 600 px and hides the checklist there", () => {
    // The base rule hides the phone line; the max-width 599 px block shows it.
    expect(valuesOf(css, ".phoneLine", "display")).toEqual(["none", "block"]);
    const phone = mediaBody(css, "max-width: 599px");
    const phoneRules = rulesIn(phone);
    const display = (selector: string) =>
      phoneRules
        .filter((rule) => rule.selectors.includes(selector))
        .flatMap((rule) => rule.body.split(";"))
        .map((decl) => decl.split(":").map((s) => s.trim()))
        .filter(([name]) => name === "display")
        .map(([, value]) => value);
    expect(display(".checklist")).toEqual(["none"]);
    expect(display(".phoneLine")).toEqual(["block"]);
  });

  it("keeps the small seal still under prefers-reduced-motion", () => {
    const reduced = rulesIn(mediaBody(css, "prefers-reduced-motion: reduce"));
    const seal = reduced.find((rule) => rule.selectors.includes(".smallSeal"));
    expect(seal?.body).toContain("transition: none");
  });
});

describe("panel.module.css (spec 14, W13)", () => {
  it("makes the Fold_Button a full-width 56 px pill", () => {
    expect(valueOf(css, ".fold", "width")).toBe("100%");
    expect(valueOf(css, ".fold", "min-height")).toBe("56px");
    expect(valueOf(css, ".fold", "border-radius")).toBe("999px");
  });

  it("fills the Fold_Button solid #ff7b1c with #0b0912 16 px weight 800 text", () => {
    expect(valueOf(css, ".fold", "background")).toBe("#ff7b1c");
    expect(valueOf(css, ".fold", "color")).toBe("#0b0912");
    expect(valueOf(css, ".fold", "font")).toBe("800 16px var(--font-sans)");
  });

  it("changes the Fold_Button fill to #ff8f3d on hover", () => {
    expect(valueOf(css, ".fold:hover", "background")).toBe("#ff8f3d");
  });

  it("centres the Rehearsal_Line in 13 px #bdb4dc", () => {
    expect(valueOf(css, ".rehearsal", "font-size")).toBe("13px");
    expect(valueOf(css, ".rehearsal", "color")).toBe("#bdb4dc");
    expect(valueOf(css, ".rehearsal", "text-align")).toBe("center");
  });

  it("gives the Fold_Button an accent focus ring", () => {
    expect(valueOf(css, ".fold:focus-visible", "outline")).toBe(
      "2px solid #ff7b1c",
    );
  });
});

describe("panel.module.css Accent use (spec 14, W13.5, G1.6)", () => {
  it("uses the Accent colours only in the Fold_Button, the marker and the focus ring", () => {
    const offenders: string[] = [];
    for (const rule of rulesIn(css)) {
      if (!ACCENT_PATTERN.test(rule.body)) continue;
      for (const selector of rule.selectors) {
        if (!ACCENT_SELECTORS.includes(selector)) offenders.push(selector);
      }
    }
    expect(offenders, "Accent outside the allowed selectors").toEqual([]);
  });

  it("uses #ff8f3d only on the Fold_Button hover", () => {
    const hits = rulesIn(css)
      .filter((rule) => /#ff8f3d/i.test(rule.body))
      .flatMap((rule) => rule.selectors);
    expect(hits).toEqual([".fold:hover"]);
  });
});

describe("panel.module.css contrast (spec 14, W13.1, G2.8)", () => {
  // The threshold for normal text under WCAG 2.2 AA (SC 1.4.3).
  const AA_NORMAL = 4.5;

  it("passes the Fold_Button text #0b0912 on the resting fill #ff7b1c", () => {
    expect(contrast("#0b0912", "#ff7b1c")).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("passes the Fold_Button text #0b0912 on the hover fill #ff8f3d", () => {
    expect(contrast("#0b0912", "#ff8f3d")).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("passes the card text colours on the card background #15111f", () => {
    expect(contrast("#bdb4dc", "#15111f")).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(contrast("#ffffff", "#15111f")).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("passes the Rehearsal_Line colour on the dark page background", () => {
    // The desk is transparent over the step's dark page, --bg #0b0912
    // (spec 14 S2.1), so the Rehearsal_Line text sits on that colour.
    expect(contrast("#bdb4dc", "#0b0912")).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});
