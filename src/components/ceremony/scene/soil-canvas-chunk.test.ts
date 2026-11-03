// Feature: 07-judge-journey (spec 07 task 4)
//
// The Soil_Canvas chunk stays out of every route's first-load JavaScript
// (R6.12, R19.5). Next puts a statically imported module into the page chunk,
// and a dynamically imported one into its own lazily fetched chunk. So the
// check is that soil-canvas is reached only by dynamic import() from one place,
// and that no static import of it exists anywhere under src. The real build
// manifest is checked in the browser step of the ticket.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "..", "..", "..");

function collect(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collect(full));
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** The source text with comments removed, so a doc comment does not count. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** Matches an import of the canvas module, static or dynamic, through `./soil-canvas`. */
const CANVAS_SPEC = /["'](?:\.\/|\.\.\/(?:scene\/)?|@\/components\/ceremony\/scene\/)soil-canvas["']/;

describe("the Soil_Canvas chunk is not in the first-load JavaScript", () => {
  const files = collect(srcRoot);

  it("has source files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("no source file statically imports soil-canvas (type-only imports are erased)", () => {
    const violations: string[] = [];
    for (const file of files) {
      const code = codeOnly(readFileSync(file, "utf8"));
      const staticImport = /(^|\n)\s*import\s+(?!type\b)[^;]*?from\s*["'][^"']*soil-canvas["']/g;
      const bare = /(^|\n)\s*import\s*["'][^"']*soil-canvas["']/g;
      if (staticImport.test(code) || bare.test(code)) {
        violations.push(file.slice(srcRoot.length + 1));
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("soil-canvas is loaded by exactly one dynamic import(), in SoilCanvasLoader", () => {
    const dynamic: string[] = [];
    for (const file of files) {
      const code = codeOnly(readFileSync(file, "utf8"));
      const re = /import\s*\(\s*(["'][^"']+["'])\s*\)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(code)) !== null) {
        if (CANVAS_SPEC.test(m[1])) {
          dynamic.push(file.slice(srcRoot.length + 1));
        }
      }
    }
    expect(dynamic).toEqual([
      "components/ceremony/scene/SoilCanvasLoader.tsx",
    ]);
  });

  it("the loader keeps the import inside the full-motion path, not at module scope", () => {
    const loader = readFileSync(join(here, "SoilCanvasLoader.tsx"), "utf8");
    const code = codeOnly(loader);
    const importAt = code.indexOf('import("./soil-canvas")');
    const effectAt = code.indexOf("useEffect(");
    expect(importAt).toBeGreaterThan(effectAt);
  });
});
