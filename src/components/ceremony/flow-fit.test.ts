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
const sealCss = readFileSync(
  resolve(here, "seal/SealBreak.module.css"),
  "utf8",
);

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

describe("break-stage step row clears the Compact_Ghost at 360 wide", () => {
  it("stops the phone step line at the Ghost's left edge, not at a right-edge reserve", () => {
    // The Compact_Ghost is centred (pit at 50%), 0.58 x min(26vh, 170px) wide,
    // so its left edge is 50% - 0.29 x W. The row's right padding must reach
    // from the column's right edge back to that edge plus an 8 px gap:
    // 50% (half the column) + 0.29 x W + 8 px.
    const body = ruleBody(
      sceneCss,
      ".scene [data-ceremony] > [data-step-indicator]",
    );
    expect(body).toMatch(
      /padding-right:\s*calc\(50% \+ 0\.29 \* min\(26vh, 170px\) \+ 8px\);/,
    );
    expect(body).not.toMatch(
      /padding-right:\s*calc\(0\.58 \* min\(26vh, 170px\) \+ 24px\);/,
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

// Regression guard for the break-stage phone step row (issue #524, fix 1a109dd).
// The Step_Indicator row ("Step 2 of 4 · ...") must end before the Compact_Ghost's
// left edge. This evaluates the row's CSS in pixels at 360 px wide and fails if
// the row's text box runs under the Ghost's box.

/** Evaluates a calc() made of `+` terms, each a product of numbers, N%, Npx and min(26vh, 170px). */
function evalCalc(
  expr: string,
  columnPx: number,
  viewportHeightPx: number,
): number {
  const trimmed = expr.trim();
  const body = /^calc\(/.test(trimmed) ? trimmed.slice(5, -1) : trimmed;
  return body.split(" + ").reduce((sum, term) => {
    const product = term.split(" * ").reduce((acc, factor) => {
      const f = factor.trim();
      if (f === "min(26vh, 170px)")
        return acc * Math.min(0.26 * viewportHeightPx, 170);
      if (/^[\d.]+%$/.test(f)) return (acc * (columnPx * parseFloat(f))) / 100;
      if (/^[\d.]+px$/.test(f)) return acc * parseFloat(f);
      if (/^[\d.]+$/.test(f)) return acc * parseFloat(f);
      throw new Error(`unsupported calc factor: ${f}`);
    }, 1);
    return sum + product;
  }, 0);
}

describe("break-stage step row clears the Compact_Ghost box at 360 wide (issue #524)", () => {
  const row = ruleBody(
    sceneCss,
    ".scene [data-ceremony] > [data-step-indicator]",
  );
  const padRight = row.match(/padding-right:\s*([^;]+);/)?.[1] ?? "";
  const minHeight = row.match(/min-height:\s*([^;]+);/)?.[1] ?? "";
  const columnPx = 360;
  // The Ghost's width, aspect and compact scale are read from scene.module.css,
  // so a CSS change to the Ghost fails this test instead of a copy of the value.
  const ghostWExpr =
    sceneCss.match(/--ghost-w:\s*(min\(26vh, 170px\));/)?.[1] ?? "";
  const compactScale = Number(
    [...sceneCss.matchAll(/\.pit\[data-compact="true"\]\s*\{([^}]*)\}/g)]
      .map((m) => m[1])
      .find((body) => body.includes("scale("))
      ?.match(/scale\(([\d.]+)\)/)?.[1],
  );
  const aspect = sceneCss
    .match(/\n\.ghost \{([^}]*)\}/)?.[1]
    .match(/aspect-ratio:\s*(\d+)\s*\/\s*(\d+)/);
  // aspect-ratio 5 / 6 is width 5 to height 6, so height = width x 6 / 5.
  const ghostAspect = aspect ? Number(aspect[2]) / Number(aspect[1]) : NaN;

  for (const viewportHeightPx of [640, 800]) {
    it(`ends the step text before the Ghost's left edge at ${viewportHeightPx} px tall`, () => {
      expect(padRight).not.toBe("");
      // The Compact_Ghost is centred on the column, 0.58 W wide. Its left edge is
      // columnPx / 2 - 0.29 W, and the text box's right edge is columnPx - padding.
      const w = evalCalc(ghostWExpr, columnPx, viewportHeightPx);
      const ghostLeftPx = columnPx / 2 - 0.5 * w * compactScale;
      const textRightPx =
        columnPx - evalCalc(padRight, columnPx, viewportHeightPx);
      expect(textRightPx).toBeLessThanOrEqual(ghostLeftPx);
    });

    it(`keeps the row as tall as the Ghost's box at ${viewportHeightPx} px tall`, () => {
      expect(minHeight).not.toBe("");
      const w = evalCalc(ghostWExpr, columnPx, viewportHeightPx);
      const ghostHeightPx = w * ghostAspect * compactScale;
      expect(
        evalCalc(minHeight, columnPx, viewportHeightPx),
      ).toBeGreaterThanOrEqual(ghostHeightPx - 1e-6);
    });
  }

  it("reads the Ghost's width, scale and aspect from scene.module.css", () => {
    expect(ghostWExpr).toBe("min(26vh, 170px)");
    expect(compactScale).toBeGreaterThan(0);
    expect(ghostAspect).toBeCloseTo(1.2, 10);
  });

  it("keeps the break line (data-break-line) in flow, never positioned over the Ghost", () => {
    // The line is the .hint paragraph on the Break the seal stage (SealBreak.tsx,
    // data-break-line). It must take its place in the column's flow, below the
    // Step_Indicator row, so it cannot sit on the Compact_Ghost's box.
    const hint = ruleBody(sealCss, ".hint");
    expect(hint).not.toBe("");
    expect(hint).not.toMatch(/position:\s*(absolute|fixed)/);
    expect(hint).not.toMatch(/float:/);
  });
});

describe("break and seal headings clear the Compact_Ghost's feet (PR #542 QA blocker)", () => {
  it("gives the phone Step_Indicator row a 1.5rem gap on marks and seal only", () => {
    const rule = sceneCss.match(
      /\.scene \[data-ceremony="marks"\] > \[data-step-indicator\],\s*\.scene \[data-ceremony="seal"\] > \[data-step-indicator\]\s*\{([^}]*)\}/,
    );
    expect(rule?.[1] ?? "").toMatch(/margin-bottom:\s*1\.5rem;/);
    expect(sceneCss).not.toMatch(
      /\[data-ceremony="recall"\] > \[data-step-indicator\][^{]*\{[^}]*margin-bottom/,
    );
  });
});
