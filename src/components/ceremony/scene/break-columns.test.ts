// Feature: 17-screen-layout-fixes (task 9.1, D7)
//
// The marks column reserves the Soil_Band clearance at 900 px and wider. Below
// 900 px the rules keep their previous values. The Seal_Group keeps its
// Ghost-based position: that positioning fixed the Ghost covering the marks
// text and the Break the seal control (#515), so it is not removed here.

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

  it("keeps the Seal_Group positioned from the Ghost (#515)", () => {
    const group = ruleBody(css, ".marksLayer [data-seal-group]");
    expect(group).toMatch(/var\(--ghost-cx\)/);
  });
});
