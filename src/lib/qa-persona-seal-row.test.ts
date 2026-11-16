import { describe, expect, it } from "vitest";

import { personaSealVerdict, rectInside, sealWidthOk } from "../../tools/qa/layout-check.mjs";

/**
 * Unit tests for the U9 persona-seal layout row (issue #425) in
 * tools/qa/layout-check.mjs: the 96 px width floor, containment in the persona
 * card, and no sideways scroll at 390 and 1440 px.
 */

type Rect = { left: number; top: number; right: number; bottom: number };

const CARD: Rect = { left: 100, top: 100, right: 400, bottom: 300 };

/** A seal of the given width placed inside CARD. */
function seal(width: number, rect?: Rect) {
  const r = rect ?? { left: 120, top: 120, right: 120 + width, bottom: 160 };
  return { width, rect: r, card: CARD };
}

describe("sealWidthOk (U9)", () => {
  it("fails at 95 px", () => {
    expect(sealWidthOk(95)).toBe(false);
  });

  it("passes at exactly 96 px", () => {
    expect(sealWidthOk(96)).toBe(true);
  });

  it("passes above 96 px", () => {
    expect(sealWidthOk(120)).toBe(true);
  });
});

describe("rectInside (U9)", () => {
  it("accepts a rect inside the outer rect", () => {
    expect(rectInside({ left: 110, top: 110, right: 200, bottom: 150 }, CARD)).toBe(true);
  });

  it("accepts a rect that touches the outer edges", () => {
    expect(rectInside(CARD, CARD)).toBe(true);
  });

  it("allows half a pixel of rounding past each edge", () => {
    expect(rectInside({ left: 99.5, top: 99.5, right: 400.5, bottom: 300.5 }, CARD)).toBe(true);
  });

  it("rejects a rect that sticks out past the left edge", () => {
    expect(rectInside({ left: 98, top: 110, right: 200, bottom: 150 }, CARD)).toBe(false);
  });

  it("rejects a rect that sticks out past the right edge", () => {
    expect(rectInside({ left: 300, top: 110, right: 401, bottom: 150 }, CARD)).toBe(false);
  });

  it("rejects a rect that sticks out above the top edge", () => {
    expect(rectInside({ left: 110, top: 98, right: 200, bottom: 150 }, CARD)).toBe(false);
  });

  it("rejects a rect that sticks out below the bottom edge", () => {
    expect(rectInside({ left: 110, top: 250, right: 200, bottom: 301 }, CARD)).toBe(false);
  });
});

describe("personaSealVerdict (U9)", () => {
  it("passes at 1440 px with a 96 px seal inside its card and no sideways scroll", () => {
    const v = personaSealVerdict({
      seals: [seal(96)],
      scrollWidth: 1440,
      clientWidth: 1440,
    });
    expect(v).toEqual({ count: 1, problems: [], ok: true });
  });

  it("passes at 390 px with several seals inside their cards", () => {
    const v = personaSealVerdict({
      seals: [seal(120), seal(140)],
      scrollWidth: 390,
      clientWidth: 390,
    });
    expect(v.count).toBe(2);
    expect(v.problems).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it("fails a 95 px seal and names its number", () => {
    const v = personaSealVerdict({
      seals: [seal(95)],
      scrollWidth: 390,
      clientWidth: 390,
    });
    expect(v.ok).toBe(false);
    expect(v.problems).toEqual(["seal 1 is 95.0px wide, narrower than 96px"]);
  });

  it("fails a seal whose rect sits outside its card", () => {
    const v = personaSealVerdict({
      seals: [seal(120, { left: 380, top: 120, right: 500, bottom: 160 })],
      scrollWidth: 1440,
      clientWidth: 1440,
    });
    expect(v.ok).toBe(false);
    expect(v.problems).toEqual(["seal 1 is not inside its card"]);
  });

  it("fails a seal with no containing card", () => {
    const v = personaSealVerdict({
      seals: [{ width: 120, rect: { left: 120, top: 120, right: 240, bottom: 160 }, card: null }],
      scrollWidth: 1440,
      clientWidth: 1440,
    });
    expect(v.ok).toBe(false);
    expect(v.problems).toEqual(["seal 1 is not inside its card"]);
  });

  it("fails sideways overflow at 390 px", () => {
    const v = personaSealVerdict({
      seals: [seal(120)],
      scrollWidth: 412,
      clientWidth: 390,
    });
    expect(v.ok).toBe(false);
    expect(v.problems).toEqual(["the page scrolls sideways (scrollWidth 412px, clientWidth 390px)"]);
  });

  it("fails sideways overflow at 1440 px", () => {
    const v = personaSealVerdict({
      seals: [seal(120)],
      scrollWidth: 1500,
      clientWidth: 1440,
    });
    expect(v.ok).toBe(false);
    expect(v.problems).toEqual(["the page scrolls sideways (scrollWidth 1500px, clientWidth 1440px)"]);
  });

  it("reports every problem for one page", () => {
    const v = personaSealVerdict({
      seals: [seal(95), seal(120, { left: 380, top: 120, right: 500, bottom: 160 })],
      scrollWidth: 390,
      clientWidth: 360,
    });
    expect(v.ok).toBe(false);
    expect(v.problems).toEqual([
      "seal 1 is 95.0px wide, narrower than 96px",
      "seal 2 is not inside its card",
      "the page scrolls sideways (scrollWidth 390px, clientWidth 360px)",
    ]);
  });

  it("does not pass a page with no seals", () => {
    const v = personaSealVerdict({ seals: [], scrollWidth: 390, clientWidth: 390 });
    expect(v).toEqual({ count: 0, problems: [], ok: false });
  });
});
