// Source-scan guard: no literal JSX text nodes in the demo components or pages.
//
// Every user-facing word on the demo pages must come from copy.ts through a
// JSX *expression* (`{DEMO_COPY.heading}`), never a literal text node written
// straight into the markup (R15.1, the literals rule). A stray literal is how
// untracked, unreviewed copy slips onto a page that tone.md and neutrality.md
// govern, so this test reads the SOURCE of every `.tsx` file under
// `src/components/demo` and `src/app/demo` and fails if any JSX child text node
// contains letters. It is a source scan, not a runtime check, so it catches the
// literal even on a branch the other tests never render.
//
// Approach, modelled on the file-walk in letter-store/no-console.test.ts: walk
// the two demo directories for `.tsx` files, then parse each one with the
// TypeScript compiler and visit every node. A `JsxText` node is exactly a
// literal text child of a JSX element; a `{...}` expression container parses as
// a `JsxExpression`, not `JsxText`, so copy.ts references never trip the guard.
// Whitespace-only `JsxText` (indentation between tags) is allowed; any
// `JsxText` with a letter fails. The scanned set is asserted non-empty so the
// guard cannot pass vacuously if a path is renamed or a directory empties.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
// src/components/demo -> src
const srcRoot = resolve(here, "..", "..");

// The directories whose `.tsx` files render demo/ceremony markup. The ceremony
// flow renders on the persona demo page, so its literals fall under the same
// R15.1 guard. `tsxFilesIn` is flat; the ceremony tree nests a `desk/`
// subdirectory, so it is walked recursively by `tsxFilesUnder` below.
const scannedDirs = [
  resolve(srcRoot, "components", "demo"),
  resolve(srcRoot, "app", "demo"),
];
const ceremonyDir = resolve(srcRoot, "components", "ceremony");

function tsxFilesIn(dir: string): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    // A directory that does not exist contributes no files; the non-empty
    // assertion below still guards against every directory going missing.
    return [];
  }
  return names
    .filter((name) => name.endsWith(".tsx"))
    .filter((name) => !/\.(test|spec)\.tsx$/.test(name))
    .map((name) => resolve(dir, name))
    .filter((path) => statSync(path).isFile())
    .sort();
}

// Recursively collect non-test `.tsx` under `dir` (covers the nested
// ceremony/desk/ component).
function tsxFilesUnder(dir: string): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const name of names) {
    const full = resolve(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...tsxFilesUnder(full));
      continue;
    }
    if (
      name.endsWith(".tsx") &&
      !/\.(test|spec)\.tsx$/.test(name) &&
      stat.isFile()
    ) {
      out.push(full);
    }
  }
  return out.sort();
}

const ceremonyFiles = tsxFilesUnder(ceremonyDir);

const scannedFiles = [...scannedDirs.flatMap(tsxFilesIn), ...ceremonyFiles];

const hasLetter = /[A-Za-z]/;

/**
 * Parse `source` as TSX and return every literal JSX text node that contains a
 * letter, with its 1-based line number for a readable failure message. A
 * `{...}` expression container is a `JsxExpression`, not a `JsxText`, so copy.ts
 * references are never reported; only prose typed straight into the markup is.
 */
function literalJsxText(
  file: string,
  source: string,
): { line: number; text: string }[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  );

  const found: { line: number; text: string }[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node) && hasLetter.test(node.text)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );
      found.push({ line: line + 1, text: node.text.trim() });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return found;
}

describe("no literal JSX text nodes in demo components and pages (R15.1)", () => {
  it("scans a non-empty set of files", () => {
    expect(scannedFiles.length).toBeGreaterThan(0);
  });

  it("scans a non-empty set of ceremony files", () => {
    expect(ceremonyFiles.length).toBeGreaterThan(0);
  });

  it.each(scannedFiles)("has no literal JSX text node: %s", (file) => {
    const source = readFileSync(file, "utf8");
    const literals = literalJsxText(file, source);
    expect(
      literals,
      `literal JSX text must come from copy.ts (R15.1): ${literals
        .map((l) => `line ${l.line}: ${JSON.stringify(l.text)}`)
        .join("; ")}`,
    ).toEqual([]);
  });
});
