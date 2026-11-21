// Feature: 07-judge-journey (#515 task 2 fit, recall column top)
//
// The recall Stage sits in the persona column and is pinned under the Soil strip
// on narrow widths. Its top rules keep the question, field and Next control in
// the first viewport. These tests fail if the recall column top rule is removed
// from scene.module.css. Pure file read, no DOM.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "scene.module.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** The compact (max-width 599.98px) block that places the recall column. */
function compactBlock(): string {
  const start = css.indexOf("@media (max-width: 599.98px) {\n  .pit[data-compact");
  expect(start).toBeGreaterThan(-1);
  const end = css.indexOf("\n}\n", start);
  return css.slice(start, end);
}

describe("the recall column top rule (#515 fit)", () => {
  it("pins the recall Stage with a top rule in the narrow block", () => {
    expect(css).toMatch(/top:\s*calc\(var\(--soil-top\)\s*\+\s*var\(--soil-band\)\s*\+\s*0\.25rem\s*-\s*6rem\s*-\s*18vh\);/);
  });

  it("places the compact recall column in the band under the Compact_Top_Bar", () => {
    // Spec 15 task 15 (R1, PV1): the 56 px band less the Persona_Column's 6rem
    // offset. The region carries the Compact_Ghost beside its Step_Indicator row.
    expect(compactBlock()).toMatch(/top:\s*calc\(56px - 6rem\);/);
  });
});
