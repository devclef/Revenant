// Feature: 03-persona-demo, Task 7 (R14.6, R16.5)
//
// Structure/security rules (see .kiro/steering/structure.md and tech.md):
//
//   * `src/lib/crypto` is browser-only and must never be reached by server
//     code. The persona route under `src/app/demo/**` is a server component. It
//     renders the client `OpeningFlow`, which is where the browser crypto lives
//     -- and crypto is pulled in there ONLY through a dynamic `import()`, never
//     a static one. So nothing the SERVER graph reaches (walking static imports
//     and stopping at the `"use client"` boundary) may import `src/lib/crypto`.
//
//   * Across `src/components/**`, a STATIC `@/lib/crypto` import is forbidden:
//     only a dynamic `import("@/lib/crypto")` is allowed, so the browser-only
//     crypto library is loaded lazily in the client and never bundled into a
//     server component that re-exports a client child.
//
//   * Nothing under `src/components/reveal` may import `src/lib/recall/generate`
//     -- recall questions are written at sealing time and sealed into the
//     letter; the opening flow reads them from the sealed payload and must never
//     regenerate them.
//
// This scan reads source text (it is not a full parser) and distinguishes
// STATIC specifiers (`import ... from "x"`, `export ... from "x"`, `import "x"`)
// from DYNAMIC `import("x")`. First-party references (relative and the "@/"
// tsconfig alias) are resolved to files on disk; bare package and node:
// specifiers are ignored -- they cannot point into src/. Each assertion seeds
// from a non-empty set so it can never pass by scanning nothing.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
// The repository `src/` root, two levels up from src/components/reveal.
const srcRoot = resolve(here, "..", "..");

const cryptoRoot = join(srcRoot, "lib", "crypto");
const recallGenerateBase = join(srcRoot, "lib", "recall", "generate");
const demoRoot = join(srcRoot, "app", "demo");
const componentsRoot = join(srcRoot, "components");
const revealRoot = join(srcRoot, "components", "reveal");
const ceremonyRoot = join(srcRoot, "components", "ceremony");

// Recursively collect every .ts/.tsx file under `dir`, skipping __fixtures__
// (committed vectors, not source).
function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
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

// A file is a client-component boundary when its first meaningful line is a
// "use client" / 'use client' directive. The server import walk stops at such
// files: React treats them as a serialization boundary, so what they import is
// browser code, not server code.
function isUseClient(file: string): boolean {
  let source: string;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    return false;
  }
  // The directive must be the first statement, but may follow blank lines and
  // comments. Scan from the top until the first non-trivial token.
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;
    if (line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) continue;
    return /^["']use client["'];?$/.test(line);
  }
  return false;
}

// Extract module specifiers, tagged static vs dynamic.
//   static:  import ... from "x" | export ... from "x" | import "x"
//   dynamic: import("x")
// Order matters: match dynamic import() first and blank it out, so the static
// `import "x"` pattern cannot mistake `import("x")` for a bare static import.
function extractSpecifiers(source: string): {
  staticSpecs: string[];
  dynamicSpecs: string[];
} {
  const dynamicSpecs: string[] = [];
  const dynamicRe = /import\s*\(\s*["']([^"']+)["']\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = dynamicRe.exec(source)) !== null) dynamicSpecs.push(m[1]);

  // Remove dynamic import() occurrences so the static patterns below cannot
  // re-match them.
  const withoutDynamic = source.replace(/import\s*\(\s*["'][^"']+["']\s*\)/g, "import(/*dyn*/)");

  const staticSpecs: string[] = [];
  const staticPatterns: RegExp[] = [
    /(?:import|export)[\s\S]*?from\s*["']([^"']+)["']/g,
    /import\s*["']([^"']+)["']/g,
    /require\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const re of staticPatterns) {
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(withoutDynamic)) !== null) staticSpecs.push(mm[1]);
  }
  return { staticSpecs, dynamicSpecs };
}

// Resolve a first-party specifier to a base absolute path (no settled
// extension). Relative specifiers resolve against the importing file's
// directory; "@/..." resolves against srcRoot (the tsconfig alias). Bare
// package and node: specifiers return null.
function resolveFirstPartyBase(spec: string, fromFile: string): string | null {
  if (spec.startsWith(".")) return resolve(dirname(fromFile), spec);
  if (spec.startsWith("@/")) return resolve(srcRoot, spec.slice(2));
  return null;
}

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

// True when `candidate` is inside `root` (equal or a descendant).
function isUnder(candidate: string, root: string): boolean {
  const rel = relative(root, candidate);
  return (
    rel === "" ||
    (!rel.startsWith("..") && !rel.startsWith(sep) && !/^\.\.(?:[\\/]|$)/.test(rel))
  );
}

