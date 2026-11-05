// Feature: 08-judge-polish, R15.5: letter dates are written one way.
//
// There is exactly one letter-date module (`components/ui/letter-date.ts`), and
// the browser-zone time-of-day formatter in `components/live/format.ts`
// (`formatLocalTime`, times only). No other file under `src/components` may
// construct an `Intl.DateTimeFormat` or call `toLocaleDateString` or
// `toLocaleString`. (Periods live in `lib/figures/format-change.ts`, outside
// this tree, and are covered by data-dev's own scan.)
//
// The scan reads source text after blanking comments and string literals, so a
// doc comment or a copy string that merely names one of these APIs does not
// trip it.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
// src/components -> src/components
const componentsRoot = here;
const srcRoot = resolve(here, "..");

/**
 * The only files under `src/components` that may format a date or time with the
 * Intl date APIs, with the reason.
 */
const ALLOWED: ReadonlyMap<string, string> = new Map([
  ["components/ui/letter-date.ts", "the one letter-date module (R15.1, R15.5)"],
  [
    "components/live/format.ts",
    "formatLocalTime: the browser-zone time-of-day formatter, times only (R15.5)",
  ],
]);

const isTest = (name: string): boolean => /\.(test|spec)\.tsx?$/.test(name);
const isSource = (name: string): boolean => /\.tsx?$/.test(name) && !isTest(name);

function collect(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__fixtures__") continue;
      out.push(...collect(full));
    } else if (isSource(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Blank block and line comments and string/template literals, keeping other
 * text, so a doc comment or a copy string naming one of these APIs is ignored.
 */
function stripCommentsAndStrings(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length))
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/`(?:\\.|[^`\\])*`/g, "``");
}

const relPath = (file: string): string =>
  relative(srcRoot, file).split("\\").join("/");

const BANNED: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bIntl\s*\.\s*DateTimeFormat\b/, "Intl.DateTimeFormat"],
  [/\.\s*toLocaleDateString\s*\(/, "toLocaleDateString"],
  [/\.\s*toLocaleString\s*\(/, "toLocaleString"],
];

function bannedUses(code: string): string[] {
  const hits: string[] = [];
  for (const [re, label] of BANNED) {
    if (re.test(code)) hits.push(label);
  }
  return hits;
}

const files = collect(componentsRoot);

describe("letter dates are written one way (spec 08 R15.5)", () => {
  it("scans a non-empty set of source files, so the scan cannot pass vacuously", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("only the allowlisted files use Intl date APIs", () => {
    const violations: string[] = [];
    for (const file of files) {
      const rel = relPath(file);
      if (ALLOWED.has(rel)) continue;
      const uses = bannedUses(stripCommentsAndStrings(readFileSync(file, "utf8")));
      if (uses.length > 0) violations.push(`${rel}: ${uses.join(", ")}`);
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("the allowlisted files exist, so the allowlist is not stale", () => {
    for (const rel of ALLOWED.keys()) {
      expect(existsSync(join(srcRoot, rel)), rel).toBe(true);
    }
  });

  it("the letter-date module really owns a date formatter (the scan is not vacuous)", () => {
    const code = stripCommentsAndStrings(
      readFileSync(join(srcRoot, "components", "ui", "letter-date.ts"), "utf8"),
    );
    expect(bannedUses(code)).toContain("Intl.DateTimeFormat");
  });

  it("would flag a real Intl.DateTimeFormat use (the scan is not vacuous)", () => {
    const sample = `const f = new Intl.DateTimeFormat("en-GB");\nconst g = d.toLocaleDateString();`;
    expect(bannedUses(stripCommentsAndStrings(sample))).toEqual([
      "Intl.DateTimeFormat",
      "toLocaleDateString",
    ]);
  });

  it("does not flag a comment or string that merely names the API", () => {
    const sample = `// No Intl.DateTimeFormat here.\nexport const note = "we avoid toLocaleString";`;
    expect(bannedUses(stripCommentsAndStrings(sample))).toEqual([]);
  });
});
