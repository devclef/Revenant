// Import-boundary and dependency guards for the data-source modules
// (04-real-figures). This keeps the dev-only data tools out of the product and
// keeps the Adapters neutral and side-effect free.
//
// Covered here, as far as they can be checked at task 1 (R6.7, R13.1, R13.2,
// R13.3):
//
//   - No non-test file under `src/` outside `src/lib/sources/**`, and no
//     `scripts/seal-personas*` file, imports `lib/sources` or `@e965/xlsx`.
//     So the Adapters and the spreadsheet parser stay out of the Next.js build
//     and the browser bundle, and out of the Sealing_Script (R6.7, R13.3).
//   - `@e965/xlsx` is NOT in `package.json` `dependencies`, and is the exact
//     string `"0.20.3"` (no range operator) in `devDependencies` (R13.1).
//   - `build`, `test`, `lint` and `typecheck` in `package.json` do not mention
//     `prefetch`, so the gate passes with the Prefetch_Script absent from the
//     build (R6.7).
//   - No file in `src/lib/sources` imports `@/lib/crypto`, `@/lib/db` or
//     `@/lib/letter-store`, reads `process.env`, or contains `console.`, so the
//     Adapters carry no secret, no logging and no app-internal dependency
//     (R13.2).
//
// The `scripts/prefetch*` half of the walk is added in task 5, not here.
//
// How the scan reads source: comments and string/template literals are stripped
// first with `stripCommentsAndStrings`, so a rule word that appears only in a
// doc comment (every source module documents "no process.env, no console")
// never trips a check. The checks then look at code, where a real import, a
// real `process.env` read or a real `console.` call would survive stripping.
//
// `*.test.ts` files are skipped throughout: a test legitimately imports the
// module under test, may import `@e965/xlsx` through `test-support/workbook.ts`,
// and the date-serial property test genuinely sets `process.env.TZ`. The
// boundary is about what ships, not about the tests that exercise it.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/** Repository root: this file is at `<root>/src/lib/sources/boundary.test.ts`. */
const ROOT = join(__dirname, "..", "..", "..");
const SRC_DIR = join(ROOT, "src");
const SOURCES_DIR = join(ROOT, "src", "lib", "sources");
const SCRIPTS_DIR = join(ROOT, "scripts");

/** A source file is a test file when its name ends in `.test.ts` / `.test.tsx`. */
function isTestFile(path: string): boolean {
  return path.endsWith(".test.ts") || path.endsWith(".test.tsx");
}

/** A TypeScript source file we scan (`.ts` or `.tsx`, excluding declarations). */
function isTsSource(path: string): boolean {
  return (
    (path.endsWith(".ts") || path.endsWith(".tsx")) && !path.endsWith(".d.ts")
  );
}

/** Recursively list every regular file under `dir`. */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

/** True when `path` is inside `src/lib/sources/`. */
function isUnderSources(path: string): boolean {
  const rel = relative(SOURCES_DIR, path);
  return !rel.startsWith("..") && !rel.includes("\0");
}

/**
 * Remove line comments, block comments and string/template literals from TS
 * source, leaving a string with the same length-ish shape but no commentary or
 * literal text. This is a small lexer, not a full parser: it tracks whether we
 * are inside `//`, `/* *\/`, `'...'`, `"..."` or a `` `...` `` template, and
 * blanks those spans. It is deliberately conservative — a forbidden construct
 * written in real code (`import ... from "@/lib/db"`, `process.env.X`,
 * `console.log(...)`) still survives as `import ... from ""`, `process.env.X`
 * and `console.log()` respectively, because only the quoted PATH is blanked,
 * not the `import`/`process.env`/`console.` that precedes it.
 */
