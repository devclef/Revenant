// Feature: 07-judge-journey
//
// Checks the Scene_Frame and Soil values in scene.module.css against the
// constants and the layout math (design.md "The Scene_Frame", "SceneBackdrop
// and the Soil"; R6.3, R6.14, R8.14, R3.8). Reads the CSS file directly, so the
// numbers the browser uses are the numbers tested. Pure file read, no DOM.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  EDGE_BAND_PX,
  GHOST_X_IN_FRAME,
  SCENE_BREAKPOINT_PX,
  SCENE_FRAME_MAX_PX,
  SOIL_BAND_NARROW_VH,
  SOIL_BAND_WIDE_VH,
  SOIL_TOP_NARROW_VH,
  SOIL_TOP_WIDE_VH,
} from "../constants";
import { SOIL_JAG_MAX_SHARE, SOIL_JAG_MIN_SHARE } from "./layout";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "scene.module.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** The body of the first rule whose selector is exactly `selector`. */
function ruleBody(selector: string, source = css): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`(?:^|\\s|\\})${escaped}\\s*\\{([^}]*)\\}`));
  if (match === null) throw new Error(`no rule for ${selector}`);
  return match[1];
}

/** The body of the wide (min-width: 900px) media block. */
function wideBlock(): string {
  const start = css.indexOf(`@media (min-width: ${SCENE_BREAKPOINT_PX}px)`);
  if (start < 0) throw new Error("no wide media block");
  return css.slice(start);
}

describe("the Scene_Frame variables (R8.14)", () => {
  it("sets --frame-w to min(100vw, 1440px)", () => {
    expect(ruleBody(".scene")).toMatch(
      new RegExp(`--frame-w:\\s*min\\(100vw,\\s*${SCENE_FRAME_MAX_PX}px\\)`),
    );
  });

  it("centres the frame with --frame-l", () => {
    expect(ruleBody(".scene")).toMatch(/--frame-l:\s*calc\(\(100vw - var\(--frame-w\)\) \/ 2\)/);
  });

  it("gives the Top_Bar and main the same padding-inline (R8.14)", () => {
    const padding = "padding-inline: calc(var(--frame-l) + var(--pad));";
    expect(ruleBody(".main").replace(/\s+/g, " ")).toContain(padding.replace(/\s+/g, " "));
    expect(ruleBody(".topbar").replace(/\s+/g, " ")).toContain("padding: 0.35rem calc(var(--frame-l) + var(--pad));");
  });
});

describe("the Soil and light at each layout (R6.1, R6.14, R5.16)", () => {
  it("is 69vh from the top and 8vh tall below 900 px", () => {
    const narrow = ruleBody(".scene");
    expect(narrow).toContain(`--soil-top: ${SOIL_TOP_NARROW_VH}vh;`);
    expect(narrow).toContain(`--soil-band: ${SOIL_BAND_NARROW_VH}vh;`);
  });

  it("is 74vh from the top and 14vh tall at or above 900 px", () => {
    const wide = wideBlock();
    expect(wide).toContain(`--soil-top: ${SOIL_TOP_WIDE_VH}vh;`);
    expect(wide).toContain(`--soil-band: ${SOIL_BAND_WIDE_VH}vh;`);
  });

  it("puts the light at 72 % of the frame at or above 900 px and the middle of the window below", () => {
    expect(GHOST_X_IN_FRAME).toBe(0.72);
    expect(ruleBody(".scene")).toContain("--ghost-x: 50vw;");
    expect(wideBlock()).toContain(
      "--ghost-x: calc(var(--frame-l) + var(--frame-w) * 0.72);",
    );
  });

  it("places the light and the soil on the same --ghost-x, so they never move sideways", () => {
    expect(ruleBody(".light")).toContain("left: var(--ghost-x);");
    expect(ruleBody(".soilStrip")).toContain("top: var(--soil-top);");
    expect(ruleBody(".pit")).toContain("left: var(--ghost-x);");
  });
});

describe("the Soil_Fallback strip (R6.1 to R6.3)", () => {
  it("runs the full window width with the band height", () => {
    const strip = ruleBody(".soilStrip");
    expect(strip).toContain("left: 0;");
    expect(strip).toContain("right: 0;");
    expect(strip).toContain("height: var(--soil-band);");
  });

  it("keeps every top-edge jag point between 2 % and 11 % of the strip, capped at 12 px", () => {
    const clip = ruleBody(".soilStrip").match(/clip-path:\s*polygon\(([\s\S]*?)\)\s*;/);
    expect(clip).not.toBeNull();
    const body = clip?.[1] ?? "";
    // Each point is `x% y%` with y either a plain share or `min(share%, cap px)`.
    const points = [...body.matchAll(/([\d.]+)%\s+(?:min\(([\d.]+)%,\s*([\d.]+)px\)|([\d.]+)%)/g)];
    expect(points.length).toBeGreaterThan(4);
    for (const point of points) {
      const share = Number(point[2] ?? point[4]) / 100;
      const cap = point[3] === undefined ? Infinity : Number(point[3]);
      // The two bottom corners sit on the strip's bottom edge.
      if (share === 1) continue;
      expect(share).toBeGreaterThanOrEqual(SOIL_JAG_MIN_SHARE);
      expect(share).toBeLessThanOrEqual(SOIL_JAG_MAX_SHARE);
      expect(cap).toBeLessThanOrEqual(EDGE_BAND_PX);
    }
  });

  it("fades its bottom quarter into the page background with no mask or colour literal", () => {
    expect(css).toMatch(/\.soilStrip::after/);
    expect(css).not.toMatch(/mask-image/);
  });
});

describe("tokens only (R3.8)", () => {
  it("contains no colour literal, only the token variables", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/rgba?\(/);
    // Named colours used as values (not `white-space`).
    expect(css).not.toMatch(/:\s*(?:black|white)\s*[;,)]/);
  });
});
