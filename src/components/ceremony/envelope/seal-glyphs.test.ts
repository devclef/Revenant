// Feature: 05-reveal-ceremony, issue #119
//
// The wax seal's centre glyphs must not use star, cross or crescent shapes.
// Those carry religious or political meaning, which neutrality.md rules out
// for decorative artwork. This test scans the glyph names and the rendered
// markup of each glyph.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GLYPH_SHAPES, GLYPHS } from "./WaxSeal";
import { GLYPH_COUNT } from "./seal-pattern";

const FORBIDDEN_SHAPE = /star|cross|crescent/i;

/** Render one glyph into an SVG so its markup can be scanned. */
function glyphMarkup(index: number): string {
  return renderToStaticMarkup(
    createElement("svg", { viewBox: "0 0 100 100" }, GLYPHS[index]),
  );
}

describe("seal centre glyphs avoid star, cross and crescent shapes (issue #119)", () => {
  it("has one shape name and one glyph for each index", () => {
    expect(GLYPHS).toHaveLength(GLYPH_COUNT);
    expect(GLYPH_SHAPES).toHaveLength(GLYPH_COUNT);
  });

  it("names no star, cross or crescent shape", () => {
    for (const [index, name] of GLYPH_SHAPES.entries()) {
      expect(name, `glyph ${index} is named "${name}"`).not.toMatch(FORBIDDEN_SHAPE);
    }
  });

  it("draws no straight-edged polygon with four or more corners", () => {
    for (let index = 0; index < GLYPH_COUNT; index++) {
      const markup = glyphMarkup(index);
      for (const match of markup.matchAll(/d="([^"]*)"/g)) {
        const d = match[1];
        const corners = (d.match(/L/g) ?? []).length;
        const curved = /[CcQqSsAa]/.test(d);
        expect(
          !curved && corners >= 4,
          `glyph ${index} draws a straight-edged polygon: ${d}`,
        ).toBe(false);
      }
    }
  });

  it("draws no cross: a vertical and a horizontal line through the centre", () => {
    for (let index = 0; index < GLYPH_COUNT; index++) {
      const lines = [...glyphMarkup(index).matchAll(/<line\b[^>]*>/g)].map((m) => m[0]);
      const vertical = lines.some((l) => /x1="50"/.test(l) && /x2="50"/.test(l));
      const horizontal = lines.some((l) => /y1="50"/.test(l) && /y2="50"/.test(l));
      expect(vertical && horizontal, `glyph ${index} draws a cross`).toBe(false);
    }
  });
});
