// Feature: 08-judge-polish, task 3 (issue #190): source scan for the recall
// number parser (spec 08 design.md, "The Recall_Number_Parser", R32).
//
// Only parse-number.ts may read what a judge typed into the recall number
// field. Any other module under src/components/ceremony that parses a number
// from text, or that mentions the removed `draftNumber` state, fails here.
//
// The scan is a lint-style heuristic over source text, not a parser. Comments
// and string or template literals are blanked first, so a doc comment that
// names the parser does not trip it. Each assertion seeds from a non-empty
// file set and checks the scanner against known-bad snippets, so it can never
// pass by scanning nothing.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const ceremonyRoot = join(here, "..");
const SELF = "recall-parser-scan.test.ts";
const PARSER_FILES: ReadonlySet<string> = new Set([
  "parse-number.ts",
  "parse-number.test.ts",
]);

/** Replace comments and string or template literals with spaces, keeping newlines. */
function blank(source: string): string {
  return source.replace(
    /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g,
    (match) => match.replace(/[^\n]/g, " "),
  );
}

/** Patterns for a second recall number parser. They apply to non-test recall source only. */
const PARSER_RULES: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "parseFloat or parseInt call", pattern: /(?<![.\w])parse(?:Float|Int)\s*\(/ },
  { name: "Number.parseFloat or Number.parseInt", pattern: /\bNumber\.parse(?:Float|Int)\b/ },
  {
    name: "a parse function that reads a number",
    pattern: /\bfunction\s+\w*[Pp]arse\w*(?:Number|Decimal|Float|Int)\w*\s*\(/,
  },
  {
    name: "Number() applied to typed or draft text",
    pattern: /\bNumber\s*\(\s*[\w.]*\b(?:text|typed|draft|input|raw)\b/,
  },
];

/** The removed draft state. It is forbidden in every file, tests included. */
const DRAFT_NUMBER = /\bdraftNumber\b/;

/** Recall source: the recall folder, or a module that imports from it. */
export function isRecallSource(path: string, source: string): boolean {
  if (/(^|[\\/])recall[\\/]/.test(path)) return true;
  return /from\s+["'][^"']*\brecall\b[^"']*["']/.test(source);
}

/** Test files check the scale's own output, so the parse rules skip them. */
function isTestFile(path: string): boolean {
  return /\.test\.tsx?$/.test(path);
}

/**
 * The first forbidden form found in one source file, or null. Comments and
 * string or template literals are ignored. `path` decides which rules apply.
 */
export function forbiddenIn(source: string, path = "recall/example.ts"): string | null {
  const code = blank(source);
  if (DRAFT_NUMBER.test(code)) return "draftNumber";
  if (isTestFile(path) || !isRecallSource(path, source)) return null;
  for (const rule of PARSER_RULES) {
    if (rule.pattern.test(code)) return rule.name;
  }
  return null;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name) && entry.name !== SELF) out.push(full);
  }
  return out;
}

describe("the scanner flags what it should (self-test)", () => {
  const RECALL = "recall/scratch.ts";

  it("flags a removed draftNumber reference in any file", () => {
    expect(forbiddenIn("const draftNumber = 1;", "components/x.tsx")).toBe("draftNumber");
    expect(forbiddenIn("const draftNumber = 1;", "recall/x.test.ts")).toBe("draftNumber");
  });

  it("flags each second-parser form in recall source", () => {
    expect(forbiddenIn("const v = parseFloat(text);", RECALL)).toBe(
      "parseFloat or parseInt call",
    );
    expect(forbiddenIn("const v = Number.parseInt(text, 10);", RECALL)).toBe(
      "Number.parseFloat or Number.parseInt",
    );
    expect(forbiddenIn("function parseTypedNumber(s: string) { return s; }", RECALL)).toBe(
      "a parse function that reads a number",
    );
    expect(forbiddenIn("const v = Number(draft.text);", RECALL)).toBe(
      "Number() applied to typed or draft text",
    );
  });

  it("calling the parser is allowed, only defining another one is not", () => {
    expect(forbiddenIn("const v = parseRecallNumber(text);", RECALL)).toBeNull();
  });

  it("applies the parse rules to recall paths, relative or absolute", () => {
    expect(forbiddenIn("const v = parseFloat(text);", "recall/x.ts")).not.toBeNull();
    expect(forbiddenIn("const v = parseFloat(text);", "/abs/src/components/ceremony/recall/x.ts")).not.toBeNull();
  });

  it("parse rules skip non-recall and test files", () => {
    expect(forbiddenIn("const v = parseFloat(token);", "scene/tokens.ts")).toBeNull();
    expect(forbiddenIn("const v = Number(text);", "recall/x.test.ts")).toBeNull();
  });

  it("ignores the same words in comments and strings", () => {
    expect(forbiddenIn("// draftNumber was removed\nconst x = 1;", RECALL)).toBeNull();
    expect(forbiddenIn("/* parseFloat(text) */ const x = 1;", RECALL)).toBeNull();
    expect(forbiddenIn('const label = "parseFloat(text)";', RECALL)).toBeNull();
    expect(forbiddenIn("const t = `Number(draftText)`;", RECALL)).toBeNull();
  });

  it("passes ordinary code that is not a parser", () => {
    expect(forbiddenIn("const n = Math.round(x * 100) / 100;", RECALL)).toBeNull();
    expect(forbiddenIn("const s = formatParsedValue(value);", RECALL)).toBeNull();
  });
});

describe("recall number parsing lives only in parse-number.ts (R32)", () => {
  const files = sourceFiles(ceremonyRoot);
  const names = files.map((file) => relative(ceremonyRoot, file));

  it("scans a non-empty set of ceremony sources, including the parser itself", () => {
    expect(files.length).toBeGreaterThan(50);
    expect(names).toContain(join("recall", "parse-number.ts"));
    expect(names).toContain(join("recall", "RecallPager.tsx"));
  });

  it("no ceremony source outside parse-number.ts parses a recall number", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const name = relative(ceremonyRoot, file);
      if (PARSER_FILES.has(name.split(/[\\/]/).pop() ?? "")) continue;
      const hit = forbiddenIn(readFileSync(file, "utf8"), name);
      if (hit !== null) offenders.push(`${name}: ${hit}`);
    }
    expect(offenders).toEqual([]);
  });

  it("the parser module itself is present and is the only home of the parser", () => {
    const parser = readFileSync(join(ceremonyRoot, "recall", "parse-number.ts"), "utf8");
    expect(parser).toMatch(/export function parseRecallNumber\b/);
  });
});
