// Feature: 07-judge-journey
//
// Motion gating for the landing Ghost (R9.4 to R9.7). The rise and the
// Idle_Bob run only in full motion: under prefers-reduced-motion, or when the
// page's motion mode is Calm, the Ghost stands risen from the first frame.
// The no-JS noscript rule stops both animations.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { LANDING_NOSCRIPT_STYLE } from "@/lib/landing-backdrop";

const ROOT = join(__dirname, "..", "..");
const SCENE_CSS = readFileSync(
  join(ROOT, "src/components/ceremony/scene/scene.module.css"),
  "utf8",
);
const SCENE_SHELL = readFileSync(
  join(ROOT, "src/components/ceremony/scene/SceneShell.tsx"),
  "utf8",
);

/**
 * True when the first occurrence of `selector` in the CSS sits inside the
 * nearest preceding @media block whose query is `query`.
 */
function selectorGatedBy(selector: string, query: string): boolean {
  const at = SCENE_CSS.indexOf(selector);
  if (at < 0) return false;
  const mediaAt = SCENE_CSS.lastIndexOf("@media", at);
  if (mediaAt < 0) return false;
  const header = SCENE_CSS.slice(mediaAt, SCENE_CSS.indexOf("{", mediaAt));
  return header.includes(query);
}

describe("noscript rule (R9.7)", () => {
  it("names the rise and the bob, so both stop with scripts disabled", () => {
    expect(LANDING_NOSCRIPT_STYLE).toContain("[data-ghost-rise]");
    expect(LANDING_NOSCRIPT_STYLE).toContain("[data-ghost-bob]");
    expect(LANDING_NOSCRIPT_STYLE).toBe(
      "[data-ghost-rise],[data-ghost-bob]{animation:none}",
    );
  });

  it("drops the dead [data-scene-light] selector", () => {
    expect(LANDING_NOSCRIPT_STYLE).not.toContain("data-scene-light");
  });
});

describe("rise and Idle_Bob gating (R9.4 to R9.6)", () => {
  it("runs the rise only under reduced-motion no-preference", () => {
    expect(
      selectorGatedBy(
        '[data-ceremony-motion="full"] .ghost {',
        "prefers-reduced-motion: no-preference",
      ),
    ).toBe(true);
    expect(SCENE_CSS).toMatch(
      /\[data-ceremony-motion="full"\] \.ghost \{\s*animation: rise /,
    );
  });

  it("runs the Idle_Bob only under full motion, not under Calm", () => {
    expect(SCENE_CSS).toMatch(
      /\[data-ceremony-motion="full"\] \.bob \{\s*animation: bob /,
    );
    expect(
      selectorGatedBy(
        '[data-ceremony-motion="full"] .bob {',
        "prefers-reduced-motion: no-preference",
      ),
    ).toBe(true);
  });

  it("keeps the risen end pose as the base style, so reduced motion shows it", () => {
    expect(SCENE_CSS).toMatch(/\.ghost \{[^}]*transform: translateY\(var\(--ghost-risen\)\)/);
  });

  it("maps Calm to data-ceremony-motion=calm, which matches no rise or bob rule", () => {
    expect(SCENE_SHELL).toContain(
      'mode === "calm" ? "calm" : "full"',
    );
    // Only the "full" selector carries the rise and the bob, so a calm root
    // matches neither and the Ghost stays risen.
    expect(SCENE_CSS).not.toMatch(/\[data-ceremony-motion="calm"\] \.ghost \{\s*animation/);
  });
});
