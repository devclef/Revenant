// Feature: 02-sealed-letters, R3.2
//
// Structure/security rule (see .kiro/steering/structure.md and tech.md):
// `src/lib/crypto` is browser-only and must never be imported by server code.
// Server code lives under `src/app/api` (route handlers), `src/lib/db` (the
// Postgres client) and `src/lib/letter-store` (the persistence layer). A single
// import — direct or transitive — from any of those into `src/lib/crypto` would
// drag the browser-only crypto library onto the server.
//
// This test seeds from every .ts/.tsx file (tests included) under those server
// roots, extracts module specifiers from static import / export…from, dynamic
// import() and require(), resolves first-party references (relative and the
// "@/" tsconfig alias), and walks the import graph transitively. It fails if any
// reachable file resolves to a path under src/lib/crypto. Bare package
// specifiers and node: builtins are ignored — they cannot point into src/.
//
// Not every server root exists yet: `src/lib/letter-store` is added by a later
// task, and the route-file assertions in design.md come with it. This scan is
// scoped to the roots that currently exist and asserts the seed set is
// non-empty, so it can never pass by scanning nothing.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
// The repository `src/` root, two levels up from src/lib/crypto.
const srcRoot = resolve(here, "..", "..");
// The forbidden target: nothing reachable from a server root may live here.
const cryptoRoot = join(srcRoot, "lib", "crypto");

// Server roots whose import graph must never reach src/lib/crypto. Some do not
// exist yet; only existing ones are scanned.
const serverRoots = [
  join(srcRoot, "app", "api"),
  join(srcRoot, "lib", "db"),
  join(srcRoot, "lib", "letter-store"),
].filter((d) => existsSync(d));

// Recursively collect every .ts/.tsx file under `dir`, skipping __fixtures__
// (committed vectors, not source).
function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__fixtures__") continue;
      out.push(...collectSourceFiles(full));
      continue;
    }
    if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

// Extract module specifiers from source text. Covers:
//   import … from "x";  export … from "x";  import "x";
//   import("x");         require("x")
// Not a full parser, but the first-party source we control uses only these
// ordinary forms.
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

// Resolve a first-party specifier to a base absolute path (without a settled
// extension). Relative specifiers resolve against the importing file's
// directory; "@/…" resolves against srcRoot (the tsconfig path alias). Bare
// package and node: specifiers return null — they cannot point into src/.
function resolveFirstPartyBase(spec: string, fromFile: string): string | null {
  if (spec.startsWith(".")) return resolve(dirname(fromFile), spec);
  if (spec.startsWith("@/")) return resolve(srcRoot, spec.slice(2));
  return null;
}

// Settle a base path to the real source file on disk: an exact file, one of the
// TypeScript/JS extensions, or an index file inside a directory. Returns null
// when nothing resolves (e.g. a type-only reference with no backing file).
const EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
function settleToFile(base: string): string | null {
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

// True when `candidate` is inside `root` (equal to it, or a descendant).
function isUnder(candidate: string, root: string): boolean {
  const rel = relative(root, candidate);
  return (
    rel === "" ||
    (!rel.startsWith("..") && !rel.startsWith(sep) && !/^\.\.(?:[\\/]|$)/.test(rel))
  );
}

// Seed set: every source file under the existing server roots.
const seedFiles = serverRoots.flatMap(collectSourceFiles);

// Walk the import graph transitively from the seeds. Returns the set of all
// reachable first-party files (the seeds plus everything they pull in), and the
// edges that cross into src/lib/crypto, each as "importer -> specifier".
function walkGraph(seeds: string[]): { reached: Set<string>; violations: string[] } {
  const reached = new Set<string>();
  const violations: string[] = [];
  const queue = [...seeds];
  for (const s of seeds) reached.add(s);

  while (queue.length > 0) {
    const file = queue.pop() as string;
    let source: string;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const spec of extractSpecifiers(source)) {
      const base = resolveFirstPartyBase(spec, file);
      if (base === null) continue;
      if (isUnder(base, cryptoRoot)) {
        violations.push(`${relative(srcRoot, file)} imports "${spec}" -> lib/crypto/**`);
        continue;
      }
      const target = settleToFile(base);
      if (target === null) continue;
      if (isUnder(target, cryptoRoot)) {
        violations.push(`${relative(srcRoot, file)} imports "${spec}" -> lib/crypto/**`);
        continue;
      }
      if (!reached.has(target)) {
        reached.add(target);
        queue.push(target);
      }
    }
  }
  return { reached, violations };
}

describe("import boundary: server code must not reach lib/crypto (R3.2)", () => {
  it("has a non-empty seed set of server source files (an empty scan must not pass)", () => {
    // Guard against a silently-empty scan: if no server source was found, the
    // transitive assertion below would pass vacuously. At least the db client
    // and the health routes exist today, so require a real seed set.
    expect(seedFiles.length).toBeGreaterThan(0);
  });

  it("reaches nothing under src/lib/crypto from any server root", () => {
    const { violations } = walkGraph(seedFiles);
    expect(violations).toEqual([]);
  });
});
