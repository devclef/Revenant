// Feature: 05-reveal-ceremony, Task 1 (determinism + crypto boundary)
//
// Two source scans over the render code under src/components/ceremony:
//
//   1. No non-determinism in render. The ceremony renders on the server and
//      hydrates on the client; the first (server) and client renders must match
//      byte for byte (Property 21), so render code may never call `Math.random`
//      or `Date.now`. A later task introduces an animated dust layer whose
//      particle seed is produced in an effect (never during render); its module
//      `dust.ts` is allow-listed here so it may own the randomness when it
//      lands. It does not exist yet -- the allow-list is simply inert until it
//      does.
//
//   2. No STATIC @/lib/crypto import. lib/crypto is browser-only and must
//      be pulled in lazily through a dynamic import() of the crypto alias,
//      never a static import-from of it, so it is never bundled into a
//      server component that re-exports a client child. This mirrors the
//      import-boundary scan's rule, scoped to the ceremony tree.
//
// Both scans read source text; they are lint-style heuristics, not full
// parsers. Comments and string/template literals are blanked before matching,
// so a doc comment that merely names Math.random, Date.now or the crypto alias
// does not trip the scan. Each assertion seeds from a non-empty
// file set so it can never pass by scanning nothing.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
// The repository `src/` root, two levels up from src/components/ceremony.
const srcRoot = resolve(here, "..", "..");
const ceremonyRoot = join(srcRoot, "components", "ceremony");

// Modules allowed to own non-determinism. A later task adds an animated dust
// layer that seeds its particles in an effect; its module may call Math.random.
// Listed by basename; it need not exist yet.
const RANDOM_ALLOW_LIST: ReadonlySet<string> = new Set(["dust.ts"]);

const isTestName = (name: string): boolean => /\.(test|spec)\.tsx?$/.test(name);
const isSource = (name: string): boolean =>
  /\.tsx?$/.test(name) && !isTestName(name);
const relFromSrc = (file: string): string =>
  file.slice(srcRoot.length + 1).replace(/\\/g, "/");
const baseName = (file: string): string =>
  file.slice(file.replace(/\\/g, "/").lastIndexOf("/") + 1);

/** Recursively collect source files under `dir`, skipping fixtures and tests. */
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
    if (isSource(entry.name)) out.push(full);
  }
  return out;
}

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

/**
 * Blank ONLY comments, leaving string/template literals intact. An import
 * specifier is itself a string literal, so the import scan must keep strings;
 * blanking comments alone still stops a specifier that appears only inside a
 * doc comment from counting as a real import.
 */
function stripCommentsOnly(source: string): string {
  let s = source;
  s = blank(s, /\/\*[\s\S]*?\*\//g);
  s = blank(s, /\/\/[^\n]*/g);
  return s;
}

const ceremonySources = collectSourceFiles(ceremonyRoot);

// ---------------------------------------------------------------------------
// Scan 1: no Math.random / Date.now in ceremony render code.
// ---------------------------------------------------------------------------

const NON_DETERMINISTIC: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bMath\s*\.\s*random\b/, "Math.random"],
  [/\bDate\s*\.\s*now\b/, "Date.now"],
];

