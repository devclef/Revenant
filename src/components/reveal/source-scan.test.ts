// Feature: 03-persona-demo, Task 7 (R15.1, and the browser-API hygiene rules)
//
// Two source scans over the reveal and demo code:
//
//   1. No inline JSX text. Every word a reader sees must come from a copy
//      module (R15.1), so no literal text node may sit directly between JSX
//      tags in the new .tsx files. A `{expression}` child is fine -- that is a
//      value, not an authored string -- but `<p>Still sealed</p>` is not.
//
//   2. No client-only storage, logging, history or raw HTML. crypto.md and
//      tech.md forbid the opening flow from touching persistent browser storage
//      or the console, or injecting raw HTML. This scan asserts none of
//      localStorage, sessionStorage, indexedDB, document.cookie, console.,
//      history. or dangerouslySetInnerHTML is CALLED in src/components/reveal or
//      src/components/demo source (comments/strings are stripped first, so a
//      doc comment that merely names one does not trip it).
//
// Both scans read source text; they are lint-style heuristics, not full
// parsers. Each assertion seeds from a non-empty file set so it can never pass
// by scanning nothing.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
// The repository `src/` root, two levels up from src/components/reveal.
const srcRoot = resolve(here, "..", "..");

const revealRoot = join(srcRoot, "components", "reveal");
const demoComponentsRoot = join(srcRoot, "components", "demo");
const personaRouteRoot = join(srcRoot, "app", "demo", "personas");

/** Recursively collect files under `dir` matching `pred`, skipping fixtures. */
function collectFiles(
  dir: string,
  pred: (name: string) => boolean,
): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__fixtures__") continue;
      out.push(...collectFiles(full, pred));
      continue;
    }
    if (pred(entry.name)) out.push(full);
  }
  return out;
}

const isTsx = (name: string): boolean => /\.tsx$/.test(name);
const isTestName = (name: string): boolean => /\.(test|spec)\.tsx?$/.test(name);
const isSourceTs = (name: string): boolean =>
  /\.tsx?$/.test(name) && !isTestName(name);
const isSourceTsx = (name: string): boolean => isTsx(name) && !isTestName(name);
const relFromSrc = (file: string): string =>
  file.slice(srcRoot.length + 1).replace(/\\/g, "/");

/** Replace matched regions with spaces of equal length (keeps line numbers). */
function blank(source: string, re: RegExp): string {
  return source.replace(re, (m) => " ".repeat(m.length));
}

/** Blank block comments, line comments, template/single/double string literals. */
function stripCommentsAndStrings(source: string): string {
  let s = source;
  s = blank(s, /\/\*[\s\S]*?\*\//g);
  s = blank(s, /\/\/[^\n]*/g);
  s = blank(s, /`(?:\\.|[^`\\])*`/g);
  s = blank(s, /"(?:\\.|[^"\\])*"/g);
  s = blank(s, /'(?:\\.|[^'\\])*'/g);
  return s;
}

// ---------------------------------------------------------------------------
// Scan 1: no inline JSX text node in the new .tsx components/routes.
// ---------------------------------------------------------------------------
//
// Strategy: blank the parts of a .tsx file that can legitimately carry prose --
// comments and string/template literals. What remains is raw source. A JSX text
// node is then a run sitting between a `>` and the next `<` that reads as
// AUTHORED PROSE.
//
// Blanking EVERY `{...}` would erase the component's own function body (all JSX
// lives inside it), making the scan vacuous. So the `{...}` expression
// containers are removed only WITHIN each `>...<` segment, not across the whole
// file: a JSX child `{COPY.x}` or `{/* ... */}` becomes blank, but the
// surrounding `return ( ... )` body is untouched.
//
// A surviving run is flagged only when it reads as prose: a letter run of two
// or more, and NONE of the code punctuation that TypeScript residue (generics,
// operators, annotations, call syntax) always carries. That distinction keeps
// `ReturnType<...>`, `a => b` and `): Props {` from being mistaken for UI text,
// while still catching a real `<p>Still sealed</p>`.

/** Blank balanced `{...}` containers within a single segment, honouring nesting. */
function blankBracesIn(segment: string): string {
  const chars = segment.split("");
  let depth = 0;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === "{") {
      depth++;
      chars[i] = " ";
    } else if (c === "}") {
      if (depth > 0) {
        chars[i] = " ";
        depth--;
      }
    } else if (depth > 0) {
      chars[i] = " ";
    }
  }
  return chars.join("");
}

function jsxResidue(source: string): string {
  return stripCommentsAndStrings(source);
}

/**
 * Code punctuation that authored UI prose never contains but TypeScript
 * residue between `>` and `<` always does. Its presence in a between-run means
 * the run is code (a type annotation, an arrow, a call), not a JSX text node.
 * `{` and `}` are excluded here because a JSX expression child `{...}` is first
 * blanked out of the segment before this test runs.
 */
const CODE_PUNCT = /[;=()[\]:/\\|&`$<>,]/;

