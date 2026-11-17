// Feature: issue #476, R1 to R3 (the letter Stage column, the paper creases
// and the two Stage buttons).
//
// A source test over the stylesheets and the Reveal markup. It reads the CSS
// as text, with comments removed, so a prose comment can never satisfy a rule.
//
// - R1: at 900 px and wider the letter Stage centres a sheet of at most 680 px.
// - R2: each crease is two side segments at 1/3 and 2/3 of the paper height.
// - R3: stage2Next takes the shared primary button, and showAll the outline
//   button. Neither uses the old `styles.button` class.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CREASE_POSITIONS } from "../constants";

const HERE = __dirname;
const CEREMONY_DIR = join(HERE, "..");
const REVEAL_DIR = join(CEREMONY_DIR, "..", "reveal");
const UI_DIR = join(CEREMONY_DIR, "..", "ui");

function read(path: string): string {
  return readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
}

/** The declaration block of the first rule whose selector is exactly `selector`. */
function blockOf(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|[\\s},])${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (match === null) throw new Error(`no rule for ${selector}`);
  return match[1] ?? "";
}

/** The body of the first `@media (min-width: 900px)` block that contains `selector`. */
function wideBlockOf(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `@media \\(min-width:\\s*900px\\)\\s*\\{[\\s\\S]*?${escaped}\\s*\\{([^}]*)\\}`,
  ).exec(css);
  if (match === null) throw new Error(`no 900px rule for ${selector}`);
  return match[1] ?? "";
}

const ceremonyCss = read(join(CEREMONY_DIR, "ceremony.module.css"));
const letterCss = read(join(HERE, "LetterBlock.module.css"));
const revealCss = read(join(REVEAL_DIR, "reveal.module.css"));
const buttonsCss = read(join(UI_DIR, "buttons.module.css"));
const revealTsx = readFileSync(join(REVEAL_DIR, "Reveal.tsx"), "utf8");
const letterTsx = readFileSync(join(HERE, "LetterBlock.tsx"), "utf8");

describe("R1: the letter Stage centres the column at 900 px and wider", () => {
  it("makes the letter Stage a one-track grid with its children centred", () => {
    const stage = wideBlockOf(ceremonyCss, "[data-letter-stage]");
    expect(stage).toMatch(/display:\s*grid/);
    expect(stage).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(stage).toMatch(/justify-items:\s*center/);
  });

  it("caps the paper sheet at 680 px and centres it with auto inline margins", () => {
    const sheet = wideBlockOf(letterCss, ".sheet");
    expect(sheet).toMatch(/width:\s*min\(680px,\s*100%\)/);
    expect(sheet).toMatch(/margin-inline:\s*auto/);
  });

  it("keeps the phone layout below 900 px: the sheet has no width rule outside the 900 px block", () => {
    expect(blockOf(letterCss, ".sheet")).not.toMatch(/width:/);
  });
});

describe("R2: each crease is two side segments at 1/3 and 2/3 of the paper height", () => {
  it("places the two creases at one third and two thirds of the paper", () => {
    expect([...CREASE_POSITIONS]).toEqual([1 / 3, 2 / 3]);
    expect(letterTsx).toMatch(/CREASE_POSITIONS\.flatMap/);
    expect(letterTsx).toMatch(/style=\{\{ top: creaseTop\(share\) \}\}/);
  });

  it("draws the left and right segments in the side padding, with no fill", () => {
    expect(blockOf(letterCss, ".crease")).not.toMatch(/background|(?<![-\w])top:/);
    expect(blockOf(letterCss, '.crease[data-crease="left"]')).toMatch(
      /left:\s*0;[\s\S]*width:\s*var\(--letter-pad-x\)/,
    );
    expect(blockOf(letterCss, '.crease[data-crease="right"]')).toMatch(
      /right:\s*0;[\s\S]*width:\s*var\(--letter-pad-x\)/,
    );
  });
});

describe("R3: the two Stage buttons", () => {
  it("imports the shared primary button into Reveal", () => {
    expect(revealTsx).toMatch(
      /import buttons from "@\/components\/ui\/buttons\.module\.css";/,
    );
  });

  it("gives stage2Next the primary button and showAll the outline button", () => {
    const next = /<button[^>]*className=\{buttons\.primary\}[^>]*>\s*\{REVEAL_COPY\.stage2Next\}/;
    const showAll = /<button[^>]*className=\{styles\.outlineButton\}[^>]*>\s*\{REVEAL_COPY\.showAll\}/;
    expect(revealTsx).toMatch(next);
    expect(revealTsx).toMatch(showAll);
    expect(revealTsx).not.toMatch(/styles\.button\b/);
  });

  it("styles the primary button orange with a dark label and a 44 px target", () => {
    const primary = blockOf(buttonsCss, ".primary");
    expect(primary).toMatch(/background-color:\s*var\(--accent\)/);
    expect(primary).toMatch(/color:\s*var\(--on-accent\)/);
    expect(primary).toMatch(/min-height:\s*44px/);
  });

  it("styles the outline button plain, with a white label, a visible border and a 44 px target", () => {
    const outline = blockOf(revealCss, ".outlineButton");
    expect(outline).toMatch(/background-color:\s*transparent/);
    expect(outline).toMatch(/color:\s*#ffffff/);
    expect(outline).toMatch(/border:\s*1px solid #8f86ad/);
    expect(outline).toMatch(/min-height:\s*44px/);
    expect(outline).not.toMatch(/var\(--accent\)/);
  });
});
