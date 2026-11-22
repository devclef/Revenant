// Feature: 16-remember-first, Property 2: the kept box lands in the band.
// Validates requirements 1.6 and 1.7. The band runs from the visual viewport's
// top plus KEEP_TOP_CLEAR_PX to its bottom less KEEP_BOTTOM_CLEAR_PX. A kept box
// that fits the band ends inside it; a taller box aligns its top edge to the band.

import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import {
  KEEP_BOTTOM_CLEAR_PX,
  KEEP_TOP_CLEAR_PX,
  SCALE_TOLERANCE,
  keepInVisualViewport,
  keptBox,
  scrollDeltaFor,
  type Box,
  type FieldElement,
  type ViewportHost,
} from "./use-keep-in-visual-viewport";

type Rect = Box;

const rectArb: fc.Arbitrary<Rect> = fc
  .record({ top: fc.integer({ min: -800, max: 1800 }), height: fc.integer({ min: 1, max: 1000 }) })
  .map(({ top, height }) => ({ top, bottom: top + height }));

const bandArb: fc.Arbitrary<Box> = fc
  .record({
    offsetTop: fc.integer({ min: 0, max: 300 }),
    height: fc.integer({ min: 120, max: 1200 }),
  })
  .map(({ offsetTop, height }) => ({
    top: offsetTop + KEEP_TOP_CLEAR_PX,
    bottom: offsetTop + height - KEEP_BOTTOM_CLEAR_PX,
  }))
  .filter((band) => band.bottom > band.top);

function height(b: Box): number {
  return b.bottom - b.top;
}

function inBand(b: Box, band: Box): boolean {
  return b.top >= band.top && b.bottom <= band.bottom;
}

describe("kept box lands in the band (Property 2)", () => {
  it("keptBox keeps the group when it fits the band and the field otherwise", () => {
    fc.assert(
      fc.property(rectArb, rectArb, bandArb, (group, field, band) => {
        const kept = keptBox(group, field, band);
        if (height(group) <= height(band)) {
          expect(kept).toBe(group);
        } else {
          expect(kept).toBe(field);
        }
      }),
    );
  });

  it("after the scroll, the kept box sits in the band, or its top aligns to the band top when taller", () => {
    fc.assert(
      fc.property(rectArb, rectArb, bandArb, (group, field, band) => {
        const kept = keptBox(group, field, band);
        const delta = scrollDeltaFor(kept, band);
        // A scroll by `delta` moves the element's top edge up by `delta`.
        const landed = { top: kept.top - delta, bottom: kept.bottom - delta };
        if (height(kept) > height(band)) {
          expect(landed.top).toBe(band.top);
        } else {
          expect(inBand(landed, band)).toBe(true);
        }
      }),
    );
  });

  it("keepInVisualViewport applies the same delta and lands the kept box in the band", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 300 }),
        fc.integer({ min: 120, max: 1200 }),
        rectArb,
        rectArb,
        fc.boolean(),
        (offsetTop, viewHeight, group, field, calm) => {
          const innerHeight = viewHeight + 400; // a 400 px shortfall keeps the keyboard open
          const scrollBy = vi.fn();
          const host: ViewportHost = {
            innerHeight,
            visualViewport: { offsetTop, height: viewHeight, scale: 1 + SCALE_TOLERANCE / 2 },
            scrollBy,
          };
          const el: FieldElement = {
            tagName: "TEXTAREA",
            getAttribute: () => null,
            getBoundingClientRect: () => field,
          };
          const band = {
            top: offsetTop + KEEP_TOP_CLEAR_PX,
            bottom: offsetTop + viewHeight - KEEP_BOTTOM_CLEAR_PX,
          };
          const delta = keepInVisualViewport({ getBoundingClientRect: () => group }, el, host, calm);

          expect(delta).toBe(scrollDeltaFor(keptBox(group, field, band), band));
          const kept = keptBox(group, field, band);
          const landed = { top: kept.top - delta, bottom: kept.bottom - delta };
          if (height(kept) > height(band)) {
            expect(landed.top).toBe(band.top);
          } else {
            expect(inBand(landed, band)).toBe(true);
          }
        },
      ),
    );
  });
});
