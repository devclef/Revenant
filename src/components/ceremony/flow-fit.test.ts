// Feature: 15-the-flow, task 15 (layout-check R1, PV1, N1). Source tests for the
// three product fixes: the number question's visual order, the phone recall
// region's top, and the Figures_Heading re-check surviving the close settle.
// Each assertion fails on the code before the fix and passes after it.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { keepsFocusRecheck } from "./stages";

const here = __dirname;
const pagerCss = readFileSync(
  resolve(here, "recall/RecallPager.module.css"),
  "utf8",
);
const sceneCss = readFileSync(resolve(here, "scene/scene.module.css"), "utf8");
const rootSource = readFileSync(resolve(here, "CeremonyRoot.tsx"), "utf8");

/** CSS with every @media block removed, so only the all-widths rules remain. */
function topLevel(css: string): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const at = css.indexOf("@media", i);
    if (at === -1) return out + css.slice(i);
    out += css.slice(i, at);
    let depth = 0;
    let j = css.indexOf("{", at);
    for (; j < css.length; j++) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}" && --depth === 0) break;
    }
    i = j + 1;
  }
  return out;
}

/** The body of the last rule whose selector list ends with `selector`, or "". */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const all = [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g"))];
  return all.at(-1)?.[1] ?? "";
}

describe("number question visual order at every width (R1)", () => {
  const css = topLevel(pagerCss);

  it("puts the Nav_Row right after the field, outside any media query", () => {
    expect(ruleBody(css, ".body > :global([data-nav-row])")).toMatch(
      /order:\s*1;/,
    );
    expect(ruleBody(css, ".body > .fieldError")).toMatch(/order:\s*0;/);
    expect(css).toMatch(/\.body > \.answerRow,/);
  });

  it("sends the rest after the Nav_Row and the intro line last", () => {
    expect(ruleBody(css, ".body > *")).toMatch(/order:\s*2;/);
    expect(ruleBody(css, ".body > .intro")).toMatch(/order:\s*11;/);
  });
});

describe("phone recall region top (R1, PV1)", () => {
  it("takes the Persona_Column's 6rem offset off the 56 px band", () => {
    expect(sceneCss).toMatch(/top:\s*calc\(56px - 6rem\);/);
    expect(sceneCss).not.toMatch(
      /top:\s*calc\(56px \+ min\(26vh, 170px\) \* 0\.696\);/,
    );
  });

  it("holds the hidden headline at the column's top edge, clear of the Ghost (G1)", () => {
    const hidden = sceneCss.slice(sceneCss.indexOf("clip-path: inset(50%);"));
    expect(hidden.slice(0, hidden.indexOf("}"))).toMatch(
      /top:\s*0;[\s\S]*left:\s*0;/,
    );
  });
});

describe("Figures_Heading re-check across the close settle (N1)", () => {
  it("keeps the re-check only for the figures-to-close settle", () => {
    expect(keepsFocusRecheck("figures", "close")).toBe(true);
    expect(keepsFocusRecheck("letter", "figures")).toBe(false);
    expect(keepsFocusRecheck("letter", "close")).toBe(false);
    expect(keepsFocusRecheck(null, "close")).toBe(false);
  });

  it("holds the re-check in a ref instead of the effect cleanup", () => {
    expect(rootSource).toMatch(
      /focusRecheckRef\.current = focusHeading\(region, \{ selector: "\[data-figures-heading\]"/,
    );
    expect(rootSource).toMatch(
      /prev !== stage && !keepsFocusRecheck\(prev, stage\)/,
    );
  });
});
