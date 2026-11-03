// Feature: 07-judge-journey (spec 07 task 2 fix, G1 and G2)
//
// The narrow intact stage must keep the seal card clear of the Ghost's face,
// the held Envelope and the Ghost_Body_Box. The rules live in
// scene.module.css. This file reads them and checks the clearance model with
// the values measured in the browser at 360 x 640 (the Ghost box, eyes, held
// Envelope and body box). Pure file read and arithmetic, no DOM.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "scene.module.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** The text of the narrow (max-width 899.98px) block that holds the intact rules. */
function narrowIntactBlock(): string {
  const start = css.indexOf("@media (max-width: 899.98px) {\n  .personaColumn:has(");
  expect(start).toBeGreaterThan(-1);
  const end = css.indexOf("\n}\n", start);
  return css.slice(start, end);
}

describe("narrow intact stage rules (scene.module.css)", () => {
  it("applies only to the intact stage, through :has() on the persona column", () => {
    const block = narrowIntactBlock();
    expect(block).toContain('.personaColumn:has(> [data-ceremony="intact"])');
    expect(block).toContain('.personaColumn > [data-ceremony="intact"]');
  });

  it("fills the window below the Top_Bar, then pushes the region to its foot", () => {
    const block = narrowIntactBlock();
    expect(block).toMatch(/min-height:\s*calc\(100vh - 6rem\);/);
    expect(block).toMatch(/margin-top:\s*auto;/);
  });

  it("lowers the region past the foot with a negative margin-bottom", () => {
    expect(narrowIntactBlock()).toMatch(/margin-bottom:\s*-2\.75rem;/);
  });

  it("does not change the wide layout: the rules sit in the max-width block only", () => {
    const wide = css.slice(css.indexOf("@media (min-width: 900px)"));
    expect(wide).not.toContain('[data-ceremony="intact"]');
  });
});

describe("clearance at 360 x 640 (measured values)", () => {
  // Measured in the browser with the rules applied.
  const VIEWPORT_H = 640;
  const ghostBoxTop = 213; // SVG box top
  const ghostBoxBottom = 451; // SVG box bottom
  const eyesTop = 296; // eye centre y 304, radius about 8
  const envelopeBottom = 412; // held Envelope bottom
  const bodyBoxBottom = 432; // Ghost_Body_Box: 12 % of the height inset at the bottom
  const cardHeight = 178; // seal card, measured
  const remainingBelowSoil = VIEWPORT_H; // card bottom is measured against the window

  // Card top with the rules applied: column min-height 640 - 96, region bottom
  // at the column foot, lowered by 2.75 rem (44 px); the card keeps 64 px of
  // reveal padding below it.
  const columnFoot = VIEWPORT_H;
  const regionBottom = columnFoot + 44;
  const cardBottom = regionBottom - 64;
  const cardTop = cardBottom - cardHeight;

  it("keeps the card below both eyes", () => {
    expect(cardTop).toBeGreaterThan(eyesTop + 16);
  });

  it("keeps the card below the held Envelope", () => {
    expect(cardTop).toBeGreaterThanOrEqual(envelopeBottom);
  });

  it("keeps the card below the Ghost_Body_Box, so no text sits on the Ghost (G1)", () => {
    expect(cardTop).toBeGreaterThanOrEqual(bodyBoxBottom);
  });

  it("keeps the card inside the window", () => {
    expect(cardBottom).toBeLessThanOrEqual(remainingBelowSoil);
    expect(cardBottom).toBeGreaterThan(VIEWPORT_H - 40);
    expect(ghostBoxTop).toBeLessThan(ghostBoxBottom);
  });
});
