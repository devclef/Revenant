// Feature: 09-demo-polish (spec 09 P4.2, D1)
//
// The Compact_Ghost size, the ghostSink animation and the settled sunk pose
// that Calm and reduced motion show. Markup is rendered on the server; the CSS
// is read as text, as the other scene tests do.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  GHOST_SINK_MS,
  GHOST_SIZE_COMPACT,
  GHOST_SIZE_FULL,
  GHOST_SUNK_TRANSLATE,
} from "../constants";
import { LocalViewProvider } from "../local-view";
import { MotionProvider } from "../motion";
import { SkipProvider } from "../skip";
import { StageContext } from "../stage-context";
import type { Stage } from "../stages";
import { Ghost } from "./Ghost";
import { PersonaGhost } from "./PersonaGhost";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "scene.module.css"), "utf8");

/** The body of the first rule whose selector matches `selector` exactly, or "". */
function ruleBody(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`${escaped} \\{([^}]*)\\}`))?.[1] ?? "";
}

/** True when the text at `index` sits at the top level, outside every block. */
function isTopLevel(source: string, index: number): boolean {
  let depth = 0;
  for (let i = 0; i < index; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}") depth--;
  }
  return depth === 0;
}

/** The text of the block that opens with the given at-rule head and contains `marker`. */
function mediaBlockWith(source: string, head: string, marker: string): string {
  let at = source.indexOf(head);
  while (at >= 0) {
    const open = source.indexOf("{", at);
    let depth = 0;
    let end = open;
    for (; end < source.length; end++) {
      if (source[end] === "{") depth++;
      if (source[end] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    const block = source.slice(open + 1, end);
    if (block.includes(marker)) return block;
    at = source.indexOf(head, end);
  }
  return "";
}

function personaGhostAt(stage: Stage): string {
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

describe("the Compact_Ghost size (P4.2)", () => {
  it("is the full size on the drawing by default", () => {
    const html = renderToStaticMarkup(createElement(Ghost));
    expect(html).toContain(`data-size="${GHOST_SIZE_FULL}"`);
  });

  it("renders the compact size on the pit when asked for it", () => {
    const html = renderToStaticMarkup(createElement(Ghost, { size: GHOST_SIZE_COMPACT }));
    expect(html).toContain(`data-size="${GHOST_SIZE_COMPACT}"`);
    expect(html).not.toContain(`data-size="${GHOST_SIZE_FULL}"`);
  });

  it("is compact from recall on, and full in intact, at every Phone_Size", () => {
    expect(personaGhostAt("intact")).toContain(`data-size="${GHOST_SIZE_FULL}"`);
    for (const stage of ["recall", "marks", "seal", "letter", "figures", "close"] as const) {
      expect(personaGhostAt(stage), stage).toContain(`data-size="${GHOST_SIZE_COMPACT}"`);
    }
  });
});

describe("the ghostSink animation (D1)", () => {
  it("sinks from the risen pose to the sunk pose, transform only", () => {
    const block = css.match(/@keyframes ghostSink \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(block).toContain("transform: translateY(var(--ghost-risen))");
    expect(block).toContain(GHOST_SUNK_TRANSLATE);
    expect(block).not.toMatch(/\b(top|left|width|height|margin|padding|opacity):/);
  });

  it("plays only in full motion, for the sinking state, and holds its end pose", () => {
    const block = mediaBlockWith(css, "@media (prefers-reduced-motion: no-preference)", 'data-sink="sinking"');
    expect(block).toContain(`ghostSink ${GHOST_SINK_MS}ms`);
    expect(block).toContain("forwards");
    expect(block).toContain('[data-ceremony-motion="full"] .ghost[data-sink="sinking"]');
  });

  it("sets no animation on the settled sunk pose, so a reload does not replay it", () => {
    const block = mediaBlockWith(css, "@media (prefers-reduced-motion: no-preference)", 'data-sink="sunk"');
    expect(ruleBody(block, '[data-ceremony-motion="full"] .ghost[data-sink="sunk"]')).toContain("animation: none;");
  });

  it("does not put the sinking animation outside the motion gate", () => {
    const at = css.indexOf('.ghost[data-sink="sinking"]');
    expect(at).toBeGreaterThan(-1);
    expect(isTopLevel(css, at)).toBe(false);
  });
});

describe("the settled sunk pose under Calm and reduced motion (D1)", () => {
  it("is set at the top level, outside every media query, with no animation", () => {
    // The same selector also appears inside the motion gate, so take the last one, which is the top-level rule.
    const at = css.lastIndexOf('.ghost[data-sink="sunk"] {');
    expect(at).toBeGreaterThan(-1);
    expect(isTopLevel(css, at)).toBe(true);
    const body = css.slice(at, css.indexOf("}", at));
    expect(body).toContain(`transform: ${GHOST_SUNK_TRANSLATE};`);
    expect(body).not.toMatch(/animation/);
  });

  it("renders data-sink=sunk on the rise element and no sink attribute when idle", () => {
    const sunk = renderToStaticMarkup(createElement(Ghost, { sink: "sunk" }));
    expect(sunk).toContain('data-sink="sunk"');
    const idle = renderToStaticMarkup(createElement(Ghost));
    expect(idle).not.toContain("data-sink");
  });

  it("renders the sinking state as data-sink=sinking, for the full-motion animation", () => {
    const sinking = renderToStaticMarkup(createElement(Ghost, { sink: "sinking" }));
    expect(sinking).toContain('data-sink="sinking"');
  });
});
