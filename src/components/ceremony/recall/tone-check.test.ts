import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Tone check for the Testify copy (spec 11 task 11.4, tone.md and neutrality.md).
 *
 * Reads the user-facing text of the copy and recall files and fails when it
 * contains an exclamation mark or a word that grades testimony. Only string
 * literals and JSX text are checked. Code, identifiers and comments are not.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../../..");

const FILES = [
  "src/components/reveal/copy.ts",
  "src/components/ceremony/copy.ts",
  "src/components/ceremony/recall/RecallPager.tsx",
  "src/components/ceremony/recall/TextAnswerField.tsx",
  "src/components/reveal/RecallStep.tsx",
  "src/components/ceremony/intro/TestifyContext.tsx",
];

const GRADING_WORDS = [
  "wrong",
  "right",
  "close",
  "near",
  "off",
  "accurate",
  "caught",
  "misremembered",
  "cross-examine",
];

/**
 * Removes comments and returns the text of every string literal, plus the
 * text between JSX tags. Quote and comment state is tracked character by
 * character so that `//` inside a URL string is not taken for a comment.
 */
export function userFacingText(source: string): string[] {
  const out: string[] = [];
  const stripped: string[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i]!;
    const next = source[i + 1];
    if (ch === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      stripped.push("\n");
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      i = end === -1 ? source.length : end + 2;
      stripped.push(" ");
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      let text = "";
      while (j < source.length && source[j] !== ch) {
        if (source[j] === "\\" && j + 1 < source.length) {
          text += source[j + 1];
          j += 2;
          continue;
        }
        text += source[j];
        j++;
      }
      out.push(text);
      stripped.push(`${ch}${ch}`);
      i = j + 1;
      continue;
    }
    stripped.push(ch);
    i++;
  }
  // JSX text: a run between `>` and `<` that holds letters and no code markers.
  const code = stripped.join("");
  for (const match of code.matchAll(/>([^<>{}();=]+)</g)) {
    const text = match[1]!;
    if (/[A-Za-z]/.test(text)) out.push(text);
  }
  return out;
}

/**
 * Exact string literals that are HTML attribute values, not copy. The one entry
 * is `autoComplete="off"` in RecallPager.tsx, which the browser needs. They are
 * exempt from the grading-word check only. The "!" check still applies to them.
 * Control and state copy is not listed here: it is reworded so "off" never
 * appears in it.
 */
const HTML_ATTRIBUTE_VALUES = new Set(["off"]);

export function findViolations(source: string): string[] {
  const found: string[] = [];
  for (const text of userFacingText(source)) {
    if (text.includes("!")) found.push(`"!" in: ${text}`);
    if (HTML_ATTRIBUTE_VALUES.has(text)) continue;
    for (const word of GRADING_WORDS) {
      const pattern = new RegExp(`(^|[^A-Za-z-])${word}($|[^A-Za-z-])`, "i");
      if (pattern.test(text)) found.push(`"${word}" in: ${text}`);
    }
  }
  return found;
}

describe("Testify tone scanner", () => {
  it("flags an exclamation mark and a grading word in a string", () => {
    const source = 'const a = "Well done!";\nconst b = "You were wrong";';
    const found = findViolations(source);
    expect(found).toHaveLength(2);
  });

  it("ignores code, identifiers and comments", () => {
    const source =
      "// this is wrong!\n/* not right */\nconst close = 1; if (!x) {}";
    expect(findViolations(source)).toEqual([]);
  });

  it("keeps // inside a string literal and still reads the text", () => {
    const source =
      'const u = "https://example.test/a"; const w = "Caught out";';
    expect(findViolations(source)).toHaveLength(1);
  });
});

describe("Testify copy tone check", () => {
  it.each(FILES)("%s has no exclamation mark or grading word", (file) => {
    const source = readFileSync(resolve(root, file), "utf8");
    expect(findViolations(source)).toEqual([]);
  });
});
