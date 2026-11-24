// Import scan: no client module may read the feature flags. feature-flags.ts
// imports `server-only`, so a client bundle that loads it fails the build. This
// scan walks every file under src/ and fails when a file whose first statement
// is "use client" imports @/lib/feature-flags, or a relative path that resolves
// to it. Only node built-ins are used.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("../", import.meta.url));
const FLAGS_MODULE = path.join(SRC, "lib", "feature-flags");
const ALIAS_MODULE = "@/lib/feature-flags";
const CLIENT_DIRECTIVE = /^\s*["']use client["']/;

// Matches module specifiers in static imports and re-exports, dynamic
// import() calls and side-effect imports.
const SPECIFIER_PATTERNS = [
  /\b(?:import|export)\s[^;]*?\bfrom\s*["']([^"']+)["']/g,
  /\bimport\s*["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function relative(file: string): string {
  return path.relative(SRC, file).split(path.sep).join("/");
}

function isClientModule(text: string): boolean {
  return CLIENT_DIRECTIVE.test(text);
}

function specifiers(text: string): string[] {
  const found: string[] = [];
  for (const pattern of SPECIFIER_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      found.push(match[1]);
    }
  }
  return found;
}

function importsFeatureFlags(file: string, text: string): boolean {
  return specifiers(text).some((spec) => {
    if (spec === ALIAS_MODULE) return true;
    if (!spec.startsWith(".")) return false;
    const resolved = path.resolve(path.dirname(file), spec);
    return resolved.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, "") === FLAGS_MODULE;
  });
}

const ALL_FILES = sourceFiles(SRC);
const CLIENT_FILES = ALL_FILES.filter((file) =>
  isClientModule(readFileSync(file, "utf8")),
);

describe("client modules do not import feature flags", () => {
  it("finds client modules to scan, including app/error.tsx", () => {
    expect(CLIENT_FILES.length).toBeGreaterThan(0);
    expect(CLIENT_FILES.map(relative)).toContain("app/error.tsx");
  });

  it("no file with a use client directive imports @/lib/feature-flags", () => {
    const hits = CLIENT_FILES.filter((file) =>
      importsFeatureFlags(file, readFileSync(file, "utf8")),
    ).map(relative);
    expect(hits).toEqual([]);
  });
});
