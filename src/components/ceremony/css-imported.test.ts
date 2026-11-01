// Every CSS module under src/ must be imported by a non-test file, or none of
// its rules ship (spec 05 #107: DeskScene.module.css was never imported).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(__dirname, "../..");

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
    const unused = modules.filter((m) => {
      const name = basename(m);
      return !sources.some((s) => s.includes(`/${name}"`) || s.includes(`./${name}'`) || s.includes(`/${name}'`));
    });
    expect(unused).toEqual([]);
  });
});