// True when a resolved base path points at src/lib/recall/generate itself
// (the module, with or without an extension/index), not merely something under
// a "generate" directory.
function isRecallGenerate(base: string): boolean {
  if (base === recallGenerateBase) return true;
  const settled = settleToFile(base);
  if (settled === null) return false;
  // Accept generate.ts / generate.tsx / generate/index.ts etc.
  return (
    settled === settleToFile(recallGenerateBase) ||
    isUnder(settled, recallGenerateBase)
  );
}

describe("import boundary: persona demo server graph must not reach lib/crypto (R14.6)", () => {
  // Seed from every file under src/app/demo/**. Walk ONLY static imports, and
  // stop descending at any file that is a "use client" boundary -- its imports
  // are browser code, not server code.
  const demoSeeds = collectSourceFiles(demoRoot);

  it("has a non-empty seed set under src/app/demo (an empty scan must not pass)", () => {
    expect(demoSeeds.length).toBeGreaterThan(0);
  });

  it("reaches nothing under src/lib/crypto via static imports from the server graph", () => {
    const violations: string[] = [];
    const reached = new Set<string>();
    const queue: string[] = [];
    for (const s of demoSeeds) {
      // Seeds themselves are server files (if a seed were "use client" its own
      // imports would already be browser code), so we still inspect the seed's
      // own static imports but do not descend THROUGH a client child.
      reached.add(s);
      queue.push(s);
    }

    while (queue.length > 0) {
      const file = queue.pop() as string;
      let source: string;
      try {
        source = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      const { staticSpecs } = extractSpecifiers(source);
      for (const spec of staticSpecs) {
        const base = resolveFirstPartyBase(spec, file);
        if (base === null) continue;
        if (isUnder(base, cryptoRoot)) {
          violations.push(`${relative(srcRoot, file)} statically imports "${spec}" -> lib/crypto/**`);
          continue;
        }
        const target = settleToFile(base);
        if (target === null) continue;
        if (isUnder(target, cryptoRoot)) {
          violations.push(`${relative(srcRoot, file)} statically imports "${spec}" -> lib/crypto/**`);
          continue;
        }
        if (reached.has(target)) continue;
        reached.add(target);
        // Stop at the "use client" boundary: do NOT descend into a client
        // component's imports, because those are browser modules by design.
        if (isUseClient(target)) continue;
        queue.push(target);
      }
    }

    expect(violations).toEqual([]);
  });
});

describe("import boundary: src/components/** may import lib/crypto only dynamically", () => {
  const componentFiles = collectSourceFiles(componentsRoot);

  it("has a non-empty set of component source files", () => {
    expect(componentFiles.length).toBeGreaterThan(0);
  });

  it("no src/components file statically imports @/lib/crypto (dynamic import() only)", () => {
    const violations: string[] = [];
    for (const file of componentFiles) {
      let source: string;
      try {
        source = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      const { staticSpecs } = extractSpecifiers(source);
      for (const spec of staticSpecs) {
        const base = resolveFirstPartyBase(spec, file);
        if (base === null) continue;
        const target = settleToFile(base);
        const settled = target ?? base;
        if (isUnder(settled, cryptoRoot)) {
          violations.push(`${relative(srcRoot, file)} statically imports "${spec}" -> lib/crypto/** (use a dynamic import() instead)`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

describe("import boundary: src/components/reveal and ceremony must not import lib/recall/generate", () => {
  // The ceremony flow is part of the opening sequence, so the same rule applies:
  // recall questions are sealed into the letter and read from the payload, never
  // regenerated. Covered here alongside reveal (additions only).
  const revealFiles = [
    ...collectSourceFiles(revealRoot),
    ...collectSourceFiles(ceremonyRoot),
  ];

  it("has a non-empty set of reveal source files", () => {
    expect(collectSourceFiles(revealRoot).length).toBeGreaterThan(0);
  });

  it("has a non-empty set of ceremony source files", () => {
    expect(collectSourceFiles(ceremonyRoot).length).toBeGreaterThan(0);
  });

  it("no src/components/reveal or ceremony file imports src/lib/recall/generate (static or dynamic)", () => {
    const violations: string[] = [];
    for (const file of revealFiles) {
      let source: string;
      try {
        source = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      const { staticSpecs, dynamicSpecs } = extractSpecifiers(source);
      for (const spec of [...staticSpecs, ...dynamicSpecs]) {
        const base = resolveFirstPartyBase(spec, file);
        if (base === null) continue;
        if (isRecallGenerate(base)) {
          violations.push(`${relative(srcRoot, file)} imports "${spec}" -> lib/recall/generate`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
