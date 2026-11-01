// Each reveal stage panel defines its own ink (issue #119). The panel sets
// --ink on .stagePanel itself, so stage text never relies on the desk's
// cream token being inherited.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "reveal.module.css"), "utf8");
const match = css.match(/(?:^|\n)\.stagePanel\s*\{([^}]*)\}/);

describe(".stagePanel defines its own ink", () => {
  it("has a .stagePanel rule", () => {
    expect(match).not.toBeNull();
  });

  it("sets --ink on the panel element", () => {
    expect(match?.[1]).toMatch(/--ink:\s*#[0-9a-fA-F]{6}\s*;/);
  });

  it("sets the text colour from --ink", () => {
    expect(match?.[1]).toMatch(/color:\s*var\(--ink\)/);
  });
});
