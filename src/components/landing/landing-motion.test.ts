// Feature: 09-demo-polish (landing hero seal, issue #429, L3 motion)
//
// Checks the hero motion in landing.module.css: only the wax glow and the
// ghost settle animate, both with opacity or transform, and both sit behind a
// reduced-motion guard so the rest composition is the same with no motion and
// with no JavaScript.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = fileURLToPath(new URL(".", import.meta.url));
const raw = readFileSync(join(here, "landing.module.css"), "utf8");
const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");

/** The body of every @media block whose query matches the given text. */
function mediaBodies(query: string): string[] {
  const bodies: string[] = [];
  const re = new RegExp(`@media\\s*\\(${query}\\)\\s*\\{`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      if (css[i] === "}") depth--;
      i++;
    }
    bodies.push(css.slice(start, i - 1));
  }
  return bodies;
}

/** The declaration block that follows a selector, or "" if absent. */
function ruleBody(selector: string, source = css): string {
  const idx = source.indexOf(`${selector} {`);
  if (idx < 0) return "";
  const open = source.indexOf("{", idx);
  const close = source.indexOf("}", open);
  return source.slice(open + 1, close);
}

describe("landing hero motion (landing.module.css)", () => {
  const motion = mediaBodies("prefers-reduced-motion: no-preference");

  it("guards every animation behind prefers-reduced-motion: no-preference", () => {
    const animations = css.match(/animation(-name)?\s*:/g) ?? [];
    const guarded = motion.join("\n").match(/animation(-name)?\s*:/g) ?? [];
    expect(animations.length).toBeGreaterThan(0);
    expect(guarded.length).toBe(animations.length);
  });

  it("animates the wax glow with opacity and transform only", () => {
    const body = motion.find((b) => b.includes(".sealBox::before")) ?? "";
    expect(body).toMatch(/animation:\s*waxGlow\b/);
    const frames = css.match(/@keyframes waxGlow \{[\s\S]*?\n\}/)?.[0] ?? "";
    const props = [...frames.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    expect(props.filter((p) => p !== "from" && p !== "to")).toEqual([
      "opacity",
      "transform",
      "opacity",
      "transform",
    ]);
  });

  it("settles the ghost with opacity only", () => {
    const frames =
      css.match(/@keyframes ghostSettleFade \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(frames).toMatch(/opacity: 0\.4/);
    expect(frames).not.toMatch(/transform/);
  });

  it("applies the ghost settle to the place around the Ghost, not the pit", () => {
    const body = motion.join("\n");
    expect(body).toMatch(/\[data-ghost-pit\]\)\s*>\s*div\s*\{/);
    expect(body).not.toMatch(/\[data-ghost-pit\]\s*\{/);
  });

  it("leaves the seal box and its glow at rest without motion", () => {
    const rest = ruleBody(".sealBox::before");
    expect(rest).toMatch(/opacity:\s*0\.6;/);
    expect(rest).not.toMatch(/animation/);
    expect(rest).not.toMatch(/transform/);
  });

  it("keeps the glow inside the seal box", () => {
    const rest = ruleBody(".sealBox::before");
    expect(rest).toMatch(/inset:\s*0;/);
    expect(rest).toMatch(/pointer-events:\s*none;/);
    expect(ruleBody(".sealBox")).toMatch(/position:\s*relative;/);
  });
});
