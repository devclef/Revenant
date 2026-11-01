// CSS-level guard for the DemoLabel badge colour.
//
// The "Demo" label sits on the near-black desk of the persona pages, so its
// text must use a desk token (cream --desk-ink), not a dim grey. This test
// reads the stylesheet source and pins the `color` and `border-color` of the
// `.badge` rule, so the colour cannot drift back to grey without failing CI.
// A plain grey text colour such as `--ink-soft` on its own, or a raw hex
// value, fails.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "DemoLabel.module.css"), "utf8");

/** Returns the declaration value for `prop` inside the `.badge` rule. */
function declarationOf(prop: string): string {
  const rule = /\.badge\s*\{([^}]*)\}/.exec(css);
  if (rule === null) {
    throw new Error("DemoLabel.module.css has no .badge rule");
  }
  const decl = new RegExp(`(?:^|;|\\{|\\s)${prop}\\s*:\\s*([^;]+);`, "m").exec(
    `{${rule[1]};`,
  );
  if (decl === null) {
    throw new Error(`.badge has no ${prop} declaration`);
  }
  return decl[1].trim();
}

describe("DemoLabel.module.css badge colour", () => {
  it("sets the text colour to the desk cream token", () => {
    expect(declarationOf("color")).toBe("var(--desk-ink, var(--ink-soft))");
  });

  it("uses the desk gold token for the outline", () => {
    expect(declarationOf("border")).toContain("var(--desk-gold, var(--gold-leaf))");
  });

  it("never sets the text colour to a raw hex or grey value", () => {
    expect(declarationOf("color")).not.toMatch(/#|rgb|hsl/i);
  });
});
