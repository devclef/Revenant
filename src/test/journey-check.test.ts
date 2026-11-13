import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Regression guard for tools/qa/journey-check.mjs (issue #401). The persona
 * page now opens straight on the recall Stage (spec 10 C1), so the journey
 * check's persona steps must wait for `recall` and must not look for the
 * removed intact Stage or the removed "Pick up the letter" button.
 */

const source = readFileSync(resolve(__dirname, "../../tools/qa/journey-check.mjs"), "utf8");

/** Returns the source of a top-level `async function name(...) { ... }`, with comments removed. */
function functionBody(name: string): string {
  const start = source.indexOf(`async function ${name}(`);
  if (start < 0) throw new Error(`function ${name} not found in journey-check.mjs`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source
          .slice(start, i + 1)
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/(^|[^:])\/\/.*$/gm, "$1");
      }
    }
  }
  throw new Error(`function ${name} has no closing brace`);
}

describe("journey-check persona steps", () => {
  it("waitForFirstStage waits for the recall Stage", () => {
    const body = functionBody("waitForFirstStage");
    expect(body).toContain('"recall"');
    expect(body).not.toMatch(/intact/i);
    expect(body).not.toMatch(/Pick up the letter/);
  });

  it("personaReveal starts at the recall Stage", () => {
    const body = functionBody("personaReveal");
    expect(body).toContain("waitForFirstStage");
    expect(body).toContain('atStage("recall")');
    expect(body).not.toMatch(/intact/i);
    expect(body).not.toMatch(/Pick up the letter/);
  });

  it("the file no longer refers to the intact Stage outside comments", () => {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).not.toMatch(/data-ceremony=intact|"intact"|'intact'/);
    expect(code).not.toMatch(/Pick up the letter/);
  });
});
