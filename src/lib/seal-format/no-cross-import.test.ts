import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Structure rule (see .kiro/steering/structure.md and tech.md): `lib/seal-format`
// is loaded by both browser and server code, so it must never import the
// browser-only `lib/crypto` library nor the server-only `lib/db` client. A stray
// import in either direction would drag those modules into the wrong environment.
// This test reads the seal-format source on disk, extracts every module
// specifier (static import/export-from, dynamic import(), and require()), and
// fails if any of them resolves to a path under src/lib/crypto or src/lib/db.

const here = dirname(fileURLToPath(import.meta.url));
// The repository `src/` root, two levels up from src/lib/seal-format.
const srcRoot = resolve(here, "..", "..");
const forbiddenRoots = [
  join(srcRoot, "lib", "crypto"),
  join(srcRoot, "lib", "db"),
];

// Recursively collect every .ts/.tsx file under seal-format, skipping the
// __fixtures__ tree (committed JSON vectors, not source we need to lint).
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
//   import ... from "x";  export ... from "x";  import "x";
//   import("x");          require("x")
// Good enough for first-party source we control; it is not a full parser, but
// the seal-format code uses only these ordinary forms.
function extractSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const patterns: RegExp[] = [
    // static import / export ... from "spec"  and bare  import "spec"
    /(?:import|export)[\s\S]*?from\s*["']([^"']+)["']/g,
    /import\s*["']([^"']+)["']/g,
    // dynamic import("spec")
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
    // require("spec")
    /require\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) specs.push(m[1]);
  }
  return specs;
}

// Resolve a module specifier to an absolute path under src/, when it is a
// first-party reference we can locate. Relative specifiers resolve against the
// importing file's directory; "@/..." resolves against srcRoot (the tsconfig
// path alias). Bare package specifiers (e.g. "zod", "node:fs") return null —
// they cannot point into src/lib/crypto or src/lib/db.
function resolveFirstParty(spec: string, fromFile: string): string | null {
  if (spec.startsWith(".")) {
    return resolve(dirname(fromFile), spec);
  }
  if (spec.startsWith("@/")) {
    return resolve(srcRoot, spec.slice(2));
  }
  return null;
}

// True when `candidate` is inside `root` (equal to it, or a descendant).
function isUnder(candidate: string, root: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith(sep) && !/^\.\.(?:[\\/]|$)/.test(rel));
}

const sourceFiles = collectSourceFiles(here);

describe("seal-format: no cross-imports of lib/crypto or lib/db", () => {
  it("scans the real seal-format source files (an empty scan must not pass)", () => {
    // Guard against a silently-empty scan: if the walk found nothing, the
    // "no forbidden imports" assertion below would pass vacuously. Require the
    // known first-party source modules to be present and scanned.
    expect(sourceFiles.length).toBeGreaterThanOrEqual(6);
    const names = sourceFiles.map((f) => relative(here, f).split(sep).join("/"));
    for (const expected of [
      "base64url.ts",
      "canonical-json.ts",
      "hash.ts",
      "registry.ts",
      "index.ts",
      "v1/payload.ts",
      "v1/header.ts",
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("imports nothing that resolves under src/lib/crypto or src/lib/db", () => {
    const violations: string[] = [];
    for (const file of sourceFiles) {
      const source = readFileSync(file, "utf8");
      for (const spec of extractSpecifiers(source)) {
        const resolved = resolveFirstParty(spec, file);
        if (resolved === null) continue;
        for (const root of forbiddenRoots) {
          if (isUnder(resolved, root)) {
            violations.push(
              `${relative(srcRoot, file)} imports "${spec}" -> ${relative(srcRoot, root)}/**`,
            );
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
