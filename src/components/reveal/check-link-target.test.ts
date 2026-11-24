import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The "Check this figure at the source" link (REVEAL_COPY.checkAtSource) is a
 * tap target of at least 44 x 44 px on the close Stage (issue #655,
 * Journey_Check J6 PH7). The link text is about 242 px wide, so the class only
 * has to lift the height. FormulaLine and ReceiptCard both draw the link with
 * this class.
 */

const here = dirname(fileURLToPath(import.meta.url));
const read = (file: string): string =>
  readFileSync(resolve(here, file), "utf8");
const revealCss = read("reveal.module.css").replace(/\/\*[\s\S]*?\*\//g, "");

// Top-level declaration bodies whose selector list names `selector` exactly.
// Rules inside @media blocks are skipped, so the target holds at every width.
function topLevelRuleBody(selector: string): string {
  let depth = 0;
  let start = 0;
  const bodies: string[] = [];
  let header = "";
  for (let i = 0; i < revealCss.length; i += 1) {
    const ch = revealCss[i];
    if (ch === "{") {
      if (depth === 0) {
        header = revealCss.slice(start, i);
        start = i + 1;
      }
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        if (
          !header.trim().startsWith("@") &&
          header.split(",").some((sel) => sel.trim() === selector)
        ) {
          bodies.push(revealCss.slice(start, i));
        }
        start = i + 1;
      }
    }
  }
  if (bodies.length === 0)
    throw new Error(`test setup: ${selector} rule not found`);
  return bodies.join("\n");
}

describe("the check-at-source link meets the 44 px tap target (issue #655)", () => {
  it("the .checkLink class sets a minimum height of at least 44 px outside any media query", () => {
    const rule = topLevelRuleBody(".checkLink");
    const minHeight = /min-height:\s*(\d+(?:\.\d+)?)px/.exec(rule);
    expect(minHeight).not.toBeNull();
    expect(Number(minHeight?.[1])).toBeGreaterThanOrEqual(44);
    expect(rule).toMatch(/display:\s*inline-flex/);
    expect(rule).toMatch(/align-items:\s*center/);
  });

  it("the class changes no text size or colour", () => {
    const rule = topLevelRuleBody(".checkLink");
    expect(rule).not.toMatch(/font-size|(^|[^-])color:/);
  });

  it("FormulaLine and ReceiptCard both put the class on the link", () => {
    for (const file of ["FormulaLine.tsx", "ReceiptCard.tsx"]) {
      const source = read(file);
      expect(source).toMatch(
        /<a\s+className=\{styles\.checkLink\}[\s\S]*?\{REVEAL_COPY\.checkAtSource\}/,
      );
    }
  });
});
