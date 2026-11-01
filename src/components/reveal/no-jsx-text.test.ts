// Source-scan guard: no literal JSX text nodes in the reveal components.
//
// Every user-facing word in the reveal flow must come from copy.ts through a
// JSX *expression* (`{REVEAL_COPY.stage2Title}`), never a literal text node
// written straight into the markup (R15.1, the literals rule). A stray literal
// is how untracked, unreviewed copy slips onto a page that tone.md and
// neutrality.md govern, so this test reads the SOURCE of every `.tsx` file
// under `src/components/reveal` and fails if any JSX child text node contains
// letters. It is a source scan, not a runtime check, so it catches the literal
// even on a branch the other tests never render.
//
// Approach, modelled on src/components/demo/no-jsx-text.test.ts: walk the
// reveal directory for `.tsx` files, then parse each one with the TypeScript
// compiler and visit every node. A `JsxText` node is exactly a literal text
// child of a JSX element; a `{...}` expression container parses as a
// `JsxExpression`, not `JsxText`, so copy.ts references never trip the guard.
// Whitespace-only `JsxText` (indentation between tags) is allowed; any
// `JsxText` with a letter fails. The scanned set is asserted non-empty so the
// guard cannot pass vacuously if the path is renamed or the directory empties,
// and it is asserted to contain the stage-2/stage-3 reveal components the
// ticket adds so the guard cannot silently stop covering them.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const revealDir = here;
// src/components/reveal -> src/components/ceremony
const ceremonyDir = resolve(here, "..", "ceremony");

function tsxFilesIn(dir: string): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((name) => name.endsWith(".tsx"))
    .filter((name) => !/\.(test|spec)\.tsx$/.test(name))
    .map((name) => resolve(dir, name))
    .filter((path) => statSync(path).isFile())
    .sort();
}

// Recursively collect non-test `.tsx` under `dir`. The ceremony folder nests a
// `desk/` subdirectory (DeskScene.tsx), so the flat `tsxFilesIn` would miss it;
// this walk covers every component .tsx in the tree.
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

const scannedFiles = [...tsxFilesIn(revealDir), ...ceremonyFiles].sort();

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

// The stage-2/stage-3 reveal components this ticket adds. Asserting they are in
// the scanned set keeps the guard from silently dropping coverage of exactly
// the files it was added to protect.
const EXPECTED_REVEAL_TSX = [
  "ChangeLine.tsx",
  "FigureLine.tsx",
  "FiguresThenNow.tsx",
  "FixtureNote.tsx",
  "Reveal.tsx",
  "SealedLetter.tsx",
] as const;

// The ceremony components this ticket brings under the same literals guard.
// Asserting they are in the scanned set keeps the guard from silently dropping
// coverage of the ceremony flow (including the nested desk/ component).
const EXPECTED_CEREMONY_TSX = [
  "CeremonyRoot.tsx",
  "DeskScene.tsx",
  "LiveRegion.tsx",
] as const;

describe("no literal JSX text nodes in reveal components (R15.1)", () => {
  it("scans a non-empty set of files", () => {
    expect(scannedFiles.length).toBeGreaterThan(0);
  });

  it("covers the stage-2/stage-3 reveal components the ticket adds", () => {
    const names = new Set(scannedFiles.map((f) => basename(f)));
    for (const expected of EXPECTED_REVEAL_TSX) {
      expect(names, `expected ${expected} in the scanned reveal .tsx set`).toContain(
        expected,
      );
    }
  });

  it("scans a non-empty set of ceremony files", () => {
    expect(ceremonyFiles.length).toBeGreaterThan(0);
  });

  it("covers the ceremony components (including the nested desk/ one)", () => {
    const names = new Set(scannedFiles.map((f) => basename(f)));
    for (const expected of EXPECTED_CEREMONY_TSX) {
      expect(
        names,
        `expected ${expected} in the scanned ceremony .tsx set`,
      ).toContain(expected);
    }
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

  it("would flag a real literal JSX text node (the guard is not vacuous)", () => {
    const literals = literalJsxText(
      "sample.tsx",
      `export function X() { return <p>Still sealed</p>; }`,
    );
    expect(literals.map((l) => l.text)).toContain("Still sealed");
  });

  it("does not flag an expression child from copy.ts", () => {
    const literals = literalJsxText(
      "sample.tsx",
      `export function X() { return <p>{REVEAL_COPY.stage2Title}</p>; }`,
    );
    expect(literals).toEqual([]);
  });
});
