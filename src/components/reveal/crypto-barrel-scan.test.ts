// Source scan (design.md "The first-async-step rule and crypto preload"):
// `src/lib/crypto` is imported dynamically by exactly two files under
// src/components, `live/useCryptoModule.ts` and `reveal/useOpeningFlow.ts`.
//
// The import-boundary test already forbids a STATIC import of the crypto
// library. This scan covers the other half: among the dynamic `import()` calls
// under src/components, only those two files may load the crypto barrel
// (`src/lib/crypto/index.ts`, spelled `@/lib/crypto`). A type-only
// `typeof import("@/lib/crypto")` (live/crypto-module.ts) runs nothing and is
// not counted. Sub-modules such as `@/lib/crypto/passkey` are not the barrel and
// are not counted either.
//
// Test files are skipped: several existing tests load the barrel dynamically to
// build fixtures, and they never ship to the browser. The scan covers production
// source only.
//
// The scan reads source text. It seeds from a non-empty file set, so it cannot
// pass by scanning nothing.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "..", "..");
const componentsRoot = join(srcRoot, "components");
const barrelFile = join(srcRoot, "lib", "crypto", "index.ts");

/** Every production .ts/.tsx file under `dir`: no fixtures, no test files. */
function collect(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__fixtures__") continue;
      out.push(...collect(full));
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** The specifiers of runtime dynamic `import("x")` calls. `typeof import("x")` is skipped. */
function dynamicSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const re = /(?<!typeof\s+)import\s*\(\s*["']([^"']+)["']\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) specs.push(m[1]);
  return specs;
}

/** True when a specifier names the crypto barrel, by alias or by relative path. */
function namesBarrel(spec: string, fromFile: string): boolean {
  if (spec === "@/lib/crypto") return true;
  const base = spec.startsWith("@/")
    ? resolve(srcRoot, spec.slice(2))
    : spec.startsWith(".")
      ? resolve(dirname(fromFile), spec)
      : null;
  if (base === null) return false;
  const candidates = [base, join(base, "index.ts"), join(base, "index.tsx")];
  return candidates.some(
    (c) => c === barrelFile && existsSync(c) && statSync(c).isFile(),
  );
}

describe("crypto barrel: only two src/components files import it dynamically", () => {
  const files = collect(componentsRoot);

  it("seeds from a non-empty set of component files", () => {
    expect(files.length).toBeGreaterThan(0);
    expect(existsSync(barrelFile)).toBe(true);
  });

  it("the dynamic importers are exactly live/useCryptoModule.ts and reveal/useOpeningFlow.ts", () => {
    const importers = new Set<string>();
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (dynamicSpecifiers(source).some((s) => namesBarrel(s, file))) {
        importers.add(relative(componentsRoot, file));
      }
    }
    expect([...importers].sort()).toEqual([
      join("live", "useCryptoModule.ts"),
      join("reveal", "useOpeningFlow.ts"),
    ]);
  });

  it("the type-only typeof form in live/crypto-module.ts is not counted as an import", () => {
    const cryptoModule = join(componentsRoot, "live", "crypto-module.ts");
    const source = readFileSync(cryptoModule, "utf8");
    expect(source).toContain('typeof import("@/lib/crypto")');
    expect(dynamicSpecifiers(source)).toEqual([]);
  });
});
