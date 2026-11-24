import { readFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Real_Mode keeps the sealing modules out of the page's static import graph
 * (spec 19, requirement 5). SealPage, WriteForm and the copy modules must not
 * hold a static value import of the crypto, letter-store or feature-flag
 * modules. Type-only imports are allowed, since TypeScript erases them.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "../..");

const FORBIDDEN = ["lib/crypto", "lib/letter-store", "lib/feature-flags"].map(
  (p) => join(SRC, p),
);

const GUARDED_FILES = [
  join(HERE, "SealPage.tsx"),
  join(HERE, "WriteForm.tsx"),
  join(HERE, "copy.ts"),
  join(HERE, "press", "copy.ts"),
];

/** Removes block and line comments so commented-out code is not scanned. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

/** Returns the module specifiers of every static value import or re-export. */
export function staticValueSpecifiers(source: string): string[] {
  const text = stripComments(source);
  const found: string[] = [];
  const statement = /\b(import|export)\s+([\s\S]*?)\s*from\s*["']([^"']+)["']/g;
  for (const match of text.matchAll(statement)) {
    const clause = match[2].trim();
    if (clause.startsWith("type ") || clause === "type") continue;
    const braces = /^\{([\s\S]*)\}$/.exec(clause);
    if (braces) {
      const specifiers = braces[1]
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== "");
      if (
        specifiers.length > 0 &&
        specifiers.every((s) => s.startsWith("type "))
      ) {
        continue;
      }
    }
    found.push(match[3]);
  }
  const bare = /\bimport\s+["']([^"']+)["']/g;
  for (const match of text.matchAll(bare)) found.push(match[1]);
  return found;
}

/** Resolves an alias or relative specifier to an absolute path under src/. */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith("@/")) return join(SRC, specifier.slice(2));
  if (specifier.startsWith(".")) return resolve(dirname(fromFile), specifier);
  return null;
}

function isForbidden(target: string): boolean {
  return FORBIDDEN.some(
    (f) =>
      target === f ||
      target.startsWith(f + sep) ||
      target === f + ".ts" ||
      target === f + ".tsx" ||
      target === f + ".js",
  );
}

function violationsIn(file: string, source: string): string[] {
  return staticValueSpecifiers(source).filter((spec) => {
    const target = resolveSpecifier(file, spec);
    return target !== null && isForbidden(target);
  });
}

describe("seal page import boundary", () => {
  it.each(GUARDED_FILES.map((f) => [f]))(
    "%s has no static value import of a forbidden module",
    (file) => {
      const source = readFileSync(file, "utf8");
      expect(violationsIn(file, source)).toEqual([]);
    },
  );

  it("the scanner catches aliased, relative and re-export forms", () => {
    const file = join(SRC, "components", "live", "x.tsx");
    const source = [
      'import { createHash } from "@/lib/crypto";',
      'import { flag } from "../../lib/feature-flags";',
      'export { store } from "@/lib/letter-store";',
    ].join("\n");
    expect(violationsIn(file, source)).toHaveLength(3);
  });

  it("the scanner ignores type-only imports and commented code", () => {
    const file = join(SRC, "components", "live", "x.tsx");
    const source = [
      'import type { Key } from "@/lib/crypto";',
      'import { type Flag } from "@/lib/feature-flags";',
      '// import { x } from "@/lib/crypto";',
      'import { LIVE_COPY } from "./copy";',
    ].join("\n");
    expect(violationsIn(file, source)).toEqual([]);
  });
});
