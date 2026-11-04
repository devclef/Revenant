// Feature: 07-judge-journey, R19.9: Skip ends the running sequence and never
// skips a recall question before the Recall_Record is stored.
//
// Skip calls the skip callback of each registered sequence (skip.tsx). A recall
// question is not a sequence, so Skip cannot move past one. This test pins that:
// only the sequences on the allowlist register a skip callback, and no file in
// the recall folder touches the Skip context. A new sequence that registers, or
// any recall code that reaches the Skip context, fails here and needs review.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const ceremonyRoot = here;
const recallRoot = join(here, "recall");

/** Sequences that register a skip callback, with the reason each may. */
const REGISTERED_SEQUENCES: ReadonlyMap<string, string> = new Map([
  ["scene/useEmergence.ts", "the Emergence sequence (R9)"],
  ["figures/FiguresFadeUp.tsx", "the figures fade-up sequence (R14)"],
  ["seal/SealBreak.tsx", "the Seal_Break sequence (R12)"],
]);

function sourcesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourcesIn(full);
    if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      return [full];
    }
    return [];
  });
}

/** Blank comments so a doc comment that names a call does not count. */
const stripComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));

const relPath = (file: string): string =>
  relative(ceremonyRoot, file).split("\\").join("/");

describe("Skip never skips a recall question (R19.9)", () => {
  it("scans a non-empty recall folder, so the check cannot pass vacuously", () => {
    expect(sourcesIn(recallRoot).length).toBeGreaterThan(0);
  });

  it("no recall file reaches the Skip context", () => {
    const violations: string[] = [];
    for (const file of sourcesIn(recallRoot)) {
      const code = stripComments(readFileSync(file, "utf8"));
      if (/\b(useSequence|useMaybeSequence|SkipProvider|skipAll)\b/.test(code) ||
          /from\s+["'][^"']*\/skip(-optional)?["']/.test(code)) {
        violations.push(relPath(file));
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("only the allowlisted sequences register a skip callback", () => {
    const registering: string[] = [];
    for (const file of sourcesIn(ceremonyRoot)) {
      const code = stripComments(readFileSync(file, "utf8"));
      if (/(?:^|[^\w.])register\s*\(/m.test(code) && /\buseSequence\s*\(/.test(code)) {
        registering.push(relPath(file));
      }
    }
    expect(registering.sort()).toEqual([...REGISTERED_SEQUENCES.keys()].sort());
  });

  it("every allowlisted sequence exists, so the allowlist is not stale", () => {
    for (const rel of REGISTERED_SEQUENCES.keys()) {
      expect(readFileSync(resolve(ceremonyRoot, rel), "utf8").length).toBeGreaterThan(0);
    }
  });
});
