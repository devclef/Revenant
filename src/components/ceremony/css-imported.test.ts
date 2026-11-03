// Every CSS module under src/ must be imported by a non-test file, or none of
// its rules ship (spec 05 #107: DeskScene.module.css was never imported).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(__dirname, "../..");
const REPO = resolve(SRC, "..");

/**
 * CSS modules that may exist before anything imports them. Each entry is a
 * repo-relative path with the reason it is allowed to stay unused. An entry
 * must be removed as soon as a non-test file imports the module, which the
 * test below enforces.
 */
const NOT_IMPORTED_YET: Record<string, string> = {
  "src/components/ceremony/scene/tokens.module.css":
    "Scene colour tokens. SceneShell imports them in spec 07 task 2.",
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe("CSS modules", () => {
  it("are each imported by at least one non-test file", () => {
    const files = walk(SRC);
    const modules = files.filter((f) => f.endsWith(".module.css"));
    const sources = files
      .filter((f) => /\.(ts|tsx|mjs|js)$/.test(f) && !/\.test\.[tj]sx?$/.test(f))
      .map((f) => readFileSync(f, "utf8"));
    expect(modules.length).toBeGreaterThan(0);
    const isImported = (m: string) => {
      const name = basename(m);
      return sources.some((s) => s.includes(`/${name}"`) || s.includes(`./${name}'`) || s.includes(`/${name}'`));
    };
    const rel = (m: string) => relative(REPO, m).split("\\").join("/");
    const unused = modules
      .filter((m) => !isImported(m))
      .filter((m) => !(rel(m) in NOT_IMPORTED_YET))
      .map(rel);
    expect(unused).toEqual([]);
  });

  it("exempt modules are still unused, so their entries get removed on import", () => {
    const files = walk(SRC);
    const sources = files
      .filter((f) => /\.(ts|tsx|mjs|js)$/.test(f) && !/\.test\.[tj]sx?$/.test(f))
      .map((f) => readFileSync(f, "utf8"));
    for (const path of Object.keys(NOT_IMPORTED_YET)) {
      const abs = resolve(REPO, path);
      expect(statSync(abs).isFile(), `${path} must exist`).toBe(true);
      const name = basename(abs);
      const imported = sources.some((s) => s.includes(`/${name}"`) || s.includes(`./${name}'`) || s.includes(`/${name}'`));
      expect(imported, `${path} is imported now; remove its NOT_IMPORTED_YET entry`).toBe(false);
    }
  });
});
