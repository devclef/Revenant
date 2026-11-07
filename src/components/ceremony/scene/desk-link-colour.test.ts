// Desk links use the desk text colour, not the wax-seal red of the global link
// rule. Paper surfaces keep their own link colour (the rule excludes them).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "scene.module.css"), "utf8");

describe("desk link colour", () => {
  it("sets desk links to the desk text token", () => {
    expect(css).toMatch(
      /\.scene a:not\(:where\(\[data-paper\] \*\)\) \{\s*color: var\(--text\);/,
    );
  });

  it("sets the wordmark link to the desk text token", () => {
    expect(css).toMatch(/\.wordmarkLink \{\s*color: var\(--text\);/);
  });
});
