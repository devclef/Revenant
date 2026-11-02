// Feature: 06-lock-and-unlock, requirement R11.4: the test authenticator fake
// must never reach production code.
//
// The fake lives at src/lib/crypto/testing/fake-authenticator.ts and is only for
// tests. This guard scans the real contents of every .ts/.tsx file under src/
// (no hard-coded file list). Any non-test file outside src/lib/crypto/testing/
// that imports, re-exports or dynamically loads the fake fails the test. Test
// files (*.test.* and *.spec.*) may import it.
//
// Module specifiers are found with a regex over the source text, the same forms
// import-boundary.test.ts uses. Relative and "@/" specifiers are resolved to a
// file on disk, so an import through a barrel or a different relative path is
// still caught.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
// src/ root: this file is src/lib/crypto/no-fake-import.test.ts.
const srcRoot = resolve(here, "..", "..");
const fakeFile = resolve(here, "testing", "fake-authenticator.ts");
const testingRoot = resolve(here, "testing");

const EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "__fixtures__") continue;
      out.push(...collectSourceFiles(full));
      continue;
    }
    if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function isTestFile(file: string): boolean {
  return /\.(test|spec)\.tsx?$/.test(file);
}

function isUnder(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(root + "/");
}

/** Every module specifier the source names: static, re-export, dynamic import, require. */
function extractSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const patterns: RegExp[] = [
    /(?:import|export)[\s\S]*?from\s*["']([^"']+)["']/g,
    /import\s*["']([^"']+)["']/g,
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
    /require\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) specs.push(m[1]);
  }
  return specs;
}

/** The file a first-party specifier points at, or null for packages and unresolved paths. */
function resolveToFile(spec: string, fromFile: string): string | null {
  let base: string;
  if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else if (spec.startsWith("@/")) base = resolve(srcRoot, spec.slice(2));
  else return null;

  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of EXTS) {
    const candidate = base + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  if (existsSync(base) && statSync(base).isDirectory()) {
    for (const ext of EXTS) {
      const candidate = join(base, "index" + ext);
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    }
  }
  return null;
}

const allFiles = collectSourceFiles(srcRoot);
const productionFiles = allFiles.filter((f) => !isTestFile(f) && !isUnder(f, testingRoot));

/** Violations found by scanning the given files: "file imports \"spec\"" per offending edge. */
function findFakeImports(files: string[]): string[] {
  const violations: string[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const spec of extractSpecifiers(source)) {
      // A specifier that names the fake directly is a violation even if it
      // does not resolve on disk, so an unresolvable path cannot slip past.
      const namesFake = /(^|\/)testing\/fake-authenticator(\.[cm]?[jt]sx?)?$/.test(spec);
      const target = resolveToFile(spec, file);
      if (namesFake || target === fakeFile) {
        violations.push(`${file.slice(srcRoot.length + 1)} imports "${spec}"`);
      }
    }
  }
  return violations;
}

describe("R11.4: the test fake is never imported by production code", () => {
  it("found the fake and a real set of production source files to scan", () => {
    // Guard against a vacuous pass: the fake must exist where we expect, and
    // the scan must cover real production code, not an empty list.
    expect(existsSync(fakeFile)).toBe(true);
    expect(productionFiles.length).toBeGreaterThan(0);
    expect(productionFiles).toContain(resolve(here, "passkey.ts"));
  });

  it("no non-test file outside src/lib/crypto/testing/ imports the fake", () => {
    expect(findFakeImports(productionFiles)).toEqual([]);
  });

  it("the public crypto barrel does not re-export the fake", () => {
    const barrel = resolve(here, "index.ts");
    const source = readFileSync(barrel, "utf8");
    expect(source).not.toMatch(/testing\//);
    expect(findFakeImports([barrel])).toEqual([]);
  });
});
