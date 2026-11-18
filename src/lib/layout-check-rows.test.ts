import { describe, expect, it } from "vitest";

import {
  baselineGapOk,
  colourMatch,
  contrastOk,
  rectsIntersect,
  slotStable,
} from "../../tools/qa/layout-check.mjs";

/**
 * Unit tests for the pure check functions the Q1.1 layout-check rows use in
 * tools/qa/layout-check.mjs: box intersection, slot stability, baseline gap, colour match
 * and the contrast threshold. Each function gets one passing and one failing input.
 */

describe("rectsIntersect", () => {
  it("reports two boxes that overlap by more than half a pixel on both axes", () => {
    const a = { left: 0, top: 0, right: 10, bottom: 10 };
    const b = { left: 5, top: 5, right: 15, bottom: 15 };
    expect(rectsIntersect(a, b)).toBe(true);
  });

  it("reports boxes that only touch at an edge as not intersecting", () => {
    const a = { left: 0, top: 0, right: 10, bottom: 10 };
    const b = { left: 10, top: 0, right: 20, bottom: 10 };
    expect(rectsIntersect(a, b)).toBe(false);
  });
});

describe("slotStable", () => {
  it("accepts boxes whose left edge and width both sit within 1 px", () => {
    expect(
      slotStable({ left: 100, width: 200 }, { left: 100.5, width: 199.5 }),
    ).toBe(true);
  });

  it("rejects boxes whose left edge moved by more than 1 px", () => {
    expect(
      slotStable({ left: 100, width: 200 }, { left: 103, width: 200 }),
    ).toBe(false);
  });
});

describe("baselineGapOk", () => {
  it("accepts a baseline gap within the 2 px default", () => {
    expect(baselineGapOk(1.5)).toBe(true);
  });

  it("rejects a baseline gap beyond 2 px and a non-numeric gap", () => {
    expect(baselineGapOk(-2.5)).toBe(false);
    expect(baselineGapOk(Number.NaN)).toBe(false);
  });
});

describe("colourMatch", () => {
  it("matches a hex colour against the same colour written as rgb()", () => {
    expect(colourMatch("rgb(143, 70, 255)", "#8f46ff")).toBe(true);
  });

  it("rejects a colour whose alpha differs, because the match is exact", () => {
    expect(colourMatch("rgba(143, 70, 255, 0.5)", "#8f46ff")).toBe(false);
  });
});

describe("contrastOk", () => {
  it("passes black text on white for normal text (21:1 against a 4.5:1 minimum)", () => {
    const result = contrastOk("#000000", "#ffffff");
    expect(result.min).toBe(4.5);
    expect(result.ok).toBe(true);
  });

  it("fails mid-grey text on white for normal text, below the 4.5:1 minimum", () => {
    // #777777 on #ffffff is about 4.48:1, under the 4.5:1 normal-text minimum.
    const result = contrastOk("#777777", "#ffffff");
    expect(result.min).toBe(4.5);
    expect(result.ok).toBe(false);
  });

  it("passes the same grey for large text, where the minimum is 3:1", () => {
    const result = contrastOk("#777777", "#ffffff", { large: true });
    expect(result.min).toBe(3);
    expect(result.ok).toBe(true);
  });
});
