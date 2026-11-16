// Feature: 13-the-seal, Property 4: The seal is the same on every surface
//
// Property test for design.md "Correctness Properties" 4 (U4.1, U4.2, U4.3).
// For any 64-hex fingerprint, the relief paths drawn by WaxSeal (markup passed
// through normaliseWaxSealIds) equal the relief paths in sealSvgGroup, and the
// data-coarse value equals the coarse signature of the same relief. Runs over
// random fingerprints from fast-check.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import { WaxSeal, normaliseWaxSealIds } from "@/components/ui/WaxSeal";

import { GHOST_PATH, RIM_RING, WAX_PATH } from "./seal-art";
import { sealRelief } from "./relief";
import { sealSvgGroup } from "./svg";

const HEX = "0123456789abcdef";
const RUNS = 60;

/** A random 64-character lowercase hex fingerprint. */
const hash64 = fc
  .array(fc.integer({ min: 0, max: 15 }), { minLength: 64, maxLength: 64 })
  .map((digits) => digits.map((n) => HEX[n]).join(""));

/** One drawn relief shape: its tag, its geometry and its literal colour. */
type Shape = string;

/** Reads the attributes of one tag, ignoring style, into a name to value map. */
function attributes(tag: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of tag.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) {
    if (m[1] !== "style") map.set(m[1], m[2]);
  }
  return map;
}

/**
 * The literal colour of a tag. A card tag carries `stroke` or `fill` as an
 * attribute. A WaxSeal tag carries the colour in `style` as
 * `var(--token, #literal)`, and the literal fallback is what we compare.
 */
function colourOf(tag: string, attrs: Map<string, string>): string {
  const stroke = attrs.get("stroke");
  if (stroke !== undefined) return stroke;
  const fill = attrs.get("fill");
  if (fill !== undefined && fill !== "none") return fill;
  const style = tag.match(/style="([^"]*)"/)?.[1] ?? "";
  const fallback = style.match(/var\([^,]+,\s*([^)]+)\)/)?.[1];
  if (fallback === undefined) throw new Error(`no colour in ${tag}`);
  return fallback.trim();
}

/**
 * The relief shapes of a seal, in document order: the coarse rings, the coarse
 * notches and the fine ticks and dots. The wax, the rim ring, the inner disc,
 * the ghost and the eyes are the same for every hash and are not relief.
 */
function reliefShapes(markup: string): Shape[] {
  const tags = markup.match(/<(path|circle|ellipse)\b[^>]*>/g) ?? [];
  const shapes: Shape[] = [];
  for (const tag of tags) {
    const attrs = attributes(tag);
    if (tag.startsWith("<ellipse")) continue;
    if (tag.startsWith("<circle")) {
      if (attrs.get("fill") !== "none") continue; // inner disc
      const isRim =
        attrs.get("cx") === String(RIM_RING.cx) &&
        attrs.get("cy") === String(RIM_RING.cy) &&
        attrs.get("r") === String(RIM_RING.r);
      if (isRim) continue;
      shapes.push(
        `ring|${attrs.get("cx")}|${attrs.get("cy")}|${attrs.get("r")}|` +
          `${attrs.get("stroke-width")}|${colourOf(tag, attrs)}`,
      );
      continue;
    }
    const d = attrs.get("d");
    if (d === WAX_PATH || d === GHOST_PATH || d === undefined) continue;
    shapes.push(`path|${d}|${colourOf(tag, attrs)}`);
  }
  return shapes;
}

/** The `<svg>` of a WaxSeal render, with its root attributes. */
function waxSealMarkup(hash: string): string {
  return renderToStaticMarkup(createElement(WaxSeal, { hash, size: 72 }));
}

describe("Property 4: the seal is the same on every surface", () => {
  it("WaxSeal and sealSvgGroup draw the same relief paths for any hash", () => {
    fc.assert(
      fc.property(hash64, (hash) => {
        const page = normaliseWaxSealIds(waxSealMarkup(hash));
        const card = sealSvgGroup(hash, 0, 0, 72);

        // WaxSeal draws the same art once per half, clipped to that half.
        // Both halves together must match the single card copy twice over.
        const pageShapes = reliefShapes(page);
        const cardShapes = reliefShapes(card);
        expect(cardShapes.length).toBeGreaterThan(0);
        expect(pageShapes).toEqual([...cardShapes, ...cardShapes]);
      }),
      { numRuns: RUNS },
    );
  });

  it("the data-coarse value on WaxSeal equals the coarse signature of the same hash", () => {
    fc.assert(
      fc.property(hash64, (hash) => {
        const relief = sealRelief(hash);
        if (relief.kind !== "relief") throw new Error("expected a relief");
        const page = waxSealMarkup(hash);
        const coarse = page.match(/data-coarse="([^"]*)"/)?.[1];
        expect(coarse).toBe(relief.coarse.signature);
      }),
      { numRuns: RUNS },
    );
  });
});
