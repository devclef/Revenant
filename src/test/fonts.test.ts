import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Text guards on the font setup. Fonts come from next/font/local in
// src/app/layout.tsx; globals.css only consumes the variables it sets.
const css = readFileSync(
  fileURLToPath(new URL("../app/globals.css", import.meta.url)),
  "utf8",
);
const layout = readFileSync(
  fileURLToPath(new URL("../app/layout.tsx", import.meta.url)),
  "utf8",
);

describe("font setup", () => {
  it("globals.css does not declare the --font-serif or --font-sans variables", () => {
    // Declarations only: `var(--font-sans)` uses are expected and allowed.
    expect(css).not.toMatch(/--font-serif\s*:/);
    expect(css).not.toMatch(/--font-sans\s*:/);
  });

  it("layout.tsx does not name a font const `serif` or `sans`", () => {
    expect(layout).not.toMatch(/\bconst\s+(serif|sans)\b/);
  });

  it("every localFont call in layout.tsx declares a fallback", () => {
    const calls = [...layout.matchAll(/localFont\(\s*\{([\s\S]*?)\}\s*\)/g)];
    expect(calls.length).toBeGreaterThan(0);
    for (const [, body] of calls) {
      expect(body).toMatch(/\bfallback\s*:/);
    }
  });
});
