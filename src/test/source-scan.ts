import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Shared source scan for the framing tests (spec 09, F8 and F2.4). It reads
 * the non-test files under the given roots. Test code, test data and fixtures
 * are skipped, so the phrases that tests assert on never count as copy.
 */

/** The repository root, found from this file (src/test/ is two levels down). */
export const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** Folders whose contents are test data and never user-facing copy. */
const SKIPPED_DIR_NAMES = new Set(["__fixtures__", "__recorded__", "node_modules"]);

export interface SourceFile {
  /** Path relative to the repository root, with forward slashes. */
  path: string;
  text: string;
}

function isTestFile(name: string): boolean {
  return /\.(test|spec)\.(ts|tsx)$/.test(name);
}

function walk(dirAbs: string, out: string[]): void {
  for (const entry of readdirSync(dirAbs, { withFileTypes: true })) {
    const abs = join(dirAbs, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIR_NAMES.has(entry.name)) walk(abs, out);
      continue;
    }
    if (entry.isFile()) out.push(abs);
  }
}

/**
 * Reads every non-test file with one of `extensions` under `roots` (paths
 * relative to the repository root). Files under `src/test/` are excluded:
 * that folder holds the tests themselves.
 */
export function readSourceFiles(
  roots: readonly string[],
  extensions: readonly string[],
): SourceFile[] {
  const files: string[] = [];
  for (const root of roots) walk(join(REPO_ROOT, root), files);

  return files
    .map((abs) => ({ abs, rel: relative(REPO_ROOT, abs).split(sep).join("/") }))
    .filter(({ abs, rel }) => {
      const name = rel.split("/").pop() ?? "";
      return (
        extensions.includes(extname(abs)) &&
        !isTestFile(name) &&
        !rel.startsWith("src/test/")
      );
    })
    .map(({ abs, rel }) => ({ path: rel, text: readFileSync(abs, "utf8") }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/** The 1-based line number of a character offset in `text`. */
export function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}
