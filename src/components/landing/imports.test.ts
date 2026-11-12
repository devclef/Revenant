import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards against a landing component that is written and tested but never
 * rendered. Every non-test file under src/components/landing/ must be reached
 * from a rendered route under src/app/, directly or through an import chain.
 * Test files are not followed, so a test importing a component does not count.
 */

const SRC = resolve(__dirname, "../..");
const LANDING_DIR = resolve(__dirname);
const APP_DIR = join(SRC, "app");

const CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".css"];

function isTestFile(path: string): boolean {
  return /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(path);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

/** Non-test source files directly under the landing folder, as absolute paths. */
function landingFiles(): string[] {
  return walk(LANDING_DIR)
    .filter((path) => !isTestFile(path))
    .filter((path) => CODE_EXTENSIONS.some((ext) => path.endsWith(ext)))
    .sort();
}

/** Resolve one import specifier to a file under src/, or null for packages. */
function resolveSpecifier(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) {
    base = join(SRC, spec.slice(2));
  } else if (spec.startsWith(".")) {
    base = resolve(dirname(from), spec);
  } else {
    return null;
  }

  const candidates = [
    base,
    ...CODE_EXTENSIONS.map((ext) => base + ext),
    ...[".ts", ".tsx", ".js"].map((ext) => join(base, `index${ext}`)),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

const IMPORT_PATTERNS = [
  /\bfrom\s+["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\bimport\s+["']([^"']+)["']/g,
  /\bimport\s+type\s+[^"']*?from\s+["']([^"']+)["']/g,
];

/** Import specifiers in one source file, ignoring anything in comments. */
function specifiersIn(path: string): string[] {
  const text = readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const specs: string[] = [];
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      specs.push(match[1]);
    }
  }
  return specs;
}

/** Every non-test file reachable from a file under src/app/. */
function reachableFromRoutes(): Set<string> {
  const seen = new Set<string>();
  const queue = walk(APP_DIR).filter(
    (path) =>
      !isTestFile(path) &&
      (path.endsWith(".ts") || path.endsWith(".tsx")),
  );

  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!/\.(ts|tsx|js|jsx|mjs)$/.test(file)) continue;

    for (const spec of specifiersIn(file)) {
      const target = resolveSpecifier(file, spec);
      if (target === null || isTestFile(target) || seen.has(target)) continue;
      queue.push(target);
    }
  }
  return seen;
}

describe("landing components are rendered by a route", () => {
  it("finds at least one landing file to check", () => {
    expect(landingFiles().length).toBeGreaterThan(0);
  });

  it("every landing file is imported by a file under src/app/", () => {
    const reachable = reachableFromRoutes();
    const unreached = landingFiles()
      .filter((path) => !reachable.has(path))
      .map((path) => relative(SRC, path).split(sep).join("/"));

    expect(
      unreached,
      `Landing files no rendered route imports: ${unreached.join(", ")}`,
    ).toEqual([]);
  });
});