function stripCommentsAndStrings(source: string): string {
  let out = "";
  let i = 0;
  const n = source.length;

  type Mode = "code" | "line" | "block" | "single" | "double" | "template";
  let mode: Mode = "code";

  while (i < n) {
    const c = source[i];
    const next = i + 1 < n ? source[i + 1] : "";

    if (mode === "code") {
      if (c === "/" && next === "/") {
        mode = "line";
        i += 2;
      } else if (c === "/" && next === "*") {
        mode = "block";
        i += 2;
      } else if (c === "'") {
        mode = "single";
        i += 1;
      } else if (c === '"') {
        mode = "double";
        i += 1;
      } else if (c === "`") {
        mode = "template";
        i += 1;
      } else {
        out += c;
        i += 1;
      }
      continue;
    }

    if (mode === "line") {
      if (c === "\n") {
        out += c;
        mode = "code";
      }
      i += 1;
      continue;
    }

    if (mode === "block") {
      if (c === "*" && next === "/") {
        mode = "code";
        i += 2;
      } else {
        // Preserve newlines so line-oriented checks keep their line numbers.
        if (c === "\n") {
          out += c;
        }
        i += 1;
      }
      continue;
    }

    // Inside a string or template: skip until the matching unescaped delimiter.
    if (c === "\\") {
      i += 2; // skip the escaped character
      continue;
    }
    if (
      (mode === "single" && c === "'") ||
      (mode === "double" && c === '"') ||
      (mode === "template" && c === "`")
    ) {
      mode = "code";
    }
    i += 1;
  }

  return out;
}

/**
 * Collect every module specifier a file imports or re-exports, from the RAW
 * source. Matches `import ... from "x"`, `export ... from "x"`, bare
 * `import "x"` and dynamic `import("x")` / `await import("x")`. String
 * delimiters may be single, double or backtick (no interpolation expected in a
 * specifier). Comments are stripped first so a specifier mentioned in prose is
 * not counted.
 */
function collectImportSpecifiers(rawSource: string): string[] {
  // Strip only comments (keep string literals, since the specifier IS a string
  // literal). A tiny second lexer: blank `//` and `/* */`, keep everything else.
  let code = "";
  let i = 0;
  const n = rawSource.length;
  let mode: "code" | "line" | "block" | "single" | "double" | "template" =
    "code";
  while (i < n) {
    const c = rawSource[i];
    const next = i + 1 < n ? rawSource[i + 1] : "";
    if (mode === "code") {
      if (c === "/" && next === "/") {
        mode = "line";
        i += 2;
        continue;
      }
      if (c === "/" && next === "*") {
        mode = "block";
        i += 2;
        continue;
      }
      if (c === "'") mode = "single";
      else if (c === '"') mode = "double";
      else if (c === "`") mode = "template";
      code += c;
      i += 1;
      continue;
    }
    if (mode === "line") {
      if (c === "\n") {
        code += c;
        mode = "code";
      }
      i += 1;
      continue;
    }
    if (mode === "block") {
      if (c === "*" && next === "/") {
        mode = "code";
        i += 2;
      } else {
        if (c === "\n") code += c;
        i += 1;
      }
      continue;
    }
    // inside a string/template: copy verbatim (handle escapes), watch for close
    if (c === "\\") {
      code += c + next;
      i += 2;
      continue;
    }
    if (
      (mode === "single" && c === "'") ||
      (mode === "double" && c === '"') ||
      (mode === "template" && c === "`")
    ) {
      mode = "code";
    }
    code += c;
    i += 1;
  }

  const specs: string[] = [];
  const patterns = [
    // `from "<spec>"` (import ... / export ... from)
    /\bfrom\s*["'`]([^"'`]+)["'`]/g,
    // bare `import "<spec>"`
    /\bimport\s*["'`]([^"'`]+)["'`]/g,
    // dynamic `import("<spec>")`
    /\bimport\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
    // `require("<spec>")`
    /\brequire\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
      specs.push(m[1]);
    }
  }
  return specs;
}

describe("import boundary: nothing outside src/lib/sources imports it", () => {
  // Non-test TS/TSX files under src/, excluding src/lib/sources/**.
  const srcFiles = walk(SRC_DIR).filter(
    (p) => isTsSource(p) && !isTestFile(p) && !isUnderSources(p),
  );

  // scripts/seal-personas* files (any extension).
  const sealScriptFiles = walk(SCRIPTS_DIR).filter((p) => {
    const base = p.slice(SCRIPTS_DIR.length + 1);
    return base.startsWith("seal-personas") && !isTestFile(p);
  });

  const guarded = [...srcFiles, ...sealScriptFiles];

  it("finds files to scan (the walk is wired up)", () => {
    // seal-personas scripts exist on this branch; src may legitimately have
    // non-sources files. At minimum the seal scripts must be found, so an
    // empty walk (a wiring bug) fails loudly instead of passing vacuously.
    expect(sealScriptFiles.length).toBeGreaterThan(0);
  });

  for (const file of guarded) {
    const rel = relative(ROOT, file);
    it(`${rel} does not import lib/sources or @e965/xlsx`, () => {
      const specs = collectImportSpecifiers(readFileSync(file, "utf8"));
      for (const spec of specs) {
        expect(
          spec.includes("lib/sources"),
          `${rel} imports "${spec}" which reaches lib/sources`,
        ).toBe(false);
        expect(
          spec.includes("@e965/xlsx"),
          `${rel} imports "${spec}" (@e965/xlsx must stay dev/test only)`,
        ).toBe(false);
      }
    });
  }
});

describe("package.json: @e965/xlsx is a pinned devDependency only (R13.1)", () => {
  const pkg = JSON.parse(
    readFileSync(join(ROOT, "package.json"), "utf8"),
  ) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };

  it("is not in dependencies", () => {
    expect(pkg.dependencies ?? {}).not.toHaveProperty("@e965/xlsx");
  });

  it('is the exact string "0.20.3" in devDependencies (no range operator)', () => {
    expect(pkg.devDependencies ?? {}).toHaveProperty("@e965/xlsx");
    expect((pkg.devDependencies ?? {})["@e965/xlsx"]).toBe("0.20.3");
  });
});

