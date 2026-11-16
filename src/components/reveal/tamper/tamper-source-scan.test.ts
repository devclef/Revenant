// Feature: 13-the-seal, task 6.3 (spec 13, A2.3, A2.7, Q2.5, G1.6).
//
// Source scans for the tamper run. They read the files as text, so they check
// what the code says and not what it does at runtime. Each scan also has a
// positive control, so a pattern that matches nothing cannot pass by accident.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const TAMPER_DIR = "src/components/reveal/tamper";

/** The non-test source files of the tamper folder. */
const TAMPER_SOURCES = [
  "tamper-run.ts",
  "tamper-copy.ts",
  "TamperControl.tsx",
].map((name) => `${TAMPER_DIR}/${name}`);

function read(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

/** Every non-test .ts and .tsx file under a directory, as repo-relative paths. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) {
      out.push(...sourceFiles(rel));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      out.push(rel);
    }
  }
  return out;
}

describe("tamper-run.ts calls the real check (A2.3)", () => {
  const source = read(`${TAMPER_DIR}/tamper-run.ts`);

  it("imports openLetter from src/lib/crypto, through the dynamic import", () => {
    expect(source).toContain('import("@/lib/crypto/open")');
    expect(source).toMatch(
      /const \{ openLetter \} = await import\("@\/lib\/crypto\/open"\)/,
    );
  });

  it("calls openLetter, and holds no second copy of the check", () => {
    expect(source.match(/openLetter\(/g)?.length ?? 0).toBeGreaterThanOrEqual(
      1,
    );
    expect(source).not.toMatch(/\bfunction\s+openLetter\b/);
  });

  it("uses no verification_failed literal, so no result is written by hand", () => {
    expect(source).not.toContain("verification_failed");
  });

  it("holds no hand-written ok: true or ok: false result object", () => {
    // Comments may describe `OpenResult`, so they are removed before the scan.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/\bok:\s*(true|false)\b/);
  });
});

describe("the tamper folder has no timer and no request in place of the check (Q2.5)", () => {
  for (const file of TAMPER_SOURCES) {
    it(`${file} contains no setTimeout and no fetch call`, () => {
      const source = read(file);
      expect(source, `${file} must not use setTimeout`).not.toContain(
        "setTimeout",
      );
      expect(source, `${file} must not call fetch`).not.toMatch(/\bfetch\s*\(/);
    });
  }

  it("positive control: the fetch pattern matches a real fetch call", () => {
    expect("const x = await fetch(url);").toMatch(/\bfetch\s*\(/);
    expect("prefetchFigures()").not.toMatch(/\bfetch\s*\(/);
  });
});

describe("no server module imports reveal/tamper (G1.6)", () => {
  // Server modules: everything under src/lib and src/app/api, and any other
  // file that imports `server-only`. The components and the tamper folder are
  // browser code and are not scanned as server modules.
  const serverFiles = sourceFiles("src").filter(
    (f) =>
      f.startsWith("src/lib/") ||
      f.startsWith("src/app/api/") ||
      read(f).includes('"server-only"'),
  );

  // Matches an import path that names the tamper folder.
  const TAMPER_IMPORT = /["'][^"'\n]*\btamper\b[^"'\n]*["']/;

  it("finds the server modules to scan (not an empty set)", () => {
    expect(serverFiles.length).toBeGreaterThan(20);
  });

  it("no server module imports from reveal/tamper", () => {
    const offenders = serverFiles.filter((f) => TAMPER_IMPORT.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it("positive control: the import pattern matches the component that does import it", () => {
    expect(read("src/components/reveal/Reveal.tsx")).toMatch(TAMPER_IMPORT);
  });
});
