// Feature: 07-judge-journey, R21.4
//
// R21.4: every CSS animation, CSS transition and Web Animations API animation
// on a Scene page changes only `transform` and `opacity`. This test scans every
// @keyframes block, every `transition` and every `animation` in the Scene
// folder and fails on any other property. The Soil_Canvas draws its own pixels
// inside its canvas, and that is the only exception the spec allows. It is not
// a CSS property, so the scan does not see it.
//
// Test files are skipped, so the scan reads only the shipped code.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { LIGHT_CLIP_GAP_PX } from "../constants";

const here = dirname(fileURLToPath(import.meta.url));

/** The only properties a Scene animation may change (R21.4). */
const ALLOWED_PROPERTIES = new Set(["transform", "opacity"]);

/** Keywords a transition list may use in place of a property name. */
const TRANSITION_KEYWORDS = new Set(["none"]);

/** Every shipped source file in the Scene folder (tests and generated files excluded). */
function sceneSources(): { name: string; text: string }[] {
  return readdirSync(here)
    .filter((name) => /\.(css|ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name))
    .map((name) => ({ name: join(here, name), text: readFileSync(join(here, name), "utf8") }));
}

/** The body of each `@keyframes name { ... }` block, with its name. */
function keyframeBlocks(css: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const head = /@keyframes\s+([\w-]+)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = head.exec(css)) !== null) {
    let depth = 1;
    let i = head.lastIndex;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth += 1;
      if (css[i] === "}") depth -= 1;
      i += 1;
    }
    out.push({ name: m[1], body: css.slice(head.lastIndex, i - 1) });
    head.lastIndex = i;
  }
  return out;
}

