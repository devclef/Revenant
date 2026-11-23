import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  contrastRatio,
  ctFailures,
  over,
  parseColor,
  relativeLuminance,
  requiredRatio,
  resolveSolidSurface,
  trimToOpaque,
  worstPixelRatio,
  type CtReading,
  type Rgba,
} from "./layout-check-ct1";

const WHITE = "#ffffff";
const CREAM = "#f6ead4";
const INK = "#1f1b16";
const onWhite = { kind: "solid" as const, backdrops: [WHITE] };

function reading(partial: Partial<CtReading> & Pick<CtReading, "ink">): CtReading {
  return {
    selector: "p",
    text: "Sample text",
    fontSize: 16,
    fontWeight: 400,
    surface: onWhite,
    ...partial,
  };
}

/** Grey level `v` as a 6-digit hex colour. */
function grey(v: number): string {
  const h = v.toString(16).padStart(2, "0");
  return `#${h}${h}${h}`;
}

/** Independent WCAG 2.2 reference, written separately from the module under test. */
function refLinear(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

type Rgb = [number, number, number];

function refRatio(a: Rgb, b: Rgb): number {
  const lum = (c: Rgb) =>
    0.2126 * refLinear(c[0]) + 0.7152 * refLinear(c[1]) + 0.0722 * refLinear(c[2]);
  const la = lum(a);
  const lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function refRequired(size: number, weight: number): number {
  return size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
}

const hex = (c: Rgb) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");

describe("parseColor", () => {
  it("reads hex, rgb(), rgba() and transparent", () => {
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor("#1f1b16")).toEqual({ r: 31, g: 27, b: 22, a: 1 });
    expect(parseColor("rgb(246, 234, 212)")).toEqual({ r: 246, g: 234, b: 212, a: 1 });
    expect(parseColor("rgba(0, 0, 0, 0.5)")).toEqual({ r: 0, g: 0, b: 0, a: 0.5 });
    expect(parseColor("transparent")).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it("returns null for colours it cannot read", () => {
    expect(parseColor("oklch(0.9 0.02 80)")).toBeNull();
    expect(parseColor("#12345")).toBeNull();
    expect(parseColor("")).toBeNull();
  });
});

describe("fixtures from the ticket", () => {
  it("fails white text on cream at about 1.2:1", () => {
    const [failure] = ctFailures(
      reading({ ink: WHITE, surface: { kind: "solid", backdrops: [CREAM] } }),
    );
    expect(failure).toBeDefined();
    expect(failure.ratio).toBeGreaterThan(1.18);
    expect(failure.ratio).toBeLessThan(1.2);
    expect(failure.required).toBe(4.5);
  });

  it("passes ink #1f1b16 on cream", () => {
    const ratio = contrastRatio(parseColor(INK)!, parseColor(CREAM)!);
    expect(ratio).toBeGreaterThan(14);
    expect(ctFailures(reading({ ink: INK, surface: { kind: "solid", backdrops: [CREAM] } }))).toEqual(
      [],
    );
  });
});

describe("boundaries", () => {
  it("needs 4.5:1 for normal text and 3:1 for large text", () => {
    expect(requiredRatio(16, 400)).toBe(4.5);
    expect(requiredRatio(24, 400)).toBe(3);
  });

  it("switches to large text at exactly 24 px", () => {
    expect(requiredRatio(24, 400)).toBe(3);
    expect(requiredRatio(23.99, 400)).toBe(4.5);
  });

  it("switches to large bold text at exactly 18.66 px with weight 700", () => {
    expect(requiredRatio(18.66, 700)).toBe(3);
    expect(requiredRatio(18.66, 699)).toBe(4.5);
    expect(requiredRatio(18.65, 700)).toBe(4.5);
    expect(requiredRatio(18.66, 400)).toBe(4.5);
  });

  it("brackets 4.5:1 with the nearest 8-bit greys on white", () => {
    // Exactly 4.5:1 is not reachable with 8-bit greys, so the test checks the nearest pair.
    expect(refRatio([118, 118, 118], [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
    expect(refRatio([119, 119, 119], [255, 255, 255])).toBeLessThan(4.5);
    expect(ctFailures(reading({ ink: grey(118) }))).toEqual([]);
    expect(ctFailures(reading({ ink: grey(119) }))).not.toEqual([]);
  });

  it("brackets 3:1 with the nearest 8-bit greys on white, checked at 24 px", () => {
    // The ratio falls as the grey gets lighter, so the last grey at or above 3:1 is the boundary.
    let passing: number | null = null;
    for (let v = 0; v <= 255; v++) {
      if (refRatio([v, v, v], [255, 255, 255]) >= 3) passing = v;
    }
    expect(passing).not.toBeNull();
    expect(ctFailures(reading({ ink: grey(passing!), fontSize: 24 }))).toEqual([]);
    expect(ctFailures(reading({ ink: grey(passing! + 1), fontSize: 24 }))).not.toEqual([]);
  });

  it("passes large text at 3:1 and fails it at 4.5:1 for the same colours", () => {
    // Grey #8a8a8a on white sits between 3:1 and 4.5:1: enough for large text, not for body text.
    const ink = grey(0x8a);
    expect(ctFailures(reading({ ink, fontSize: 24 }))).toEqual([]);
    expect(ctFailures(reading({ ink, fontSize: 23.99 }))).not.toEqual([]);
    expect(ctFailures(reading({ ink, fontSize: 18.66, fontWeight: 700 }))).toEqual([]);
    expect(ctFailures(reading({ ink, fontSize: 18.66, fontWeight: 699 }))).not.toEqual([]);
  });
});

describe("compositing", () => {
  it("uses an opaque background as it is", () => {
    expect(resolveSolidSurface([parseColor(CREAM)!])).toEqual({ r: 246, g: 234, b: 212, a: 1 });
  });

  it("composites a semi-transparent layer over the opaque one behind it", () => {
    // 50% black over white is mid grey, about 127.5 per channel.
    const surface = resolveSolidSurface([parseColor("rgba(0, 0, 0, 0.5)")!, parseColor(WHITE)!]);
    expect(surface.a).toBe(1);
    expect(surface.r).toBeCloseTo(127.5, 6);
    expect(surface.g).toBeCloseTo(127.5, 6);
    expect(surface.b).toBeCloseTo(127.5, 6);
  });

  it("composites nested alpha layers from the outside in", () => {
    // Nearest first: a transparent wrapper, 50% white, then opaque black.
    const surface = resolveSolidSurface([
      parseColor("transparent")!,
      parseColor("rgba(255, 255, 255, 0.5)")!,
      parseColor("#000000")!,
    ]);
    expect(surface.a).toBe(1);
    expect(surface.r).toBeCloseTo(127.5, 6);
    expect(surface.g).toBeCloseTo(127.5, 6);
    expect(surface.b).toBeCloseTo(127.5, 6);
  });

  it("composites semi-transparent ink over the surface before measuring", () => {
    const ink = over(parseColor("rgba(0, 0, 0, 0.5)")!, parseColor(WHITE)!);
    expect(ink.a).toBe(1);
    expect(ink.r).toBeCloseTo(127.5, 6);
  });

  it("stops trimming backdrop layers at the first opaque one", () => {
    const layers = trimToOpaque([
      { color: "transparent", image: false },
      { color: CREAM, image: false },
      { color: "#000000", image: false },
    ]);
    expect(layers).toHaveLength(2);
  });

  it("keeps layers past a gradient or image, since those do not hide what is behind them", () => {
    const layers = trimToOpaque([
      { color: "transparent", image: false },
      { color: CREAM, image: true },
      { color: "#000000", image: false },
    ]);
    expect(layers).toHaveLength(3);
  });

  it("takes the worst pixel on a gradient surface", () => {
    const ink: Rgba = { r: 0, g: 0, b: 0, a: 1 };
    // Black ink on white, mid grey and black: the black pixel gives the lowest ratio, 1:1.
    expect(worstPixelRatio(ink, [[255, 255, 255], [136, 136, 136], [0, 0, 0]])).toBeCloseTo(1, 9);
    const failures = ctFailures(
      reading({
        ink: "#000000",
        surface: {
          kind: "pixels",
          colors: [
            [255, 255, 255],
            [136, 136, 136],
            [0, 0, 0],
          ],
        },
      }),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].ratio).toBeCloseTo(1, 9);
  });

  it("passes a gradient only when every pixel meets the ratio", () => {
    const pixels = (colors: Rgb[]) => ({ kind: "pixels" as const, colors });
    expect(
      ctFailures(reading({ ink: "#000000", surface: pixels([[255, 255, 255], [200, 200, 200]]) })),
    ).toEqual([]);
    expect(
      ctFailures(reading({ ink: "#000000", surface: pixels([[255, 255, 255], [60, 60, 60]]) })),
    ).not.toEqual([]);
  });

  it("fails rather than passes when the surface or colour cannot be read", () => {
    expect(ctFailures(reading({ ink: "oklch(0.9 0 0)" }))).toHaveLength(1);
    expect(
      ctFailures(reading({ ink: INK, surface: { kind: "unavailable", reason: "no box" } })),
    ).toHaveLength(1);
    expect(ctFailures(reading({ ink: INK, surface: { kind: "pixels", colors: [] } }))).toHaveLength(
      1,
    );
  });
});

describe("relative luminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0, a: 1 })).toBe(0);
    expect(relativeLuminance({ r: 255, g: 255, b: 255, a: 1 })).toBeCloseTo(1, 9);
  });
});

describe("property: CT1 agrees with the WCAG formula", () => {
  const channel = fc.integer({ min: 0, max: 255 });
  const colour = fc.tuple(channel, channel, channel);
  const size = fc.double({ min: 8, max: 40, noNaN: true });
  const weight = fc.constantFrom(400, 500, 600, 699, 700, 800);

  it("agrees with the reference formula and the large-text switch", () => {
    fc.assert(
      fc.property(colour, colour, size, weight, (ink, bg, fontSize, fontWeight) => {
        const expected = refRatio(ink, bg);
        const required = refRequired(fontSize, fontWeight);
        // Skip exact-threshold ties, where float error could flip the verdict.
        fc.pre(Math.abs(expected - required) > 1e-6);

        const failures = ctFailures({
          selector: "p",
          text: "x",
          ink: hex(ink),
          fontSize,
          fontWeight,
          surface: { kind: "solid", backdrops: [hex(bg)] },
        });
        expect(failures.length === 0).toBe(expected >= required);
        expect(requiredRatio(fontSize, fontWeight)).toBe(required);
        if (failures.length > 0) {
          expect(failures[0].ratio).toBeCloseTo(expected, 6);
          expect(failures[0].required).toBe(required);
        }
      }),
      { numRuns: 500 },
    );
  });
});
describe("Wait step cases", () => {
  // The Wait heading is white. On the cream paper it has about 1.2:1 and must fail.
  // The dark Wait surface is the scene background, #0b0912 (--bg in scene/tokens.css).
  const DARK_WAIT_SURFACE = "#0b0912";

  it("fails the white h1 \"Seal your own letter\" on the cream paper", () => {
    const [failure] = ctFailures({
      selector: "h1",
      text: "Seal your own letter",
      ink: WHITE,
      fontSize: 40,
      fontWeight: 700,
      surface: { kind: "solid", backdrops: [CREAM] },
    });
    expect(failure).toBeDefined();
    expect(failure.ratio).toBeLessThan(1.2);
    expect(failure.required).toBe(3);
  });

  it("passes white text on the dark Wait surface", () => {
    expect(
      ctFailures({
        selector: "h1",
        text: "Seal your own letter",
        ink: WHITE,
        fontSize: 40,
        fontWeight: 700,
        surface: { kind: "solid", backdrops: [DARK_WAIT_SURFACE] },
      }),
    ).toEqual([]);
    expect(
      ctFailures({
        selector: "p",
        text: "Body copy",
        ink: WHITE,
        fontSize: 16,
        fontWeight: 400,
        surface: { kind: "solid", backdrops: [DARK_WAIT_SURFACE] },
      }),
    ).toEqual([]);
  });

  // The D2 regression: after the Wait step moved onto the desk, four lines kept the
  // paper ink. Measured on main at 1440x900 and 390x844: ink rgb(31, 27, 22) on the
  // desk rgb(11, 9, 18), with the panel's transparent layers in front of it.
  const PAPER_INK = "rgb(31, 27, 22)";
  const PAPER_INK_SOFT = "rgb(74, 64, 54)";
  const DESK = "rgb(11, 9, 18)";
  const ON_DESK = ["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)", DESK];

  it.each([
    ["p", "Time remaining: 29 seconds.", PAPER_INK_SOFT, 15],
    ["p", "This is a rehearsal: a real letter stays sealed for months, and this one opens in 30 seconds.", PAPER_INK, 18],
    ["p", "This seal is drawn from the letter's fingerprint.", PAPER_INK, 18],
    ["button", "Add to your calendar", PAPER_INK, 16],
  ])("fails %s \"%s\" in paper ink on the desk", (selector, text, ink, fontSize) => {
    const [failure] = ctFailures({
      selector,
      text,
      ink,
      fontSize,
      fontWeight: selector === "button" ? 600 : 400,
      surface: { kind: "solid", backdrops: ON_DESK },
    });
    expect(failure).toBeDefined();
    expect(failure.ratio).toBeLessThan(2);
    expect(failure.required).toBe(4.5);
  });

  it.each([
    ["the countdown in --muted", "rgb(189, 180, 220)", 15],
    ["the rehearsal line, seal line and calendar button in --text", "rgb(245, 243, 255)", 16],
  ])("passes %s on the desk", (_name, ink, fontSize) => {
    expect(
      ctFailures({
        selector: "p",
        text: "Desk text",
        ink,
        fontSize,
        fontWeight: 400,
        surface: { kind: "solid", backdrops: ON_DESK },
      }),
    ).toEqual([]);
  });
});