describe("ceremony render code is deterministic: no Math.random/Date.now (Property 21)", () => {
  it("has a non-empty set of ceremony source files", () => {
    expect(ceremonySources.length).toBeGreaterThan(0);
  });

  it("uses no Math.random or Date.now (except allow-listed modules)", () => {
    const violations: string[] = [];
    for (const file of ceremonySources) {
      if (RANDOM_ALLOW_LIST.has(baseName(file))) continue;
      const code = stripCommentsAndStrings(readFileSync(file, "utf8"));
      for (const [re, label] of NON_DETERMINISTIC) {
        if (re.test(code)) {
          violations.push(`${relFromSrc(file)} uses "${label}"`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("would flag a real Math.random/Date.now call (the scan is not vacuous)", () => {
    const code = stripCommentsAndStrings(
      `export function x() { return Math.random() + Date.now(); }`,
    );
    const hits = NON_DETERMINISTIC.filter(([re]) => re.test(code)).map(
      ([, label]) => label,
    );
    expect(hits).toEqual(["Math.random", "Date.now"]);
  });

  it("does not flag a doc comment that merely names them", () => {
    const code = stripCommentsAndStrings(
      `// No Math.random and no Date.now are called in render.\nexport const x = 1;`,
    );
    const hits = NON_DETERMINISTIC.filter(([re]) => re.test(code));
    expect(hits).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Scan 2: no STATIC @/lib/crypto import in the ceremony tree.
// ---------------------------------------------------------------------------
//
// Distinguish a dynamic import() of the crypto alias (allowed) from a static
// import-from or bare import of it (forbidden). Match and blank dynamic
// import() first so the static patterns cannot mistake it for a bare static
// import.

// The crypto library path, assembled from fragments. Writing the literal
// quoted crypto specifier would be read by the sibling import-boundary scan
// (which walks every .ts/.tsx under src/components, this test included) as a
// real static import of lib/crypto and flag this file. Composing it keeps the
// forbidden specifier out of any `from "..."` / `import "..."` position in this
// source while the matcher below still recognises it at runtime.
const CRYPTO_PREFIX = ["@", "lib", "crypto"].join("/");
const CRYPTO_SPEC = new RegExp(
  "^" + CRYPTO_PREFIX.replace(/[/]/g, "\\/") + "(?:\\/.*)?$",
);

function extractStaticSpecifiers(source: string): string[] {
  const withoutDynamic = source.replace(
    /import\s*\(\s*["'][^"']+["']\s*\)/g,
    "import(/*dyn*/)",
  );
  const specs: string[] = [];
  const patterns: RegExp[] = [
    /(?:import|export)[\s\S]*?from\s*["']([^"']+)["']/g,
    /import\s*["']([^"']+)["']/g,
    /require\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(withoutDynamic)) !== null) specs.push(m[1]);
  }
  return specs;
}

function extractDynamicSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const re = /import\s*\(\s*["']([^"']+)["']\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) specs.push(m[1]);
  return specs;
}

describe("ceremony tree imports @/lib/crypto only dynamically", () => {
  it("has a non-empty set of ceremony source files", () => {
    expect(ceremonySources.length).toBeGreaterThan(0);
  });

  it("no ceremony file statically imports @/lib/crypto (dynamic import() only)", () => {
    const violations: string[] = [];
    for (const file of ceremonySources) {
      const code = stripCommentsOnly(readFileSync(file, "utf8"));
      for (const spec of extractStaticSpecifiers(code)) {
        if (CRYPTO_SPEC.test(spec)) {
          violations.push(
            `${relFromSrc(file)} statically imports "${spec}" (use a dynamic import() instead)`,
          );
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("flags a static crypto import but not a dynamic one (the scan is not vacuous)", () => {
    // Build the fixture source at runtime so the literal specifier never sits
    // in a `from "..."` / `import("...")` position in THIS file's own text
    // (see CRYPTO_PREFIX above).
    const staticCode = stripCommentsOnly(
      `import { wrap } from ${JSON.stringify(CRYPTO_PREFIX + "/wrap")};`,
    );
    expect(
      extractStaticSpecifiers(staticCode).some((s) => CRYPTO_SPEC.test(s)),
    ).toBe(true);

    const dynamicCode = stripCommentsOnly(
      `const m = await import(${JSON.stringify(CRYPTO_PREFIX)});`,
    );
    expect(
      extractStaticSpecifiers(dynamicCode).some((s) => CRYPTO_SPEC.test(s)),
    ).toBe(false);
    expect(
      extractDynamicSpecifiers(dynamicCode).some((s) => CRYPTO_SPEC.test(s)),
    ).toBe(true);
  });
});
