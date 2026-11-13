// Feature: 09-demo-polish (H1, example tests)
//
// Example tests for the general-letter landing sections and the static
// Coven_Strip: the strip takes no props and renders two links, no source file
// under src imports kiro-stats, the three SampleReceipt files are gone, and the
// section copy names no fuel price as what a letter holds.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { renderToStaticMarkup } from "react-dom/server";

import { LANDING_SECTION_COPY } from "./copy";
import { CovenStrip } from "./CovenStrip";
import { NoSealSection } from "./NoSealSection";
import { ResurrectionSection } from "./ResurrectionSection";
import { RitualSection } from "./RitualSection";
import { SceneShell } from "@/components/ceremony/scene/SceneShell";

const here = fileURLToPath(new URL(".", import.meta.url));
const srcRoot = resolve(here, "../..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe("CovenStrip (H1 example tests)", () => {
  it("takes no props", () => {
    expect(CovenStrip.length).toBe(0);
  });

  it("renders exactly two links in the rendered markup", () => {
    const html = renderToStaticMarkup(<CovenStrip />);
    expect((html.match(/<a /g) ?? []).length).toBe(2);
  });
});

describe("touch targets and one column (H1)", () => {
  it("sets every landing link to at least 44 CSS px in both directions", () => {
    const css = readFileSync(join(here, "landing.module.css"), "utf8");
    const rule = css.match(/\.covenLink \{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toMatch(/min-height:\s*2\.75rem/);
    expect(rule).toMatch(/min-width:\s*2\.75rem/);
  });
});

describe("section text measure clear of the Ghost (H1 step 1)", () => {
  const landingCss = readFileSync(join(here, "landing.module.css"), "utf8");
  const sceneCss = readFileSync(
    join(here, "../ceremony/scene/scene.module.css"),
    "utf8",
  );

  it("keeps the 1200 px full-width frame under the landing column", () => {
    const rule = sceneCss.match(/\.landingBelowFrame \{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toMatch(/max-width:\s*1200px/);
    expect(rule).toMatch(/width:\s*100%/);
  });

  it("aligns the section text with the hero text at 600 px and wider", () => {
    const media =
      landingCss.match(
        /@media \(min-width: 600px\) \{\n  \.section \{([^}]*)\}/,
      )?.[1] ?? "";
    expect(media).toMatch(/padding-left:\s*1\.25rem/);
  });

  it("keeps the full-width section box", () => {
    const rule = landingCss.match(/\n\.section \{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toMatch(/width:\s*100%/);
  });

  it("ends the section text at the Ghost's visible left edge at 900 px and wider", () => {
    const media =
      landingCss.match(
        /@media \(min-width: 900px\) \{\n  \.section \{([^}]*)\}/,
      )?.[1] ?? "";
    expect(media).toMatch(/--text-right:\s*calc\(\s*var\(--ghost-x\)/);
    expect(media).toMatch(/min\(50vh,\s*560px\)\s*\*\s*0\.12/);
    expect(media).toMatch(/padding-inline-end:\s*max\(\s*0px,\s*calc\(/);
    expect(media).toMatch(/var\(--section-right\)\s*-\s*var\(--text-right\)/);
  });
});

describe("Retired_Phrase search over the rendered sections (H1)", () => {
  const rendered = [
    renderToStaticMarkup(<RitualSection />),
    renderToStaticMarkup(<ResurrectionSection />),
    renderToStaticMarkup(<NoSealSection />),
    renderToStaticMarkup(<CovenStrip />),
  ]
    .join(" ")
    .toLowerCase();

  it("finds no retired phrase in any rendered section", () => {
    for (const phrase of [
      "seal the figures",
      "fuel prices from the us or the eu",
      "check your connection and reload the page",
      "what's on your mind right now?",
      "cross-examine",
      "misremembered",
    ]) {
      expect(rendered).not.toContain(phrase);
    }
  });
});

describe("SampleReceipt removal", () => {
  it("has no SampleReceipt.tsx, SampleReceiptView.tsx or sample-receipt.ts", () => {
    expect(existsSync(join(here, "SampleReceipt.tsx"))).toBe(false);
    expect(existsSync(join(here, "SampleReceiptView.tsx"))).toBe(false);
    expect(existsSync(join(here, "sample-receipt.ts"))).toBe(false);
  });
});

describe("kiro-stats removal", () => {
  it("no source file under src imports kiro-stats", () => {
    const offenders = walk(srcRoot)
      .filter((file) => /\.(ts|tsx|js|mjs|cjs)$/.test(file))
      .filter((file) => !file.endsWith("landing-general.test.tsx"))
      .filter((file) => /kiro-stats/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("general-letter section copy (H1)", () => {
  // Every string the three sections and the strip print, not a subset.
  const sectionText = Object.values(LANDING_SECTION_COPY)
    .flat()
    .map((value) => (typeof value === "string" ? value : JSON.stringify(value)))
    .join(" ")
    .toLowerCase();

  it("names no fuel price as what a letter holds", () => {
    expect(sectionText).not.toMatch(/fuel|gallon|petrol|gasoline|per litre/);
  });
});

// H1 step 3: example tests for the SceneShell `below` slot that carries the four
// sections (see src/components/ceremony/scene/SceneShell.tsx, variant "landing").
describe("SceneShell below slot (H1)", () => {
  it("renders below outside the landing column and inside main", () => {
    const html = renderToStaticMarkup(
      <SceneShell variant="landing" below={<p data-below="">below</p>}>
        <p data-child="">child</p>
      </SceneShell>,
    );
    const mainStart = html.indexOf("<main");
    const mainEnd = html.indexOf("</main>");
    const child = html.indexOf("data-child");
    const below = html.indexOf("data-below");
    expect(html.indexOf("data-landing-column")).toBeGreaterThan(-1);
    expect(mainStart).toBeLessThan(below);
    expect(below).toBeLessThan(mainEnd);
    // The column's closing </div> sits between the child and the below content,
    // so below is not inside the column.
    expect(child).toBeLessThan(below);
    expect(html.slice(child, below)).toContain("</div>");
  });

  it("keeps the four sections in order, after the landing column", () => {
    const html = renderToStaticMarkup(
      <SceneShell
        variant="landing"
        below={
          <>
            <RitualSection />
            <ResurrectionSection />
            <NoSealSection />
            <CovenStrip />
          </>
        }
      >
        <p>hero</p>
      </SceneShell>,
    );
    const ids = [
      "ritual-title",
      "resurrected-title",
      "no-seal-title",
      "coven-title",
    ];
    const positions = ids.map((id) => html.indexOf(`id="${id}"`));
    for (const position of positions) expect(position).toBeGreaterThan(-1);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    // Added in step 3 as a check on the wiring: the sections come after the column opens.
    expect(positions[0]).toBeGreaterThan(html.indexOf("data-landing-column"));
  });

  it("adds no client-only import to the landing sections or SceneShell", () => {
    // SceneShell is already a client module ("use client"), so only the
    // browser-only Soil canvas and dynamic imports are checked here.
    const files = [
      join(here, "RitualSection.tsx"),
      join(here, "ResurrectionSection.tsx"),
      join(here, "NoSealSection.tsx"),
      join(here, "CovenStrip.tsx"),
      resolve(here, "../ceremony/scene/SceneShell.tsx"),
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/from\s+["'][^"']*soil-canvas/);
      expect(text, file).not.toMatch(/next\/dynamic/);
      expect(text, file).not.toMatch(/\bimport\s*\(/);
    }
  });
});

// H1 step 1 (phones): the landing sections clear the fixed Ghost layer below 900 px.
describe("landing sections clear the Ghost below 900 px (H1)", () => {
  const landingCss = readFileSync(join(here, "landing.module.css"), "utf8");
  const sceneCss = readFileSync(
    resolve(here, "../ceremony/scene/scene.module.css"),
    "utf8",
  );

  /** The body of the first `@media (max-width: 899.98px)` block that holds `selector`. */
  function phoneBlockFor(css: string, selector: string): string {
    const media = "@media (max-width: 899.98px) {";
    let index = css.indexOf(media);
    while (index !== -1) {
      const start = index + media.length;
      let depth = 1;
      let end = start;
      while (end < css.length && depth > 0) {
        if (css[end] === "{") depth++;
        if (css[end] === "}") depth--;
        end++;
      }
      const body = css.slice(start, end - 1);
      if (body.includes(selector)) return body;
      index = css.indexOf(media, end);
    }
    return "";
  }

  it("gives the ritual cards an opaque page background below 900 px", () => {
    const block = phoneBlockFor(landingCss, ".ritualCard");
    expect(block).toMatch(/background:\s*var\(--bg\)/);
  });

  it("paints the below-the-fold frame above the Ghost layer below 900 px", () => {
    const block = phoneBlockFor(sceneCss, ".landingBelowFrame");
    expect(block).toMatch(/position:\s*relative/);
    expect(block).toMatch(/z-index:\s*3/);
    // The Ghost layer sits at z-index 2 in scene.module.css.
    expect(sceneCss).toMatch(/\.ghostLayer \{[^}]*z-index:\s*2/);
  });
});
