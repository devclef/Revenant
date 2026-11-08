// Feature: 09-demo-polish (spec 09 P4.2, P4.3; C2 and P8.4)
//
// The Compact_Ghost below 600 px after the First_Step: the size and place the
// Ghost takes, that it moves by transform and opacity only, that the seal keeps
// a 44 x 44 target, that the Soil fades out, and that the h1 is visually hidden
// but stays in the document. Replaces the spec 07 R10.15 narrow-scale test
// (floor 0.8), which the spec 09 retired below 600 px.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  COMPACT_GHOST_MAX_PX,
  COMPACT_GHOST_SCALE,
  COMPACT_SEAL_HIT_PX,
  PHONE_BELOW_PX,
} from "../constants";
import { LocalViewProvider } from "../local-view";
import { MotionProvider } from "../motion";
import { SkipProvider } from "../skip";
import { StageContext } from "../stage-context";
import type { Stage } from "../stages";
import { PersonaGhost } from "./PersonaGhost";
import { SceneHeadline } from "./SceneHeadline";

const here = dirname(fileURLToPath(import.meta.url));
const scene = readFileSync(join(here, "scene.module.css"), "utf8");
const seal = readFileSync(join(here, "..", "seal", "HeldSeal.module.css"), "utf8");

/** The body of the first rule whose selector matches `selector` exactly, or "". */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escaped} \\{([^}]*)\\}`))?.[1] ?? "";
}

/** The text of the phone (max-width 599.98 px) media block that contains `marker`. */
function phoneBlock(marker: string): string {
  const start = scene.indexOf("@media (max-width: 599.98px)");
  const blocks: string[] = [];
  let at = start;
  while (at >= 0) {
    const open = scene.indexOf("{", at);
    let depth = 0;
    let end = open;
    for (; end < scene.length; end++) {
      if (scene[end] === "{") depth++;
      if (scene[end] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    blocks.push(scene.slice(open + 1, end));
    at = scene.indexOf("@media (max-width: 599.98px)", end);
  }
  return blocks.find((block) => block.includes(marker)) ?? "";
}

function ghostAt(stage: Stage): string {
  return renderToStaticMarkup(
    createElement(
      MotionProvider,
      null,
      createElement(
        SkipProvider,
        null,
        createElement(
          LocalViewProvider,
          null,
          createElement(StageContext.Provider, { value: stage }, createElement(PersonaGhost)),
        ),
      ),
    ),
  );
}

describe("the Compact_Ghost is switched on from the First_Step (P4.2)", () => {
  it("is off in intact and on from recall, through close", () => {
    expect(ghostAt("intact")).toContain('data-compact="false"');
    for (const stage of ["recall", "marks", "seal", "letter", "figures", "close"] as const) {
      expect(ghostAt(stage), stage).toContain('data-compact="true"');
    }
  });
});

describe("the Compact_Ghost size and place (P4.2)", () => {
  it("is at most COMPACT_GHOST_MAX_PX tall at the widest narrow Ghost_Box (170 px wide, 1.2 aspect)", () => {
    expect(COMPACT_GHOST_MAX_PX).toBe(120);
    const tallestPx = 170 * 1.2 * COMPACT_GHOST_SCALE;
    expect(tallestPx).toBeLessThanOrEqual(COMPACT_GHOST_MAX_PX);
  });

  it("is scaled by transform only, about its pit's own point", () => {
    const body = ruleBody(phoneBlock("data-compact"), '.pit[data-compact="true"]');
    expect(body).toContain(`scale(${COMPACT_GHOST_SCALE})`);
    expect(body).toMatch(/transform-origin: 0 0;/);
    // The compact rule sets no layout property: the pit keeps its own left and top.
    expect(body).not.toMatch(/\b(left|top|width|height|right|bottom):/);
  });

  it("moves the Ghost to the right end of the Step_Indicator row, top at 56 px", () => {
    const body = ruleBody(phoneBlock("data-compact"), '.pit[data-compact="true"]');
    // The right edge sits 16 px from the window edge; the top sits at the bar's bottom (56 px).
    expect(body).toContain("calc(100vw - 16px - 0.29 * min(26vh, 170px) - var(--ghost-x))");
    expect(body).toContain("calc(56px - var(--soil-top) + 0.58 * (1.2 * min(26vh, 170px) - 3vh))");
  });

  it("applies only below PHONE_BELOW_PX", () => {
    expect(PHONE_BELOW_PX).toBe(600);
    expect(scene).toContain("@media (max-width: 599.98px) {\n  .pit[data-compact=\"true\"]");
  });
});

describe("the seal keeps a 44 x 44 target in the Compact_Ghost (P8.4)", () => {
  it("grows the hit square so it is 44 px on screen after the scale", () => {
    expect(COMPACT_SEAL_HIT_PX * COMPACT_GHOST_SCALE).toBeGreaterThanOrEqual(44);
    expect(scene).toContain("--seal-hit-compact: 76px;");
  });

  it("takes --seal-hit-compact in HeldSeal's hit box", () => {
    expect(seal).toContain("var(--seal-hit-compact, 0px)");
  });
});

describe("the Soil fades out after the First_Step (P4.3)", () => {
  it("sets opacity 0 on the Soil strip and canvas for every persona Stage after intact, below 600 px", () => {
    const block = phoneBlock(".soilStrip");
    for (const stage of ["recall", "marks", "seal", "letter", "figures", "close"]) {
      expect(block).toContain(`[data-ceremony="${stage}"]`);
    }
    expect(block).toMatch(/\.soilStrip,[\s\S]*?\.soilLayer \{\s*opacity: 0;/);
  });

  it("animates the fade in full motion only, through opacity", () => {
    expect(scene).toMatch(
      /@media \(prefers-reduced-motion: no-preference\) and \(max-width: 599\.98px\) \{[\s\S]*?\[data-ceremony-motion="full"\] \.soilStrip,\s*\[data-ceremony-motion="full"\] \.soilLayer \{\s*transition: opacity 400ms ease;/,
    );
  });
});

describe("the h1 is visually hidden after the First_Step, and not removed (spec 09 P4.2, Group P)", () => {
  it("renders the h1 with its text, so it stays in the document", () => {
    const html = renderToStaticMarkup(createElement(SceneHeadline, { text: "Maya's letter" }));
    expect(html).toContain("<h1");
    expect(html).toContain("Maya&#x27;s letter");
  });

  it("hides it with the visually hidden pattern, never display: none", () => {
    const rule =
      phoneBlock(".headline").match(/\.personaColumn:has\(> :is\(\[data-ceremony="recall"\][^{]*\) \.headline \{([^}]*)\}/)?.[1] ?? "";
    expect(rule).not.toBe("");
    expect(rule).toMatch(/position: absolute;/);
    expect(rule).toMatch(/clip-path: inset\(50%\);/);
    expect(rule).toMatch(/overflow: hidden;/);
    expect(rule).not.toMatch(/display:\s*none/);
    expect(rule).not.toMatch(/visibility:\s*hidden/);
  });
});

describe("the Compact_Ghost and the Soil honour Calm and reduced motion (P4.3)", () => {
  it("transitions the Compact_Ghost's pit only under full motion, through transform", () => {
    expect(scene).toMatch(
      /\[data-ceremony-motion="full"\] \.pit \{\s*transition: transform 600ms ease;/,
    );
  });
});

// Spec 10 X2.1 and C1.6: below 600 px the Step_Indicator row reserves the
// Compact_Ghost's box, and the Compact_Ghost's pit does not transition.
describe("phone Compact_Ghost clearance and pit transition (scene.module.css)", () => {
  it("reserves the Compact_Ghost box for the Step_Indicator row, below 600 px only", () => {
    const block = phoneBlock("[data-step-indicator]");
    expect(block).not.toBe("");
    expect(block).toMatch(/box-sizing:\s*border-box;/);
    expect(block).toMatch(/min-height:\s*calc\(0\.58 \* 1\.2 \* min\(26vh, 170px\)\);/);
    expect(block).toMatch(/padding-right:\s*calc\(0\.58 \* min\(26vh, 170px\) \+ 24px\);/);
    expect(block).toMatch(/align-content:\s*center;/);
  });

  it("turns the pit's transition off for the compact pit under full motion, below 600 px", () => {
    const block = phoneBlock("[data-step-indicator]");
    expect(block).toMatch(/\[data-ceremony-motion="full"\] \.pit\[data-compact="true"\] \{\s*transition: none;/);
    // The 600 ms pit transition is still set above the phone block, unchanged.
    expect(scene).toMatch(/\[data-ceremony-motion="full"\] \.pit \{\s*transition: transform 600ms ease;/);
  });

  it("sets .pit[data-compact='true'] to no transition in the phone block, in any motion mode", () => {
    const block = phoneBlock("[data-step-indicator]");
    expect(block).toMatch(/\.pit\[data-compact="true"\] \{\s*transition: none;\s*\}/);
    // Declared after the full-motion pit transition, so it wins at equal specificity.
    const literal = scene.lastIndexOf('\n  .pit[data-compact="true"] {');
    expect(literal).toBeGreaterThan(-1);
    expect(literal).toBeGreaterThan(scene.indexOf('[data-ceremony-motion="full"] .pit {'));
  });
});
