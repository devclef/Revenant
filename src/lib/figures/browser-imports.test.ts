// Import scan (X3): no browser file may read the bundled figure file or its
// lookup. Those are server-only fallback data (spec 08, Fallback_Refresh).
// The scan reads the source text of every browser file under src/ and fails
// when one names fuel-figures.json, bundled-latest or bundledLatestFigure.
//
// A browser file is one under src/components, src/lib/crypto, src/lib/cards or
// src/lib/ics, or any non-API file whose first statement is "use client". API
// route files under src/app/api are server code and are not scanned.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("../../", import.meta.url));
const FORBIDDEN = [
  "fuel-figures.json",
  "bundled-latest",
  "bundledLatestFigure",
];
const BROWSER_DIRS = ["components", "lib/crypto", "lib/cards", "lib/ics"];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.test\.tsx?$/.test(entry.name)
    ) {
      out.push(full);
    }
  }
  return out;
}

function relative(file: string): string {
  return path.relative(SRC, file).split(path.sep).join("/");
}

function isBrowserFile(file: string): boolean {
  const rel = relative(file);
  if (rel.startsWith("app/api/")) return false;
  if (BROWSER_DIRS.some((dir) => rel === dir || rel.startsWith(`${dir}/`))) {
    return true;
  }
  return /^\s*["']use client["']/m.test(readFileSync(file, "utf8"));
}

const ALL_FILES = sourceFiles(SRC);
const BROWSER_FILES = ALL_FILES.filter(isBrowserFile);

describe("browser import scan", () => {
  it("finds browser files to scan, including a use client file", () => {
    expect(BROWSER_FILES.length).toBeGreaterThan(0);
    expect(BROWSER_FILES.map(relative)).toContain("app/error.tsx");
  });

  it("no browser file imports fuel-figures.json or bundledLatestFigure", () => {
    const hits: string[] = [];
    for (const file of BROWSER_FILES) {
      const text = readFileSync(file, "utf8");
      for (const name of FORBIDDEN) {
        if (text.includes(name)) hits.push(`${relative(file)} names ${name}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
