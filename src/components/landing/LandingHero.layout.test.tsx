// Feature: 09-demo-polish (H2, Brand_Copy describes any letter; hero below 600 px)
//
// Pins the hero for phone widths. The stacking rule in landing.module.css
// keeps the Hero_Sentence above the Landing_Ghost body at 360x640, and the
// copy the hero and the ritual render still comes from BRAND_COPY.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BRAND_COPY } from "@/components/brand/copy";

import { LandingHero } from "./LandingHero";
import { RitualSection } from "./RitualSection";

const here = __dirname;
const css = readFileSync(resolve(here, "landing.module.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** The text of the phone block (max-width 599.98px) in landing.module.css. */
function phoneBlock(): string {
  const start = css.indexOf("@media (max-width: 599.98px) {\n");
  expect(start).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("\n}\n", start) + 3);
}

describe("LandingHero copy from BRAND_COPY", () => {
  it("renders the exact hero sentence inside the sentence block", () => {
    const html = renderToStaticMarkup(
      <LandingHero personaCount={1} demo2On={false} />,
    );
    const sentence = html.match(/<p [^>]*data-block="sentence"[^>]*>([^<]*)<\/p>/);
    expect(sentence).not.toBeNull();
    expect(sentence?.[1]).toBe(BRAND_COPY.heroSentence);
  });
});

describe("RitualSection renders the four ritual step names from BRAND_COPY", () => {
  it("contains each step name in order", () => {
    const html = renderToStaticMarkup(<RitualSection />);
    expect(BRAND_COPY.ritualSteps).toHaveLength(4);
    let at = -1;
    for (const step of BRAND_COPY.ritualSteps) {
      const next = html.indexOf(step.name, at + 1);
      expect(next, `step name "${step.name}" should render after the previous one`).toBeGreaterThan(at);
      at = next;
    }
  });
});

describe("landing hero stacking rule below 600 px", () => {
  it("puts the actions in order 1 so they follow the reserved ghost box", () => {
    expect(phoneBlock()).toMatch(/\.actions \{\s*order: 1;\s*\}/);
  });

  it("tightens the hero spacing and line height on phone widths", () => {
    const block = phoneBlock();
    expect(block).toMatch(/\.hero \{\s*gap: 1rem;\s*padding-top: 1rem;\s*\}/);
    expect(block).toMatch(/\.sentence \{\s*line-height: 1\.5;\s*\}/);
  });

  it("reserves the ghost box as 71vh less 300px, never below zero", () => {
    expect(phoneBlock()).toMatch(
      /\.hero \.ghost \{\s*height: max\(0px, calc\(71vh - 300px\)\);\s*\}/,
    );
  });

  it("narrows the drawn Landing_Ghost placement through the Scene's --ghost-w", () => {
    expect(phoneBlock()).toMatch(
      /:global\(\[data-ghost-pit\]\) > div \{\s*--ghost-w: min\(20vh, 128px\);\s*\}/,
    );
  });
});
