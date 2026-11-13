// Feature: 09 Letter_Field (W1). Reads letter-field.module.css and checks the
// line bands, the min-height formula and the padding and colour declarations.
// Pure file read, no DOM.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "letter-field.module.css"), "utf8");

/** The body of the first `.letterField { ... }` rule in the file. */
function baseRule(): string {
  const m = /\.letterField\s*\{([^}]*)\}/.exec(css);
  return m ? m[1] : "";
}

/** The inner text of the @media block whose condition is `query`. */
function mediaBody(query: string): string {
  const start = css.indexOf(`@media (${query})`);
  if (start < 0) return "";
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return "";
}

function letterLines(body: string): string | undefined {
  return /--letter-lines\s*:\s*([^;]+);/.exec(body)?.[1].trim();
}

describe("letter-field.module.css line bands", () => {
  it("shows 6 lines below 600px", () => {
    expect(letterLines(mediaBody("max-width: 599.98px"))).toBe("6");
  });

  it("shows 8 lines from 600px to 1023px", () => {
    expect(
      letterLines(mediaBody("min-width: 600px) and (max-width: 1023.98px")),
    ).toBe("8");
  });

  it("shows 10 lines from 1024px upward", () => {
    expect(letterLines(mediaBody("min-width: 1024px"))).toBe("10");
  });

  it("sets a default of 10 lines on the field itself", () => {
    expect(letterLines(baseRule())).toBe("10");
  });
});

describe("letter-field.module.css min-height", () => {
  it("uses the em-based fallback formula on the base rule", () => {
    expect(baseRule()).toMatch(
      /min-height\s*:\s*calc\(\s*var\(--letter-lines\)\s*\*\s*1em\s*\*\s*1\.6\s*\+\s*2rem\s*\+\s*2px\s*\)/,
    );
  });

  it("uses the 1lh formula under @supports (height: 1lh)", () => {
    const start = css.indexOf("@supports (height: 1lh)");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(css.slice(start)).toMatch(
      /\.letterField\s*\{[^}]*min-height\s*:\s*calc\(\s*var\(--letter-lines\)\s*\*\s*1lh\s*\+\s*2rem\s*\+\s*2px\s*\)/,
    );
  });
});

describe("letter-field.module.css padding, font and colour", () => {
  const body = baseRule();

  it("uses the serif font and a 1.6 line height", () => {
    expect(body).toMatch(/font-family\s*:\s*var\(--font-serif\)\s*;/);
    expect(body).toMatch(/line-height\s*:\s*1\.6\s*;/);
  });

  it("pads the field by 1rem", () => {
    expect(body).toMatch(/padding\s*:\s*1rem\s*;/);
  });

  it("uses the paper background and the ink colour", () => {
    expect(body).toMatch(/background-color\s*:\s*var\(--paper\)\s*;/);
    expect(body).toMatch(/color\s*:\s*var\(--ink\)\s*;/);
  });

  it("scrolls inside itself past its cap", () => {
    expect(body).toMatch(/overflow-y\s*:\s*auto\s*;/);
  });
});