/** Find bare text children: prose-looking runs sitting between `>` and `<`. */
function findInlineText(residue: string): string[] {
  const hits: string[] = [];
  const re = />([^<>]*)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(residue)) !== null) {
    // Blank JSX expression children inside this segment only.
    const between = blankBracesIn(m[1]);
    const hasWord = /[A-Za-z]{2,}/.test(between);
    const looksLikeCode = CODE_PUNCT.test(between);
    if (hasWord && !looksLikeCode) {
      hits.push(between.trim());
    }
  }
  return hits;
}

describe("no inline JSX text: every reveal/demo string comes from copy.ts (R15.1)", () => {
  // Non-test .tsx under src/components/reveal and the persona route.
  const sourceTsx = [
    ...collectFiles(revealRoot, isSourceTsx),
    ...collectFiles(personaRouteRoot, isSourceTsx),
  ];

  it("has a non-empty set of .tsx component/route files", () => {
    expect(sourceTsx.length).toBeGreaterThan(0);
  });

  it("has no bare text node directly inside JSX", () => {
    const violations: string[] = [];
    for (const file of sourceTsx) {
      const residue = jsxResidue(readFileSync(file, "utf8"));
      for (const snippet of findInlineText(residue)) {
        violations.push(`${relFromSrc(file)}: inline JSX text "${snippet}"`);
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("would flag a real inline text node (the scan is not vacuous)", () => {
    const sample = jsxResidue(
      `export function X() { return <p>Still sealed</p>; }`,
    );
    expect(findInlineText(sample)).toContain("Still sealed");
  });

  it("does not flag an expression child or a TS generic", () => {
    const expr = jsxResidue(
      `export function X() { return <p>{COPY.sealedTitle}</p>; }`,
    );
    expect(findInlineText(expr)).toEqual([]);
    const generic = jsxResidue(
      `const flow: ReturnType<typeof useOpeningFlow> = f;`,
    );
    expect(findInlineText(generic)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Scan 2: no browser storage, logging, history or raw HTML in reveal/demo.
// ---------------------------------------------------------------------------

/** Forbidden tokens and a human label for each. */
const FORBIDDEN: ReadonlyArray<readonly [RegExp, string]> = [
  [/\blocalStorage\b/, "localStorage"],
  [/\bsessionStorage\b/, "sessionStorage"],
  [/\bindexedDB\b/, "indexedDB"],
  [/document\s*\.\s*cookie\b/, "document.cookie"],
  [/\bconsole\s*\./, "console."],
  [/\bhistory\s*\./, "history."],
  [/\bdangerouslySetInnerHTML\b/, "dangerouslySetInnerHTML"],
];

describe("no client storage, logging, history or raw HTML in reveal/demo code", () => {
  // Scan SOURCE only (not the tests themselves, which legitimately name these
  // tokens in their patterns). Comments and string literals are blanked first,
  // so a doc comment that merely names one of these does not count as a use.
  const sources = [
    ...collectFiles(revealRoot, isSourceTs),
    ...collectFiles(demoComponentsRoot, isSourceTs),
  ];

  it("has a non-empty set of source files", () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it("uses none of the forbidden browser APIs", () => {
    const violations: string[] = [];
    for (const file of sources) {
      const code = stripCommentsAndStrings(readFileSync(file, "utf8"));
      for (const [re, label] of FORBIDDEN) {
        if (re.test(code)) {
          violations.push(`${relFromSrc(file)} uses "${label}"`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });
});
