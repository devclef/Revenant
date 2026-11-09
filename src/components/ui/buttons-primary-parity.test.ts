// Feature: 10-own-questions, task 10 (issue #306): the shared primary button.
//
// `src/components/ui/buttons.module.css .primary` is lifted unchanged from
// RecallPager.module.css `.cta` (spec 10 C6.5), so the Stage's one orange
// button has a single definition. This guard keeps the two base rules in step:
// if someone edits `.cta`'s fill, radius or touch floor, `.primary` must change
// with it (or the lift is no longer "unchanged"). The `@media` override and the
// grouped `:focus-visible` on `.cta` are RecallPager's own and are not compared.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const buttonsCss = readFileSync(
  join(__dirname, "buttons.module.css"),
  "utf8",
);
const recallCss = readFileSync(
  join(__dirname, "..", "ceremony", "recall", "RecallPager.module.css"),
  "utf8",
);

/**
 * The declarations of a top-level rule for `selector`, normalised: comments
 * stripped, each `prop: value` trimmed, blank lines dropped, sorted. The exact
 * `{` boundary (`selector {`) avoids matching `.cta:disabled` for `.cta`.
 */
function declarations(css: string, selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`no rule for ${selector}`);
  return match[1]
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(";")
    .map((d) => d.trim())
    .filter((d) => d.length > 0)
    .sort();
}

describe("the shared primary button is lifted unchanged from .cta", () => {
  it("has the same base declarations in .primary as in RecallPager's .cta", () => {
    const primary = declarations(buttonsCss, ".primary");
    const cta = declarations(recallCss, ".cta");
    expect(primary).toEqual(cta);
  });

  it("keeps the orange fill with its on-accent label (tone.md: orange marks the main button)", () => {
    const primary = declarations(buttonsCss, ".primary");
    expect(primary).toContain("background-color: var(--accent)");
    expect(primary).toContain("color: var(--on-accent)");
  });

  it("matches the disabled rule too", () => {
    expect(declarations(buttonsCss, ".primary:disabled")).toEqual(
      declarations(recallCss, ".cta:disabled"),
    );
  });
});
