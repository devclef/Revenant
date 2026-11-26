// Feature: 15-the-flow, R12.2 (the open letter on the receipts).
//
// The letter is never folded. These scans read the source of the reveal and
// fail when a fold comes back: the `foldLetter` state, the `collapsible` prop,
// a viewport read in the receipts layout, or the "Read the letter again"
// control. The repo has no DOM test environment, so the checks are textual.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "../..");

const reveal = readFileSync(resolve(here, "Reveal.tsx"), "utf8");
const letterColumn = readFileSync(resolve(here, "LetterColumn.tsx"), "utf8");
const ownScroll = readFileSync(resolve(here, "own-scroll.ts"), "utf8");

const VIEWPORT_READS = /matchMedia|innerWidth|isPhone/;

/**
 * The receipts split code in Reveal.tsx: from the line that computes `split`
 * up to the figures block, which holds the receipts column and the letter
 * slot. `isPhone` is still read elsewhere in the file for the marks and the
 * envelope, which are not the receipts layout.
 */
function receiptsLayoutSlice(source: string): string {
  const start = source.indexOf("const split = stage === 3");
  const end = source.indexOf("{stage >= 3 && figures !== null && record !== null");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("no-fold scan: the receipts layout block moved; update the markers");
  }
  return source.slice(start, end);
}

/** Every non-test .ts and .tsx file under `dir`, with its path relative to src. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!/\.(ts|tsx)$/.test(name) || /\.test\.(ts|tsx)$/.test(name)) return [];
    return [relative(srcRoot, full)];
  });
}

describe("Reveal does not fold the letter", () => {
  it("has no foldLetter state and no collapsible prop", () => {
    expect(reveal).not.toMatch(/foldLetter/);
    expect(reveal).not.toMatch(/collapsible/);
  });

  it("reads no viewport width in the receipts split block", () => {
    const slice = receiptsLayoutSlice(reveal);
    expect(slice.length).toBeGreaterThan(0);
    expect(slice).toMatch(/letterColumn/);
    expect(slice).not.toMatch(VIEWPORT_READS);
  });
});

describe("the receipts letter column reads no viewport width", () => {
  it("LetterColumn.tsx contains no matchMedia, innerWidth or isPhone", () => {
    expect(letterColumn).not.toMatch(VIEWPORT_READS);
  });

  it("own-scroll.ts contains no matchMedia, innerWidth or isPhone", () => {
    expect(ownScroll).not.toMatch(VIEWPORT_READS);
  });
});

/** Docs and the QA layout check that describe or drive the receipts flow. Paths are repo-root relative. */
const repoRoot = resolve(srcRoot, "..");
const EXTRA_SCAN_FILES = ["README.md", "docs/video-script.md", "tools/qa/layout-check.mjs"];

describe("no control reads 'Read the letter again'", () => {
  it("no non-test file under src/ contains the phrase, in any case", () => {
    const files = sourceFiles(srcRoot);
    expect(files.length).toBeGreaterThan(0);
    const hits = files.filter((file) =>
      readFileSync(resolve(srcRoot, file), "utf8")
        .toLowerCase()
        .includes("read the letter again"),
    );
    expect(hits).toEqual([]);
  });

  it("README.md, docs/video-script.md and tools/qa/layout-check.mjs do not contain the phrase", () => {
    const hits = EXTRA_SCAN_FILES.filter((file) =>
      readFileSync(resolve(repoRoot, file), "utf8")
        .toLowerCase()
        .includes("read the letter again"),
    );
    expect(hits).toEqual([]);
  });
});
