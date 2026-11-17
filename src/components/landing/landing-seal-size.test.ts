// Feature: 09-demo-polish (landing hero seal size, issue #429 L1)
//
// A regression check on the rendered size of the landing seal. The CSS-only
// tests in HeroEnvelope.test.tsx read the rule text, so they still pass if a
// perspective or a Z offset quietly shrinks the seal. This file computes the
// rendered width of the [data-seal-hash] box from the same rules:
//
//   rendered px = frame px x (seal units x scale / 300 viewBox units) x shrink
//   shrink      = P / (P - z)   (the envelope's perspective P, the seal depth z)
//
// Required: at least 160 px at 1440 px wide (the 420 px frame) and at least
// 120 px at 390 px wide (the 318 px phone frame). The seal units and frame
// widths are measured in Chromium (see the constants). Pure file read, no DOM.
// The layout check measures the real render and is the gate.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

const landingCss = stripComments(
  readFileSync(resolve(here, "landing.module.css"), "utf8"),
);
const envelopeCss = stripComments(
  readFileSync(
    resolve(here, "../ceremony/envelope/Envelope.module.css"),
    "utf8",
  ),
);

/** The envelope's fixed viewBox width, in user units. */
const VIEW_W = 300;
/**
 * The seal's rendered width in user units at scale 1. The WaxSeal SVG is
 * nominally 64 units, but Chromium renders it at about 59.1 units: 165.6 px at
 * 1440 px wide, scale 2 and 1.4 px per unit (the 420 px frame), so 165.6 / 2 /
 * 1.4 = 59.1. The measured 113.6 px at 360 px wide (288 px frame) agrees.
 * Measured in Chromium on a production build; the layout check is the gate.
 */
const SEAL_RENDER_UNITS = 59.1;
/** The 1440 px frame: the envelope frame is at most 420 px wide (sealFrame). */
const FRAME_MAX_PX = 420;
/**
 * The seal frame at 390 px wide, measured in Chromium (the hero column, not
 * the viewport). The hero's 1.25rem sides alone would give 350 px, which is
 * too wide.
 */
const PHONE_FRAME_PX = 318;

const REQUIRED_WIDE_PX = 160;
const REQUIRED_PHONE_PX = 120;

/** The body of the first rule that matches `selector`, or throws. */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`rule not found: ${selector}`);
  return match[1] ?? "";
}

/** The scale factor in a transform list, 1 when there is none. */
function scaleOf(transform: string): number {
  const m = transform.match(/scale\(\s*([\d.]+)\s*\)/);
  return m ? Number(m[1]) : 1;
}

/** The Z offset in px of a transform list, 0 when there is none. */
function zOf(transform: string): number {
  const m = transform.match(/translateZ\(\s*(-?[\d.]+)px\s*\)/);
  return m ? Number(m[1]) : 0;
}

/** The turner's perspective in px. Envelope.module.css has two `.envelope`
 *  rules; the perspective is set in one of them. */
function perspectiveOf(css: string): number {
  for (const m of css.matchAll(/\.envelope\s*\{([^}]*)\}/g)) {
    const p = (m[1] ?? "").match(/perspective:\s*([\d.]+)px/);
    if (p) return Number(p[1]);
  }
  throw new Error("envelope perspective not found");
}

/** The seal box's transform, from the landing hero rule. */
function sealTransform(css: string): string {
  const body = ruleBody(css, ".sealFrame :global([data-seal-hash])");
  const m = body.match(/transform:\s*([^;]+);/);
  if (!m) throw new Error("seal transform not found");
  return m[1] ?? "";
}

/** The factor a perspective applies to an element at depth z (px). */
export function shrinkFactor(perspective: number, z: number): number {
  return perspective / (perspective - z);
}

/** The rendered seal width in px for a frame, scale, depth and perspective. */
export function renderedSealPx(
  framePx: number,
  scale: number,
  z: number,
  perspective: number,
): number {
  return (
    framePx *
    ((SEAL_RENDER_UNITS * scale) / VIEW_W) *
    shrinkFactor(perspective, z)
  );
}

describe("landing seal rendered size (landing.module.css, Envelope.module.css)", () => {
  const transform = sealTransform(landingCss);
  const scale = scaleOf(transform);
  const z = zOf(transform);
  const perspective = perspectiveOf(envelopeCss);

  it("keeps the seal at no Z offset, so the turner perspective does not shrink it", () => {
    expect(z).toBe(0);
    expect(zOf(ruleBody(envelopeCss, ".turned"))).toBe(0);
  });

  it("centres the scaled seal on the flap tip (150, 104) with origin 0 0", () => {
    // The nested seal SVG sits at (118, 72) with its origin at its own corner.
    // Scaled by 2, its centre is (118 + 64, 72 + 64) before the translate.
    const tx = Number(transform.match(/translate\(\s*(-?[\d.]+)px/)?.[1]);
    const ty = Number(
      transform.match(/translate\(\s*-?[\d.]+px,\s*(-?[\d.]+)px/)?.[1],
    );
    const centreX = 118 + 64 + tx;
    const centreY = 72 + 64 + ty;
    expect(centreX).toBe(150);
    expect(centreY).toBe(104);
  });

  it("renders at least 160 px wide in the 420 px frame (1440 px wide)", () => {
    const px = renderedSealPx(FRAME_MAX_PX, scale, z, perspective);
    expect(px).toBeGreaterThanOrEqual(REQUIRED_WIDE_PX);
  });

  it("renders at least 120 px wide in the phone frame (390 px wide)", () => {
    const px = renderedSealPx(PHONE_FRAME_PX, scale, z, perspective);
    expect(px).toBeGreaterThanOrEqual(REQUIRED_PHONE_PX);
  });

  it("would fail if the turner perspective pushed the seal toward the viewer", () => {
    // A seal 700 px in front of a 1400 px perspective draws at two thirds size.
    const shrunk = renderedSealPx(FRAME_MAX_PX, scale, -700, perspective);
    expect(shrunk).toBeLessThan(REQUIRED_WIDE_PX);
  });
});
