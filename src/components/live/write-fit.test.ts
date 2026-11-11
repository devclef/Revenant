// Spec 09, L3: the Write step fits one screen. These tests read the CSS rules
// that make it fit, so a later edit cannot quietly drop a fallback. The browser
// measurements (2560x1440, 1366x800, 1280x800, 390x844, and the 360x640 page
// height) come from `npm run layout-check`, not from these tests.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "live.module.css"), "utf8");
const writeForm = readFileSync(resolve(here, "WriteForm.tsx"), "utf8");

/** The text inside the @media block whose header starts with `query`. */
function mediaBlock(query: string): string {
  const start = css.indexOf(`@media ${query}`);
  if (start === -1) throw new Error(`no @media ${query} in live.module.css`);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`unclosed @media ${query}`);
}

/** The declarations of every rule whose selector is exactly `selector`. */
function ruleBody(scope: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|[\\s},])${escaped}\\s*\\{([^}]*)\\}`, "g");
  const bodies = [...scope.matchAll(re)].map((m) => m[1] ?? "");
  if (bodies.length === 0) throw new Error(`no rule for ${selector}`);
  return bodies.join("\n");
}

describe("Write step fallback 1: one-line question rows", () => {
  const block = mediaBlock("(max-width: 480px), (max-height: 900px)");

  it("lays a question row out as label, field and remove button on one line", () => {
    const row = ruleBody(block, ".questionRow");
    expect(row).toMatch(/display:\s*grid/);
    expect(row).toMatch(/grid-template-columns:\s*auto minmax\(0, 1fr\) auto/);
  });

  it("drops the label row so the label sits inline (questionHead is display: contents)", () => {
    expect(ruleBody(block, ".questionHead")).toMatch(/display:\s*contents/);
  });

  it("keeps each question field at the 44 px touch target", () => {
    const field = ruleBody(block, ".questionRow .textarea");
    expect(field).toMatch(/height:\s*44px/);
    expect(field).toMatch(/min-height:\s*44px/);
  });

  it("keeps the label and the remove button on one line", () => {
    const nowrap = ruleBody(
      block,
      ".questionRow .label,\n  .questionRow .questionHead .secondary",
    );
    expect(nowrap).toMatch(/white-space:\s*nowrap/);
  });
});

describe("Write step fallback 2: two columns at 900 px and wider", () => {
  const block = mediaBlock("(min-width: 900px) and (max-height: 900px)");
  const DEMO = ".liveWrite:has(> .occasions)";

  it("only applies to the live Write step, which holds the occasion control", () => {
    expect(block).toContain(`${DEMO} {`);
    expect(block).toMatch(
      /\.liveWrite:has\(> \.occasions\) \{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/,
    );
  });

  it("scopes every rule in the block to the liveWrite class, so /seal keeps one column", () => {
    const code = block.replace(/\/\*[\s\S]*?\*\//g, "");
    const selectors = [...code.matchAll(/([^{}]+)\{/g)].map(
      (m) => m[1]?.trim() ?? "",
    );
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      expect(selector.startsWith(DEMO)).toBe(true);
    }
  });

  it("does not depend on a data-seal-mode attribute, and WriteForm adds the class only in demo mode", () => {
    expect(block).not.toContain("data-seal-mode");
    // WriteForm adds styles.liveWrite to its panel only when mode is "demo".
    expect(writeForm).toMatch(
      /mode === "demo"\s*\?\s*`\$\{styles\.panel\} \$\{styles\.liveWrite\}`\s*:\s*styles\.panel/,
    );
  });

  it("places the letter under the occasion control in the left column", () => {
    expect(block).toMatch(
      /\.liveWrite:has\(> \.occasions\) > div\.field \{[^}]*grid-column:\s*1;[^}]*grid-row:\s*3;/,
    );
  });

  it("places the questions beside the left column, spanning two rows", () => {
    expect(block).toMatch(
      /\.liveWrite:has\(> \.occasions\) > fieldset\.field \{[^}]*grid-column:\s*2;[^}]*grid-row:\s*2 \/ span 2;/,
    );
  });

  it("closes the left column with Next, in the row after the letter", () => {
    const next = ruleBody(block, `${DEMO} > .actions`);
    expect(next).toMatch(/grid-column:\s*1;/);
    expect(next).toMatch(/grid-row:\s*4;/);
  });
});

describe("Write step: the closed receipts disclosure", () => {
  it("keeps the figures of a closed disclosure out of the layout", () => {
    expect(css).toMatch(
      /\.more:not\(\[open\]\) > :not\(summary\) \{\s*display:\s*none;\s*\}/,
    );
  });
});

describe("Write step: the phone page height", () => {
  const phone = mediaBlock("(max-width: 480px)");

  it("drops the panel's bottom padding, since Next is its last child", () => {
    expect(ruleBody(phone, ".panel")).toMatch(
      /padding:\s*0\.25rem 0\.875rem 0;/,
    );
  });

  it("tightens the occasion control and the legends on a phone", () => {
    expect(ruleBody(phone, ".occasions")).toMatch(/margin:\s*0 0 0\.25rem;/);
    expect(ruleBody(phone, ".legend")).toMatch(/line-height:\s*1\.3;/);
  });
});

describe("Write step: the fallbacks leave a tall desktop alone", () => {
  it("applies the one-line rows only on a phone width or a viewport 900 px or shorter", () => {
    // At 2560 by 1440 neither query matches, so the roomy rows stay.
    expect(css).toContain("@media (max-width: 480px), (max-height: 900px)");
    expect(css).not.toMatch(/@media \(max-height: 1[0-9]{3}px\)/);
  });

  it("never gives the two-column grid to a tall viewport", () => {
    expect(css).toContain("@media (min-width: 900px) and (max-height: 900px)");
  });
});
