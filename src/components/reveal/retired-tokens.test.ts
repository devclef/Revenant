// Feature: 09-demo-polish, L6 to L9 (Retired_Tokens, ParchmentSurface and the serif
// font outside the Letter_Text module)
//
// Reads the reveal stylesheet, the StagePanel component and the paper panel
// stylesheet, and fails if any retired name appears in them. Comments count:
// a retired name in a comment is still a retired name in the file.
//
// The serif font (--font-serif) is allowed only in the `.letter` rule of
// reveal.module.css, which is the Letter_Text. Everywhere else it fails.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");

const RETIRED_TOKENS = /--ink-faded|--desk-ink|--seal(?![A-Za-z0-9_-])|--gold-text/;
const RETIRED_COMPONENT = /ParchmentSurface/;
const SERIF_FONT = /--font-serif|font-serif/;

/** The `.letter` rule in reveal.module.css, the only place the serif may appear. */
const LETTER_RULE = /\.letter\s*\{[^}]*\}/;

function read(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

describe("retired tokens are gone from the reveal and paper files", () => {
  const revealCss = read("src/components/reveal/reveal.module.css");
  const stagePanel = read("src/components/reveal/StagePanel.tsx");
  const paperCss = read("src/components/ui/paper.module.css");

  it("reveal.module.css defines or uses no retired colour token", () => {
    const match = revealCss.match(RETIRED_TOKENS);
    expect(match?.[0] ?? null, `reveal.module.css contains ${match?.[0]}`).toBeNull();
  });

  it("StagePanel.tsx names no retired colour token", () => {
    const match = stagePanel.match(RETIRED_TOKENS);
    expect(match?.[0] ?? null, `StagePanel.tsx contains ${match?.[0]}`).toBeNull();
  });

  it("paper.module.css names no retired colour token", () => {
    const match = paperCss.match(RETIRED_TOKENS);
    expect(match?.[0] ?? null, `paper.module.css contains ${match?.[0]}`).toBeNull();
  });

  it("no retired component name appears in the three files", () => {
    for (const [name, source] of [
      ["reveal.module.css", revealCss],
      ["StagePanel.tsx", stagePanel],
      ["paper.module.css", paperCss],
    ] as const) {
      const match = source.match(RETIRED_COMPONENT);
      expect(match?.[0] ?? null, `${name} contains ${match?.[0]}`).toBeNull();
    }
  });

  it("the serif font appears only in the Letter_Text (.letter) rule", () => {
    const letter = revealCss.match(LETTER_RULE);
    expect(letter, "reveal.module.css has a .letter rule").not.toBeNull();
    expect(letter?.[0]).toMatch(SERIF_FONT);

    const outsideLetter = revealCss.replace(LETTER_RULE, "");
    const match = outsideLetter.match(SERIF_FONT);
    expect(match?.[0] ?? null, `reveal.module.css uses ${match?.[0]} outside .letter`).toBeNull();

    for (const [name, source] of [
      ["StagePanel.tsx", stagePanel],
      ["paper.module.css", paperCss],
    ] as const) {
      const serif = source.match(SERIF_FONT);
      expect(serif?.[0] ?? null, `${name} uses ${serif?.[0]}`).toBeNull();
    }
  });
});