/** The property names in a keyframe body, such as `transform` in `transform: translateY(0)`. */
function declaredProperties(body: string): string[] {
  return [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
}

/** The property names a `transition` value names, one per comma-separated item. */
function transitionProperties(value: string): string[] {
  // Strip parentheses so commas inside var(), calc() and cubic-bezier() do not split items.
  const flat = value.replace(/\([^()]*\)/g, "()");
  return flat
    .split(",")
    .map((item) => item.trim().split(/\s+/)[0])
    .filter((name) => name && !/^\d/.test(name) && !TRANSITION_KEYWORDS.has(name));
}

describe("R21.4: Scene animations change only transform and opacity", () => {
  const sources = sceneSources();

  it("finds the Scene's keyframes and transitions, so the scan is not empty", () => {
    const css = sources.filter((s) => s.name.endsWith(".css")).map((s) => s.text).join("\n");
    expect(keyframeBlocks(css).length).toBeGreaterThan(0);
    expect(css).toMatch(/transition:/);
  });

  it("allows only transform and opacity in every @keyframes block", () => {
    for (const { name, text } of sources.filter((s) => s.name.endsWith(".css"))) {
      for (const block of keyframeBlocks(text)) {
        for (const prop of declaredProperties(block.body)) {
          expect(
            ALLOWED_PROPERTIES.has(prop),
            `@keyframes ${block.name} in ${name} animates "${prop}" (R21.4)`,
          ).toBe(true);
        }
      }
    }
  });

  it("allows only transform and opacity in every CSS transition", () => {
    for (const { name, text } of sources) {
      for (const m of text.matchAll(/(?<![\w-])transition(?:-property)?\s*:\s*([^;`"]*)/g)) {
        for (const prop of transitionProperties(m[1])) {
          expect(
            ALLOWED_PROPERTIES.has(prop),
            `transition in ${name} changes "${prop}" (R21.4): ${m[0].trim()}`,
          ).toBe(true);
        }
      }
    }
  });

  it("allows only transform and opacity in every transition set in a TypeScript style value", () => {
    for (const { name, text } of sources.filter((s) => !s.name.endsWith(".css"))) {
      for (const m of text.matchAll(/\btransition\s*:\s*[`"']([^`"']*)/g)) {
        for (const prop of transitionProperties(m[1])) {
          expect(
            ALLOWED_PROPERTIES.has(prop),
            `transition in ${name} changes "${prop}" (R21.4): ${m[0].trim()}`,
          ).toBe(true);
        }
      }
    }
  });

  it("uses no `transition: all` anywhere in the Scene", () => {
    for (const { name, text } of sources) {
      expect(text, `${name} uses transition: all (R21.4)`).not.toMatch(/transition\s*:\s*[`"']?all\b/);
    }
  });

  it("uses no Web Animations API call in the Scene", () => {
    for (const { name, text } of sources) {
      expect(text, `${name} calls the Web Animations API (R21.4)`).not.toMatch(/\.animate\(/);
    }
  });

  it("keeps each animation's keyframes to the allowed properties by name", () => {
    const css = sources.filter((s) => s.name.endsWith(".css")).map((s) => s.text).join("\n");
    const names = keyframeBlocks(css).map((b) => b.name);
    expect(names).toEqual(expect.arrayContaining(["rise", "bob", "shake", "shakeSoil", "ghostLeave", "ghostFade", "ghostSink"]));
  });
});

describe("R8.3: the Hero settle is opacity only, behind the motion gate", () => {
  const css = sceneSources()
    .filter((s) => s.name.endsWith(".css"))
    .map((s) => s.text)
    .join("\n");

  it("defines heroSettle with opacity keyframes only", () => {
    const block = keyframeBlocks(css).find((b) => b.name === "heroSettle");
    expect(block, "heroSettle keyframes must exist").toBeDefined();
    const props = declaredProperties(block?.body ?? "");
    for (const prop of props) {
      expect(ALLOWED_PROPERTIES.has(prop), `heroSettle animates "${prop}" (R8.3)`).toBe(true);
    }
    expect(props).toEqual(["opacity", "opacity"]);
  });

  it("sets heroSettle only inside the full-motion, no-preference gate", () => {
    const gate = css.match(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}/g) ?? [];
    const gated = gate.some(
      (g) => g.includes('[data-ceremony-motion="full"]') && g.includes("animation: heroSettle"),
    );
    expect(gated, "heroSettle must sit behind the full-motion gate (R8.4)").toBe(true);
  });
});

describe("R21.4: the Ghost hooks are plain attributes, animated only by allowed properties", () => {
  const GHOST_HOOKS = ["data-ghost-pit", "data-ghost-rise", "data-ghost-bob", "data-ghost-box"];
  const sources = sceneSources();
  const css = sources
    .filter((s) => s.name.endsWith(".css"))
    .map((s) => s.text)
    .join("\n");

  it("renders every data-ghost-* hook in the shipped Ghost source", () => {
    const ghost = sources.find((s) => s.name.endsWith("/Ghost.tsx"));
    expect(ghost, "Ghost.tsx must exist in the Scene folder").toBeDefined();
    for (const hook of GHOST_HOOKS) {
      expect(ghost?.text ?? "", `Ghost.tsx renders ${hook}`).toContain(hook);
    }
  });

  it("allows only transform and opacity in any CSS rule that targets a data-ghost hook", () => {
    const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    for (const rule of rules) {
      if (!rule[1].includes("data-ghost")) continue;
      for (const m of rule[2].matchAll(/(?<![\w-])transition(?:-property)?\s*:\s*([^;]*)/g)) {
        for (const prop of transitionProperties(m[1])) {
          expect(ALLOWED_PROPERTIES.has(prop), `ghost rule "${rule[1].trim()}" transitions "${prop}" (R21.4)`).toBe(true);
        }
      }
    }
  });
});

describe("the light clip matches its constant (scene.module.css .light)", () => {
  const css = sceneSources()
    .filter((s) => s.name.endsWith(".css"))
    .map((s) => s.text)
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  it("sets the light clip-path to inset(0 0 calc(50% - LIGHT_CLIP_GAP_PX) 0)", () => {
    const body = css.match(/\.light\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(body).toMatch(/clip-path:\s*inset\(0 0 calc\(50% - (\d+)px\) 0\)/);
    const gap = Number(body.match(/calc\(50% - (\d+)px\)/)?.[1]);
    expect(gap).toBe(LIGHT_CLIP_GAP_PX);
  });
});
