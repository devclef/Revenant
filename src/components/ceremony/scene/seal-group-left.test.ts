// Feature: 07-judge-journey (#515 task 3)
//
// The Seal_Group's left edge. The old left value (the Ghost body's left edge
// minus the gap and the group width) went below zero at 1280 and 1366 wide, so
// Break the seal, the marks text and Skip to the receipts were cut off the left
// edge. The fix clamps the left edge to the column's left edge. This test reads
// the CSS and evaluates the same formula at the two desktop sizes.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "scene.module.css"), "utf8");

const SEAL_GROUP_GAP_PX = 20;
const SEAL_GROUP_WIDTH_PX = 14 * 16;
const ROOT_PX = 16;

/** The Seal_Group left edge in px, from the same formula as the CSS. */
function sealGroupLeft(vw: number, vh: number, clamped: boolean): number {
  const frameW = Math.min(vw, 1440);
  const frameL = (vw - frameW) / 2;
  const pad = Math.min(Math.max(ROOT_PX, 0.03 * vw), 2.5 * ROOT_PX);
  const colW = Math.min(34 * ROOT_PX, 0.46 * vw, frameW - 2 * pad);
  const ghostCx = frameL + pad + colW / 2;
  const ghostW = Math.min(0.5 * vh, 560);
  const ghostBodyLeft = ghostCx - ghostW / 2 + ghostW * 0.12;
  const unclamped = ghostBodyLeft - SEAL_GROUP_GAP_PX - SEAL_GROUP_WIDTH_PX;
  return clamped ? Math.max(frameL + pad, unclamped) : unclamped;
}

describe("the Seal_Group left edge stays inside the viewport (#515 task 3)", () => {
  it("clamps the group's left edge to the column's left edge in the CSS", () => {
    const rule = css.match(/\.marksLayer \[data-seal-group\] \{([\s\S]*?)\n  \}/)?.[1] ?? "";
    expect(rule).toMatch(/left:\s*calc\(\s*max\(\s*var\(--frame-l\) \+ var\(--pad\),/);
  });

  it("is not negative at 1280 by 800 (the old formula gave about -86 px)", () => {
    expect(sealGroupLeft(1280, 800, false)).toBeLessThan(0);
    expect(sealGroupLeft(1280, 800, true)).toBeGreaterThanOrEqual(0);
  });

  it("is not negative at 1366 by 768 (the old formula gave about -77 px)", () => {
    expect(sealGroupLeft(1366, 768, false)).toBeLessThan(0);
    expect(sealGroupLeft(1366, 768, true)).toBeGreaterThanOrEqual(0);
  });

  it("never starts left of the column's left edge at the desktop sizes", () => {
    for (const [vw, vh] of [
      [1280, 800],
      [1366, 768],
      [1440, 900],
      [1920, 1080],
    ] as const) {
      const frameL = (vw - Math.min(vw, 1440)) / 2;
      const pad = Math.min(Math.max(ROOT_PX, 0.03 * vw), 2.5 * ROOT_PX);
      expect(sealGroupLeft(vw, vh, true)).toBeGreaterThanOrEqual(frameL + pad);
    }
  });
});
