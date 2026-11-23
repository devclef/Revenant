// Feature: 17-screen-layout-fixes (task 9.1, D7)
//
// The marks column reserves the Soil_Band clearance at 900 px and wider. Below
// 900 px the rules keep their previous values. The Seal_Group sits 24 px right
// of the marks card (17 D7), capped by the Ghost-based position from #515 so it
// never moves right of its old place.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "scene.module.css"), "utf8");

/** The declarations of the first rule whose selector matches `selector`. */
function ruleBody(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`);
  if (start === -1) return "";
  const open = source.indexOf("{", start);
  const close = source.indexOf("}", open);
  return source.slice(open + 1, close);
}

describe("break the seal columns (17 D7)", () => {
  it("reserves the Soil clearance under the marks column", () => {
    expect(css).toMatch(/padding-block-end:\s*var\(--soil-clear\)/);
  });

  it("keeps the rules below 900 px at their previous values", () => {
    expect(ruleBody(css, ".soilStrip")).toMatch(/top:\s*var\(--soil-top\)/);
    expect(css).toMatch(/@media \(max-width: 899\.98px\) \{\s*\.heldEnvelope \{\s*top: 47%;/);
  });

  it("anchors the Seal_Group to the marks card, 24 px to its right (17 D7)", () => {
    const group = ruleBody(css, ".marksLayer [data-seal-group]");
    expect(group).toMatch(/min\(28rem,\s*40vw\)\s*\+\s*24px/);
    expect(group).toMatch(/var\(--ghost-cx\)/);
  });
});
