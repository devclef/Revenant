// Feature: 13-the-seal (U4.3)
// Tests for sealSvgGroup: the layer order and literal colours of the card seal.

import { describe, expect, it } from "vitest";

import { sealSvgGroup } from "./svg";
import { reliefArt, TONE_FILL, WAX_PATH } from "./seal-art";
import { sealRelief } from "./relief";
import { LANDING_HASH } from "./hashes.testing";

const LITERAL_COLOURS = new Set([
  "#ff7b1c", // wax
  "#d4600c", // rim ring stroke, also the rim tone
  "#f26f12", // inner disc
  "#c4560a", // press: the coarse rings and the ghost
  "#ff8d3a", // eye: the notches and the eyes
]);

type Kind =
  "wax" | "ring" | "rim" | "notch" | "inner" | "fine" | "ghost" | "eye";

/** Each drawn shape in document order, classified by its geometry or fill. */
function shapeKinds(svg: string): Kind[] {
  const tags = svg.match(/<(path|circle|ellipse)\b[^>]*>/g) ?? [];
  return tags.map((tag): Kind => {
    if (tag.startsWith("<ellipse")) return "eye";
    if (tag.startsWith("<circle")) {
      if (tag.includes('fill="none"')) {
        return tag.includes(`stroke="${TONE_FILL.rim.fallback}"`)
          ? "rim"
          : "ring";
      }
      return "inner";
    }
    if (tag.includes(`d="${WAX_PATH}"`)) return "wax";
    if (tag.includes('fill="#c4560a"') && tag.includes("M38 50"))
      return "ghost";
    if (tag.includes('fill="#ff8d3a"')) return "notch";
    return "fine";
  });
}

describe("sealSvgGroup layer order", () => {
  it("draws wax, rings, rim, notches, inner disc, fine marks, ghost, eyes in that order", () => {
    const art = reliefArt(sealRelief(LANDING_HASH));
    const kinds = shapeKinds(sealSvgGroup(LANDING_HASH, 0, 0, 100));
    const expected: Kind[] = [
      "wax",
      ...art.rings.map((): Kind => "ring"),
      "rim",
      "notch",
      "inner",
      "fine",
      "fine",
      "ghost",
      "eye",
      "eye",
    ];
    expect(kinds).toEqual(expected);
  });

  it("draws the blank signet with no relief layers for a missing hash", () => {
    const kinds = shapeKinds(sealSvgGroup(undefined, 0, 0, 100));
    expect(kinds).toEqual(["wax", "rim", "inner", "ghost", "eye", "eye"]);
  });

  it("draws the blank signet for a malformed hash", () => {
    expect(shapeKinds(sealSvgGroup("not-a-hash", 0, 0, 100))).toEqual(
      shapeKinds(sealSvgGroup(undefined, 0, 0, 100)),
    );
  });
});

describe("sealSvgGroup literal output", () => {
  it("is one group placed and scaled from its x, y and size", () => {
    const svg = sealSvgGroup(LANDING_HASH, 376, 32, 72);
    expect(
      svg.startsWith('<g transform="translate(376 32) scale(0.72)">'),
    ).toBe(true);
    expect(svg.endsWith("</g>")).toBe(true);
    expect((svg.match(/<g\b/g) ?? []).length).toBe(1);
  });

  it("uses literal colours only: no CSS variables, clip paths, animation or raster", () => {
    const svg = sealSvgGroup(LANDING_HASH, 0, 0, 72);
    expect(svg).not.toContain("var(");
    expect(svg).not.toContain("clipPath");
    expect(svg).not.toMatch(/<animate|<set\b|<style|<image\b/);
    expect(svg).not.toMatch(/\bstyle=/);
    const colours = [...svg.matchAll(/(?:fill|stroke)="(#[0-9a-f]{6})"/gi)].map(
      (m) => m[1].toLowerCase(),
    );
    expect(colours.length).toBeGreaterThan(0);
    for (const colour of colours)
      expect(LITERAL_COLOURS.has(colour)).toBe(true);
  });

  it("draws a different seal for a different hash", () => {
    expect(sealSvgGroup(LANDING_HASH, 0, 0, 72)).not.toBe(
      sealSvgGroup("0".repeat(64), 0, 0, 72),
    );
  });
});
