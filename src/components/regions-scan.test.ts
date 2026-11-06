import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Scans user-facing copy for Swedish-region wording that the MVP must not show
// outside the Sweden region. The scan reads only the files listed below. It
// never reads test files, __recorded__ fixtures or guard lists.

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const COMPONENTS_DIR = join(ROOT, "src", "components");

const BANNED_CASE_INSENSITIVE = ["Swed", "SCB", "sv-SE"];
const BANNED_WHOLE_WORD = /\bSEK\b/i;

function findCopyModules(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...findCopyModules(full));
    } else if (entry.isFile() && entry.name === "copy.ts") {
      found.push(full);
    }
  }
  return found.sort();
}

const SCANNED_FILES = [
  join(ROOT, "README.md"),
  ...findCopyModules(COMPONENTS_DIR),
  join(ROOT, "src", "app", "how-it-is-sealed", "page.tsx"),
  join(ROOT, "src", "lib", "figures", "catalogue.ts"),
  join(ROOT, "src", "lib", "figures", "locale.ts"),
  join(ROOT, "src", "lib", "figures", "format-change.ts"),
];

type Match = { file: string; line: number; text: string; term: string };

function scanFile(file: string): Match[] {
  const matches: Match[] = [];
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((text, index) => {
    for (const term of BANNED_CASE_INSENSITIVE) {
      if (text.toLowerCase().includes(term.toLowerCase())) {
        matches.push({ file, line: index + 1, text: text.trim(), term });
      }
    }
    const whole = BANNED_WHOLE_WORD.exec(text);
    if (whole) {
      matches.push({ file, line: index + 1, text: text.trim(), term: whole[0] });
    }
  });
  return matches;
}

function describeMatches(matches: Match[]): string {
  return matches
    .map((m) => `${relative(ROOT, m.file)}:${m.line} matches "${m.term}": ${m.text}`)
    .join("\n");
}

describe("regions scan: no Swedish-region wording in scanned copy", () => {
  it("scans every expected file", () => {
    for (const file of SCANNED_FILES) {
      expect(() => readFileSync(file, "utf8")).not.toThrow();
    }
  });

  it("finds no banned term in README, copy modules, the how-it-is-sealed page or the figures modules", () => {
    const matches = SCANNED_FILES.flatMap(scanFile);
    expect(matches, describeMatches(matches)).toEqual([]);
  });
});
