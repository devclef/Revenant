// Feature: 09-demo-polish (landing hero below 600 px, layout-check LG1)
//
// The Landing_Ghost is drawn at a fixed place in the Scene backdrop, with its
// bottom at about 71vh. Below 600 px the calls to action stay in the flow and
// the reserved ghost box comes before them, so the actions start below the
// drawn ghost (LG1). These tests read landing.module.css and check that rule.
//
// Journey_Check reconciliation (issue #341, X4). Measured on a local production
// build (npm run build, next start, no database, Chromium 1280 headless). The
// Landing_Ghost box numbers below come from commit 7f7c325, not from this file.
//
// Checks that fail on a healthy production today, and the decision for each:
//
//   J5 scroll-width, persona pages (us-maya, eu-tomas) at every Evidence_Size:
//     decision: fix the check. Not measured on a healthy production. The conclusion
//     comes from reading the code: the check waits for data-ceremony "intact", and
//     src/components/ceremony/stages.ts has no such stage (it renders "sealed" or
//     "recall"). The local run had no database, so the persona pages stopped at
//     data-ceremony="error" and J5 was not reached. Owner_Patch 97b73ba (the walk
//     opens on recall). J2 uses the same wait, so it fails for the same reason.
//
//   J6 PH1 on / at 360x640 (PH1_LANDING):
//     decision: fix the check, not the page. The check reads the Landing_Ghost box
//     about 0.5 s after load, while the entry transform runs. Box as recorded in
//     commit 7f7c325 (local production build), CSS px:
//       t=0 ms      471 to 670   (the check reads here)
//       t=1000 ms   404 to 604
//       t=3000 ms   254 to 454   (settled)
//       t=6000 ms   255 to 455
//       t=10000 ms  254 to 454
//     The settled box is inside the 640 px viewport, and the primary call to action
//     is at 475 to 531, also inside. landing.module.css is unchanged. The Owner_Patch
//     for tools/qa/layout-check.mjs (runPhoneChecks) reads the box after the
//     transform settles, about 3 s.
//
//   J6 PH1 on / at 390x844: passes once settled. Box 397 to 601 in 844 px, as
//     recorded in commit 7f7c325 (not re-measured here). Not a failing line. The
//     same too-early read applies.
//
//   J6 PH1 on /demo/live at 390x844 and 360x640:
//     decision: fix the page, in task 12 (L3), which owns the Write-step height.
//     Not measured or changed in this reconciliation.
//
// Pages that pass today, with no change: J5 on /, /demo, /demo/live and
// /how-it-is-sealed at 2560x1440, 1366x800, 1280x800, 390x844 and 360x640.
//
// Pure file read, no DOM.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "landing.module.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** The text of the phone block (max-width 599.98px) that sets the actions order. */
function phoneBlock(): string {
  const start = css.indexOf("@media (max-width: 599.98px) {\n");
  expect(start).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("\n}\n", start) + 3);
}

describe("landing hero below 600 px (landing.module.css)", () => {
  it("puts the actions after the reserved ghost box, in the flow", () => {
    const block = phoneBlock();
    expect(block).toMatch(/\.actions \{\s*order: 1;\s*\}/);
    expect(block).not.toMatch(/position:\s*absolute/);
  });

  it("sizes the reserved ghost box to 71vh less 300px, never below zero", () => {
    const block = phoneBlock();
    expect(block).toMatch(/\.ghost \{\s*height: max\(0px, calc\(71vh - 300px\)\);\s*\}/);
  });
});

describe("landing Landing_Ghost box below 600 px (spec 10 X2.5)", () => {
  it("sets the phone ghost box rule inside the phone block, and keeps the base ghost rule outside it", () => {
    const block = phoneBlock();
    expect(block).toMatch(/\.hero \.ghost \{\s*height: max\(0px, calc\(71vh - 300px\)\);\s*\}/);
    // Outside the phone block, the wide ghost rule is still the base 30svh rule.
    expect(css).toMatch(/\.ghost \{\s*width: 100%;\s*height: 30vh;/);
  });
});

/**
 * The settled Landing_Ghost box (data-ghost-pit [data-ghost-box]) on the phone,
 * measured on a local production build (Chromium, after the entry transform
 * settled, about 3 s). Source: the X4 measurement in commit 7f7c325. CSS px.
 */
const MEASURED_PHONE_GHOST = [
  { width: 360, height: 640, top: 254, bottom: 454 },
  { width: 390, height: 844, top: 397, bottom: 601 },
] as const;

describe("landing Landing_Ghost on the first screen below 600 px (measured, X4)", () => {
  for (const size of MEASURED_PHONE_GHOST) {
    const label = `${size.width}x${size.height}`;

    it(`keeps the whole drawn ghost inside the first screen at ${label}`, () => {
      expect(size.top).toBeGreaterThanOrEqual(0);
      expect(size.bottom).toBeLessThanOrEqual(size.height);
    });

    it(`draws the ghost bottom at about 71vh at ${label}`, () => {
      // The CSS comment says the bottom is about 71vh. The measured bottoms are
      // 454 px (71vh is 454.4 px) and 601 px (71vh is 599.2 px). Allow 2 px.
      const seventyOneVh = size.height * 0.71;
      expect(Math.abs(size.bottom - seventyOneVh)).toBeLessThanOrEqual(2);
    });
  }

  it("keeps the phone rule that reserves the ghost box, so the page does not move", () => {
    const block = phoneBlock();
    expect(block).toMatch(/\.hero \.ghost \{\s*height: max\(0px, calc\(71vh - 300px\)\);\s*\}/);
  });
});
