import { describe, expect, it } from "vitest";

import { lineOf, readSourceFiles } from "./source-scan";

/**
 * Palette guard (spec 09, L3.2; design.md "L. Letters and type", Palette and
 * Guards). After task 19 the Retired_Tokens are gone from the codebase: no
 * CSS, TS or TSX file under `src/` defines or references
 *
 *   --seal (the retired colour, not the real --seal-* animation tokens),
 *   --gold-text, --gold-leaf, --ink-faded, any --desk-* token,
 *
 * and nothing imports or names the retired ParchmentSurface component.
 *
 * Comments count: a retired name in a comment is still a retired name in the
 * file. Test files are excluded (they assert on these names), via
 * readSourceFiles, which skips `src/test/` and fixtures.
 *
 * `--seal(?![\w-])` is word-bounded so the live seal tokens --seal-hit-min,
 * --seal-split-ms, --seal-settle-ms, --seal-wax and --seal-rim do not match.
 */

interface RetiredName {
  name: string;
  pattern: RegExp;
}

const RETIRED_NAMES: readonly RetiredName[] = [
  { name: "--seal (retired colour token)", pattern: /--seal(?![\w-])/ },
  { name: "--gold-text", pattern: /--gold-text\b/ },
  { name: "--gold-leaf", pattern: /--gold-leaf\b/ },
  { name: "--ink-faded", pattern: /--ink-faded\b/ },
  { name: "a --desk-* token", pattern: /--desk-[a-z-]+/ },
  { name: "ParchmentSurface", pattern: /ParchmentSurface/ },
];

const files = readSourceFiles(["src"], [".css", ".ts", ".tsx"]);

describe("retired tokens are gone from the whole src tree", () => {
  it("reads at least one source file (the scan is wired up)", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const { name, pattern } of RETIRED_NAMES) {
    it(`no source file defines or references ${name}`, () => {
      const hits: string[] = [];
      for (const file of files) {
        const match = pattern.exec(file.text);
        if (match) hits.push(`${file.path}:${lineOf(file.text, match.index)}`);
      }
      expect(hits, `${name} appears in: ${hits.join(", ")}`).toEqual([]);
    });
  }
});
