/**
 * Requirement 13.3 (spec 20, Part B): the Simulated_Port module is reachable
 * only from the Seal_Page's dynamic crypto load, never from `/seal`, the
 * Letter_Page or LiveLetter.
 *
 * The scan starts at every file under src/app/seal and src/app/l, and at
 * src/components/live/LiveLetter.tsx. It follows every static `import`,
 * `import type`, side-effect import and `export ... from`, transitively, through
 * the project's own files (`@/` and relative paths). It fails if that walk
 * reaches the Simulated_Port module, or if any file it reaches calls `import()`
 * on that module's path.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SRC = join(ROOT, "src");
const SIMULATED_PORT = join(SRC, "lib", "crypto", "simulated-port.ts");

/** The entry points named by Requirement 13.3. */
function entryFiles(): string[] {
  return [
    ...listSources(join(SRC, "app", "seal")),
    ...listSources(join(SRC, "app", "l")),
    join(SRC, "components", "live", "LiveLetter.tsx"),
  ];
}

function listSources(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...listSources(path));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

/** Source text with block and whole-line comments removed, so commented imports are not edges. */
function codeOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
}

/** Resolves a project import to its file, or null for a package or a missing file. */
function resolveProjectImport(from: string, specifier: string): string | null {
  let base: string | null = null;
  if (specifier.startsWith("@/")) base = join(SRC, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(from), specifier);
  if (base === null) return null;
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const STATIC_EDGE =
  /(?:^|[\s;])(?:import|export)\s+(?:type\s+)?(?:[^'"`;]*?\sfrom\s*)?["']([^"']+)["']/g;
const DYNAMIC_EDGE = /\bimport\(\s*["']([^"']+)["']\s*\)/g;

function specifiersOf(code: string, pattern: RegExp): string[] {
  return [...code.matchAll(pattern)].map((match) => match[1] ?? "");
}

interface Walk {
  reached: Set<string>;
  staticHits: string[];
  dynamicHits: string[];
}

function walkStatic(entries: readonly string[]): Walk {
  const reached = new Set<string>();
  const staticHits: string[] = [];
  const dynamicHits: string[] = [];
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (reached.has(file)) continue;
    reached.add(file);
    if (file === SIMULATED_PORT) {
      staticHits.push(relative(ROOT, file));
      continue;
    }
    const code = codeOf(file);
    for (const specifier of specifiersOf(code, STATIC_EDGE)) {
      const target = resolveProjectImport(file, specifier);
      if (target !== null) queue.push(target);
    }
    for (const specifier of specifiersOf(code, DYNAMIC_EDGE)) {
      const target = resolveProjectImport(file, specifier);
      if (target === SIMULATED_PORT) {
        dynamicHits.push(`${relative(ROOT, file)} imports ${specifier}`);
      }
    }
  }
  return { reached, staticHits, dynamicHits };
}

describe("the Simulated_Port module is out of the /seal, Letter_Page and LiveLetter graph (Requirement 13.3)", () => {
  it("the Simulated_Port module exists, so the scan has a real target", () => {
    expect(existsSync(SIMULATED_PORT)).toBe(true);
  });

  it("the entry points exist", () => {
    const entries = entryFiles();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((file) => file.endsWith("LiveLetter.tsx"))).toBe(true);
  });

  it("no static import, re-export or type import reaches the Simulated_Port module", () => {
    const walk = walkStatic(entryFiles());
    expect(walk.reached.size).toBeGreaterThan(0);
    expect(walk.staticHits).toEqual([]);
  });

  it("no reached file calls import() on the Simulated_Port module path", () => {
    const walk = walkStatic(entryFiles());
    expect(walk.dynamicHits).toEqual([]);
  });
});
