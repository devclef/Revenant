// LiveEntry heading typography: the heading is a sans headline, not the serif.
// The serif is for the letter text only (tone.md). This reads the stylesheet
// rule directly, so a change to the font falls back to the serif and fails.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "LiveEntry.module.css"), "utf8");

/** The declarations of the first rule whose selector is exactly `.name`. */
function ruleBody(name: string): string {
  const match = new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`).exec(css);
  if (match === null) throw new Error(`no .${name} rule in LiveEntry.module.css`);
  return match[1] ?? "";
}

describe("LiveEntry heading", () => {
  it("uses the sans font for the heading", () => {
    expect(ruleBody("heading")).toMatch(/font-family:\s*var\(--font-sans\)/);
  });

  it("does not use the serif for the heading", () => {
    expect(ruleBody("heading")).not.toMatch(/--font-serif/);
  });

  it("keeps the heading weight", () => {
    expect(ruleBody("heading")).toMatch(/font-weight:\s*600/);
  });
});
