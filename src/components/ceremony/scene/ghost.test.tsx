// Feature: 07-judge-journey, R5.1 to R5.3, R5.9, R5.15, R9.5 to R9.7, R9.14, R5.10 to R5.14

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LocalViewProvider } from "../local-view";
import { MotionProvider } from "../motion";
import { SkipProvider } from "../skip";
import { Ghost } from "./Ghost";
import { findRise } from "./useEmergence";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "scene.module.css"), "utf8");

const renderGhost = () =>
  renderToStaticMarkup(
    createElement(
      MotionProvider,
      null,
      createElement(
        SkipProvider,
        null,
        createElement(LocalViewProvider, null, createElement(Ghost)),
      ),
    ),
  );

describe("Ghost markup", () => {
  it("renders one svg that is aria-hidden, not focusable, untitled and marked as the Ghost_Box", () => {
    const html = renderGhost();
    const svg = html.match(/<svg[^>]*>/)?.[0] ?? "";
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('focusable="false"');
    expect(svg).toContain("data-ghost-box");
    expect(svg).toContain('viewBox="0 0 200 240"');
    expect(html).not.toContain("<title");
  });

  it("has no hood, hands, arms or mouth", () => {
    const html = renderGhost();
    expect(html).not.toMatch(/hood|hand|arm|mouth/i);
  });

  it("draws the two eyes in one group that starts at the centre", () => {
    const html = renderGhost();
    expect(html.match(/<ellipse/g)?.length).toBe(2);
    expect(html).toContain("translate(0px, 0px)");
  });
});

describe("Ghost box size (CSS)", () => {
  it("uses GHOST_WIDE at or above 900 px and GHOST_NARROW below, at 1.2 height ratio", () => {
    expect(css).toMatch(/--ghost-w:\s*min\(50vh,\s*560px\)/);
    expect(css).toMatch(/@media \(max-width: 899\.98px\)[\s\S]*?--ghost-w:\s*min\(26vh,\s*170px\)/);
    // Height is 1.2 times the width: aspect 5 : 6.
    expect(css).toMatch(/aspect-ratio:\s*5 \/ 6/);
  });
});

describe("Emergence and Idle_Bob (CSS gates)", () => {
  it("gates every animation on no-preference and the full motion mode", () => {
    const gate = css.match(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*$/)?.[0] ?? "";
    expect(gate).not.toBe("");
    for (const selector of [".pit", ".soilStrip", ".ghost", ".bob"]) {
      expect(gate).toContain(`[data-ceremony-motion="full"] ${selector}`);
    }
  });

  it("runs the shake once for 500 ms, 2 px", () => {
    expect(css).toMatch(/shake 500ms linear 750ms 1/);
    expect(css).toMatch(/translateX\(calc\(-50% - 2px\)\)/);
    expect(css).toMatch(/translateX\(-2px\)/);
  });

  it("runs the rise for 1500 ms after 900 ms with the constant easing", () => {
    expect(css).toMatch(/rise 1500ms cubic-bezier\(0\.16, 0\.84, 0\.3, 1\) 900ms backwards/);
  });

  it("runs the bob at 3 px over 3600 ms, starting when the rise ends", () => {
    expect(css).toMatch(/bob 3600ms ease-in-out calc\(900ms \+ 1500ms\) infinite/);
    expect(css).toMatch(/translateY\(-3px\)/);
  });

  it("animates transform only", () => {
    // The rise and the bob animate transform only (R5.12). The break exit
    // (ghostLeave, ghostFade) is the one place opacity animates (R12.6), so it is
    // checked on its own below.
    const keyframeBodies = (css.match(/@keyframes [\s\S]*?\n\}\n/g) ?? []).filter(
      (body) => !body.startsWith("@keyframes ghost"),
    );
    expect(keyframeBodies.length).toBeGreaterThan(0);
    for (const body of keyframeBodies) {
      const properties = [...body.matchAll(/([a-z-]+):/g)].map((m) => m[1]);
      for (const property of properties) {
        expect(["transform"]).toContain(property);
      }
    }
  });

  it("animates the break exit with transform and opacity only", () => {
    const exit = (css.match(/@keyframes ghost[\s\S]*?\n\}\n/g) ?? []).join("\n");
    expect(exit).toContain("@keyframes ghostLeave");
    expect(exit).toContain("@keyframes ghostFade");
    const properties = [...exit.matchAll(/([a-z-]+):/g)].map((m) => m[1]);
    for (const property of properties) {
      expect(["transform", "opacity"]).toContain(property);
    }
  });

  it("keeps the end pose as the base style, so reduced motion and Calm show it at once", () => {
    expect(css).toMatch(/\.ghost \{[^}]*transform:\s*translateY\(var\(--ghost-risen\)\)/);
  });
});

describe("findRise", () => {
  it("finds an unfinished rise and ignores finished or other animations", () => {
    const rise = { playState: "running", animationName: "rise" } as unknown as Animation;
    const done = { playState: "finished", animationName: "rise" } as unknown as Animation;
    const other = { playState: "running", animationName: "bob" } as unknown as Animation;
    expect(findRise([other, done, rise])).toBe(rise);
    expect(findRise([done, other])).toBeUndefined();
    expect(findRise([])).toBeUndefined();
  });
});
