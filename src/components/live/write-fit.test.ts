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
    // The field grows with its text, so the 44 px is a minimum, not a height.
    const field = ruleBody(css, ".questionRow .textarea");
    expect(field).toMatch(/min-height:\s*44px/);
    expect(field).not.toMatch(/(?:^|;)\s*height:\s*44px/);
  });

  it("keeps the label and the Remove control on one line", () => {
    const nowrap = ruleBody(
      block,
      ".questionRow .label,\n  .questionRow .removeControl",
    );
    expect(nowrap).toMatch(/white-space:\s*nowrap/);
  });

  it("keeps the Remove control at a 44 px touch target at every width", () => {
    const control = ruleBody(css, ".removeControl");
    expect(control).toMatch(/min-width:\s*44px/);
    expect(control).toMatch(/min-height:\s*44px/);
    expect(control).toMatch(/white-space:\s*nowrap/);
    // The control is never shrunk: no width-based query sets it below 44 px.
    expect(css).not.toMatch(
      /\.removeControl\s*\{[^}]*(?:width|height):\s*32px/,
    );
  });
});

describe("Write step: one Writing_Column, no two-column grid", () => {
  it("is one column at most 44 rem wide, with the paper as wide as the column", () => {
    const column = ruleBody(css, ".liveWrite");
    expect(column).toMatch(/max-width:\s*44rem;/);
    expect(column).toMatch(/box-sizing:\s*border-box;/);
  });

  it("keeps the paper within the column plus 80 px: the desktop side padding is at most 40 px", () => {
    // The panel's side padding is clamp(1.25rem, 4vw, 2.5rem), at most 40 px a side.
    expect(ruleBody(css, ".panel")).toMatch(
      /padding:\s*clamp\(1\.25rem, 4vw, 2\.5rem\);/,
    );
  });

  it("puts the Letter_Field before the question rows and the receipts in the form", () => {
    const field = writeForm.indexOf('id="live-letter"');
    const questions = writeForm.indexOf("<AuthorQuestions");
    const receipts = writeForm.indexOf("<ReceiptsDisclosure");
    expect(field).toBeGreaterThan(0);
    expect(field).toBeLessThan(questions);
    expect(field).toBeLessThan(receipts);
  });

  it("keeps the letter field inside its column", () => {
    const letter = ruleBody(
      readFileSync(resolve(here, "letter-field.module.css"), "utf8"),
      ".letterField",
    );
    expect(letter).toMatch(/max-width:\s*100%;/);
    expect(letter).toMatch(/box-sizing:\s*border-box;/);
  });

  it("has no two-column grid rule for the occasion control", () => {
    expect(css).not.toContain(".liveWrite:has(> .occasions)");
    expect(ruleBody(css, ".liveWrite")).not.toMatch(/grid-template-columns/);
  });

  it("applies the Writing_Column only through the demo liveWrite class", () => {
    expect(writeForm).toMatch(
      /mode === "demo"\s*\?\s*`\$\{styles\.panel\} \$\{styles\.liveWrite\}`\s*:\s*styles\.panel/,
    );
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

  it("keeps the Writing_Column one stack at every width, with no 900 px two-column query", () => {
    expect(css).not.toContain("@media (min-width: 900px) and (max-height: 900px)");
  });
});
