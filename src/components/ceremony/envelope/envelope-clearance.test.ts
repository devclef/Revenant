// Feature: 07-judge-journey (spec 07 task 2, Property 9)
//
// Geometry check: no Envelope_Front text box reaches the dirt band at the
// smallest and largest Envelope sizes, in both the wide and the narrow layout.
//
// The model reads the date-line rules from Envelope.module.css (the `.lines`
// bottom offset and the `.line` / `.demoNote` font clamps) and the aspect and
// dirt-band constants from ../constants. Sizes follow the resting width,
// `min(84vw, 26rem)`: the smallest width is at a 360 px viewport and the largest
// is the 26 rem cap. Font clamps use the browser root size of 16 px. The line
// height of the demo note is not set in CSS, so it takes a 1.5 body value here,
// which is the larger of the two cases.
//
// This is a model, not a measurement. The browser check records the real
// positions at 1280 x 800 and 360 x 640.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ENVELOPE_ASPECT_NARROW,
  ENVELOPE_ASPECT_WIDE,
  ENVELOPE_DIRT_BAND,
  ENVELOPE_FRONT_MIN_PX,
} from "../constants";

const css = readFileSync(resolve(__dirname, "Envelope.module.css"), "utf8");

const REM_PX = 16;
const SMALLEST_VIEWPORT_PX = 360;
const LARGEST_WIDTH_REM = 26; // resting width cap: min(84vw, 26rem)
const SHARE_OF_VIEWPORT = 0.84;
const DATE_LINE_HEIGHT = 1.3; // `.line` in Envelope.module.css
const DEMO_NOTE_LINE_HEIGHT = 1.5; // not set in CSS: the body default
const LINE_GAP_PX = 0.25 * REM_PX; // `.lines` gap: 0.25rem

/** The body of one rule in the CSS module, or "" when the rule is absent. */
function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  return m?.[1] ?? "";
}

/** The bottom offset of `.lines`, as a fraction of the front's height. */
function linesBottomShare(): number {
  const m = ruleBody(".lines").match(/bottom:\s*([\d.]+)%/);
  if (m === null) throw new Error("`.lines` has no percentage bottom");
  return Number(m[1]) / 100;
}

/** Evaluate `clamp(min, preferred, max)` for a viewport width, in px. */
function clampPx(min: number, preferredVwFactor: number, max: number, viewport: number): number {
  return Math.min(max, Math.max(min, preferredVwFactor * viewport));
}

/** The date-line font size at a viewport, from the `.line` clamp. */
function dateFontPx(viewport: number): number {
  return clampPx(0.85 * REM_PX, 0.024, 1 * REM_PX, viewport);
}

/** The demo-note font size at a viewport, from the `.demoNote` clamp. */
function demoNoteFontPx(viewport: number): number {
  return clampPx(0.75 * REM_PX, 0.021, 0.9 * REM_PX, viewport);
}

/** The width of the envelope at a viewport: min(84vw, 26rem). */
function envelopeWidthPx(viewport: number): number {
  return Math.min(SHARE_OF_VIEWPORT * viewport, LARGEST_WIDTH_REM * REM_PX);
}

type Layout = "wide" | "narrow";

/** Lines in the front for a layout: two date lines, plus the demo note on wide. */
function frontTextBlockHeightPx(layout: Layout, viewport: number): number {
  const dateH = dateFontPx(viewport) * DATE_LINE_HEIGHT;
  const dates = [dateH, dateH];
  const note =
    layout === "wide" ? [demoNoteFontPx(viewport) * DEMO_NOTE_LINE_HEIGHT] : [];
  const lines = [...dates, ...note];
  const gaps = (lines.length - 1) * LINE_GAP_PX;
  return lines.reduce((sum, h) => sum + h, 0) + gaps;
}

/**
 * Where the front text block sits, measured from the top of the front, for an
 * envelope of the given layout at a viewport. The block sits `bottom` above the
 * front's bottom edge, so its top is the front's height minus that offset minus
 * the block's own height.
 */
function textBlockTopPx(layout: Layout, viewport: number): {
  top: number;
  bottom: number;
  frontH: number;
} {
  const aspect = layout === "wide" ? ENVELOPE_ASPECT_WIDE : ENVELOPE_ASPECT_NARROW;
  const frontH = envelopeWidthPx(viewport) / aspect;
  const bottom = frontH - linesBottomShare() * frontH;
  const height = frontTextBlockHeightPx(layout, viewport);
  return { top: bottom - height, bottom, frontH };
}

/** The top of the dirt band, measured from the top of the front. */
function dirtBandTopPx(frontH: number): number {
  return (1 - ENVELOPE_DIRT_BAND) * frontH;
}

const SIZES: ReadonlyArray<{ name: string; viewport: number }> = [
  { name: "smallest (360 px viewport)", viewport: SMALLEST_VIEWPORT_PX },
  { name: "largest (26 rem cap)", viewport: LARGEST_WIDTH_REM * REM_PX / SHARE_OF_VIEWPORT + 1 },
];

describe("Property 9: no Envelope_Front text box reaches the dirt band", () => {
  for (const layout of ["wide", "narrow"] as const) {
    for (const size of SIZES) {
      it(`keeps the ${layout} front text above the dirt band at the ${size.name}`, () => {
        const { bottom, frontH } = textBlockTopPx(layout, size.viewport);
        const bandTop = dirtBandTopPx(frontH);
        // `bottom` is the text box's bottom edge, measured from the top of the
        // front. The text is clear of the band when that edge sits above the
        // band's top edge.
        expect(bottom).toBeLessThanOrEqual(bandTop);
      });

      it(`keeps the ${layout} front text inside the front at the ${size.name}`, () => {
        const { top } = textBlockTopPx(layout, size.viewport);
        expect(top).toBeGreaterThanOrEqual(0);
      });
    }
  }

  it("uses a bottom offset of the lines that clears the dirt band's top edge", () => {
    // Spec 07 task 2 moved the lines up from 26% to 46% so they clear the band.
    // A bottom share at or below the dirt share puts the text on the band.
    expect(linesBottomShare()).toBeGreaterThan(ENVELOPE_DIRT_BAND);
  });
});

describe("Property 21: the narrow front's date lines fit on one line each", () => {
  it("gives the date lines the nowrap rule", () => {
    expect(ruleBody(".date")).toMatch(/white-space:\s*nowrap/);
  });

  it("keeps every front font at or above ENVELOPE_FRONT_MIN_PX at the smallest size", () => {
    expect(dateFontPx(SMALLEST_VIEWPORT_PX)).toBeGreaterThanOrEqual(ENVELOPE_FRONT_MIN_PX);
    expect(demoNoteFontPx(SMALLEST_VIEWPORT_PX)).toBeGreaterThanOrEqual(ENVELOPE_FRONT_MIN_PX);
  });

  it("fits the longest date in the front's text width at the smallest size", () => {
    // "Written as of 12 September 2024" is 31 characters. A 0.6 em average
    // glyph width is a conservative bound for the sans UI face.
    const longest = "Written as of 12 September 2024".length;
    const textWidthPx = longest * 0.6 * dateFontPx(SMALLEST_VIEWPORT_PX);
    const availablePx = 0.84 * envelopeWidthPx(SMALLEST_VIEWPORT_PX);
    expect(textWidthPx).toBeLessThanOrEqual(availablePx);
  });
});
