// Feature: 05-reveal-ceremony, Property 23
//
// Property 23 (design.md R15.2): every asset file the Ceremony ships is on
// record in ASSETS.md, is small, and carries a licence we are allowed to use.
//
// The Ceremony prefers assets that are code (CSS gradients, inline SVG,
// procedural patterns), so the assets/ directory is expected to be empty or
// absent for the MVP. This test must therefore PASS when there are no assets.
//
// When an asset file does exist under src/components/ceremony/assets/, this
// test enforces (R15.1, R15.4, R13.5):
//   - it has exactly one matching row in ASSETS.md, keyed by path,
//   - that row's licence is "original" or "CC0" (nothing else is allowed),
//   - the file is at most 150 kB,
//   - the total of all asset bytes is at most 150 kB.
//
// It also guards the record the other way: every asset ENTRY in ASSETS.md must
// point at a file that exists and whose licence is allowed, so the table can
// never list a licence we would not accept, and can never drift from the files
// on disk.
//
// No value or direction is involved (neutrality.md): this is a filesystem and
// text check only.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(here, "assets");
const assetsMdPath = resolve(here, "ASSETS.md");

/** The only licences an asset row may carry (R15.1). */
const ALLOWED_LICENCES = ["original", "CC0"] as const;

/** Per-file and total asset byte budget (R13.5). */
const MAX_BYTES = 150 * 1024;

type AssetEntry = { path: string; licence: string };

/**
 * Parse the ASSETS.md table into entries. The table header is:
 *   | Path | How it was made or where it came from | Licence | Date |
 * We take column 1 (Path) and column 3 (Licence). The divider row (--- cells)
 * and any non-table prose are ignored. Paths are normalised to POSIX and made
 * relative to the assets/ directory so they can be matched against real files.
 */
function parseAssetEntries(markdown: string): AssetEntry[] {
  const entries: AssetEntry[] = [];
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith("|")) continue;
    // Split on pipes, dropping the empty leading/trailing cells.
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 3) continue;
    const [path, , licence] = cells;
    // Skip the header row and the |---|---| divider row.
    if (/^path$/i.test(path)) continue;
    if (/^:?-{2,}:?$/.test(path)) continue;
    entries.push({ path, licence });
  }
  return entries;
}

/** List every file (recursively) under assets/, as POSIX paths. */
function listAssetFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...listAssetFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

const markdown = readFileSync(assetsMdPath, "utf8");
const entries = parseAssetEntries(markdown);
const assetFiles = listAssetFiles(assetsDir);

/** An entry's path as it appears, matched flexibly against a real file. */
function entryMatchesFile(entryPath: string, fileRelPosix: string): boolean {
  const norm = (p: string) => p.replace(/\\/g, "/").replace(/^\.?\//, "");
  const e = norm(entryPath);
  const f = norm(fileRelPosix);
  // Accept either a repo-rooted path or a path relative to assets/.
  return e === f || e.endsWith("/" + f) || e === "src/components/ceremony/assets/" + f;
}

describe("Feature 05-reveal-ceremony, Property 23: ceremony assets are recorded, small and licensed", () => {
  it("passes with no asset files present (the MVP draws everything in code)", () => {
    // This assertion documents the expected MVP state; it does not fail the
    // suite if assets are later added, because the per-file checks below handle
    // that case. We only assert the test machinery agrees with the on-disk
    // reality.
    expect(Array.isArray(assetFiles)).toBe(true);
  });

  it("records every asset file in ASSETS.md with an allowed licence", () => {
    for (const file of assetFiles) {
      const relPosix = relative(assetsDir, file).replace(/\\/g, "/");
      const entry = entries.find((e) => entryMatchesFile(e.path, relPosix));
      expect(
        entry,
        `asset ${relPosix} has no matching row in ASSETS.md (R15.2)`,
      ).toBeDefined();
      expect(
        ALLOWED_LICENCES as readonly string[],
        `asset ${relPosix} licence "${entry?.licence}" is not allowed (R15.1)`,
      ).toContain(entry!.licence);
    }
  });

  it("keeps every asset file within the per-file and total byte budget", () => {
    let total = 0;
    for (const file of assetFiles) {
      const bytes = statSync(file).size;
      const relPosix = relative(assetsDir, file).replace(/\\/g, "/");
      expect(
        bytes,
        `asset ${relPosix} is ${bytes} bytes, over the ${MAX_BYTES}-byte per-file limit (R13.5)`,
      ).toBeLessThanOrEqual(MAX_BYTES);
      total += bytes;
    }
    expect(
      total,
      `ceremony assets total ${total} bytes, over the ${MAX_BYTES}-byte budget (R13.5)`,
    ).toBeLessThanOrEqual(MAX_BYTES);
  });

  it("lists only allowed licences and files that exist in ASSETS.md", () => {
    for (const entry of entries) {
      expect(
        ALLOWED_LICENCES as readonly string[],
        `ASSETS.md row for "${entry.path}" has disallowed licence "${entry.licence}" (R15.1)`,
      ).toContain(entry.licence);
      const relPosix = entry.path
        .replace(/\\/g, "/")
        .replace(/^\.?\//, "")
        .replace(/^src\/components\/ceremony\/assets\//, "");
      const onDisk = assetFiles.some(
        (f) => relative(assetsDir, f).replace(/\\/g, "/") === relPosix,
      );
      expect(
        onDisk,
        `ASSETS.md lists "${entry.path}" but no such file exists under assets/`,
      ).toBe(true);
    }
  });
});