describe("package.json: the gate does not mention prefetch (R6.7)", () => {
  const pkg = JSON.parse(
    readFileSync(join(ROOT, "package.json"), "utf8"),
  ) as { scripts?: Record<string, string> };
  const scripts = pkg.scripts ?? {};

  for (const name of ["build", "test", "lint", "typecheck"] as const) {
    it(`"${name}" does not mention prefetch`, () => {
      const value = scripts[name] ?? "";
      expect(value.includes("prefetch")).toBe(false);
    });
  }
});

describe("src/lib/sources: no app-internal import, env read or logging (R13.2)", () => {
  const sourceFiles = walk(SOURCES_DIR).filter(
    (p) => isTsSource(p) && !isTestFile(p),
  );

  it("finds the source modules to scan", () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  const FORBIDDEN_IMPORTS = ["@/lib/crypto", "@/lib/db", "@/lib/letter-store"];

  for (const file of sourceFiles) {
    const rel = relative(ROOT, file);
    const raw = readFileSync(file, "utf8");
    const code = stripCommentsAndStrings(raw);

    it(`${rel} imports none of @/lib/crypto, @/lib/db, @/lib/letter-store`, () => {
      const specs = collectImportSpecifiers(raw);
      for (const spec of specs) {
        for (const forbidden of FORBIDDEN_IMPORTS) {
          expect(
            spec === forbidden || spec.startsWith(`${forbidden}/`),
            `${rel} imports "${spec}" (forbidden: ${forbidden})`,
          ).toBe(false);
        }
      }
    });

    it(`${rel} does not read process.env`, () => {
      expect(
        /\bprocess\s*\.\s*env\b/.test(code),
        `${rel} reads process.env in code`,
      ).toBe(false);
    });

    it(`${rel} contains no console. call`, () => {
      expect(
        /\bconsole\s*\./.test(code),
        `${rel} uses console. in code`,
      ).toBe(false);
    });
  }
});
