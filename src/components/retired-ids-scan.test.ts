
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { RETIRED_LETTER_IDS } from "../lib/personas";
import * as brandCopy from "./brand/copy";
import * as ceremonyCopy from "./ceremony/copy";
import * as demoCopy from "./demo/copy";
import * as howCopy from "./how/copy";
import * as landingCopy from "./landing/copy";
import * as liveCopy from "./live/copy";
import * as deskCopy from "./live/desk/copy";
import * as pressCopy from "./live/press/copy";
import * as revealCopy from "./reveal/copy";
import * as sceneCopy from "./ceremony/scene/copy";
import * as uiCopy from "./ui/copy";

/**
 * Two guards for spec 10 group E (issue #312).
 *
 * 1. Retired persona letter IDs. Every ID in RETIRED_LETTER_IDS (the
 *    `retired_letter_ids` of content/personas/personas.json) must not appear
 *    in any tracked file, except the Persona_List itself and the specs under
 *    .kiro/specs/. The scan reads the list from RETIRED_LETTER_IDS and the file
 *    list from `git ls-files`. If git is unavailable the test fails.
 *
 * 2. Copy wording. Every copy module under src/components must avoid the
 *    claims that the E1 audit removed. Each pattern below matches a decision
 *    recorded in the audit commit (5057d1f) and in the spec 10 plan:
 *    - Fixture figures are not real. Persona and demo figures include fixture
 *      data (src/lib/figures/demo/us-fuel.fixture.json), so "real fuel prices"
 *      overstates them.
 *    - A 30-second demo letter is not a real sealed letter (data-integrity.md
 *      keeps demo letters apart from real sealed letters).
 *    - Real sealing is off until the 20 November 2026 go/no-go, so no visitor
 *      copy may promise a date at least three months away. REAL_COPY is the
 *      copy for the real-date branch of the seal form, which shows only when a
 *      visitor picks a real date. It is not scanned here.
 */

const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PERSONA_LIST = "content/personas/personas.json";
const SPECS_DIR = ".kiro/specs/";

const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

function toPosix(path: string): string {
  return path.split(sep).join("/");
}

/** Every file under `dir`, as project-relative POSIX paths. */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(toPosix(relative(PROJECT_ROOT, full)));
    }
  }
  return out;
}

/** Tracked files from git. Throws when git is unavailable or fails. */
function trackedFiles(): string[] {
  const out = execFileSync("git", ["ls-files", "-z"], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  return out.split("\0").filter((path) => path.length > 0);
}

interface ScannedFile {
  path: string;
  text: string;
}

/** Each retired ID found in a file outside the exempt paths, naming the file. */
function findRetiredIdHits(files: readonly ScannedFile[], ids: readonly string[]): string[] {
  const hits: string[] = [];
  for (const { path, text } of files) {
    if (path === PERSONA_LIST || path.startsWith(SPECS_DIR)) continue;
    for (const id of ids) {
      if (text.includes(id)) hits.push(`${path} contains retired ID ${id}`);
    }
  }
  return hits;
}

describe("retired persona letter IDs", () => {
  it("reads the retired IDs from RETIRED_LETTER_IDS", () => {
    expect(RETIRED_LETTER_IDS.length).toBeGreaterThan(0);
    expect(RETIRED_LETTER_IDS.every((id) => id.length > 0)).toBe(true);
  });

  it("appears in no tracked file outside the Persona_List and .kiro/specs/", () => {
    const files = trackedFiles();

    // Guard against a vacuous pass: the scan must see the real repository.
    expect(files.length).toBeGreaterThan(100);

    const scanned: ScannedFile[] = files.map((path) => ({
      path,
      text: readFileSync(join(PROJECT_ROOT, path), "utf8"),
    }));
    expect(findRetiredIdHits(scanned, RETIRED_LETTER_IDS)).toEqual([]);
  });

  it("fails when a retired ID is planted in a tracked file under src/", () => {
    const planted = "src/components/planted-retired-id.ts";
    const clean = "src/components/clean-file.ts";
    const id = RETIRED_LETTER_IDS[0];
    const tracked: ScannedFile[] = [
      { path: clean, text: `export const NOTHING = "plain text";` },
      { path: planted, text: `export const LETTER = "${id}";` },
    ];
    const hits = findRetiredIdHits(tracked, RETIRED_LETTER_IDS);
    expect(hits).toEqual([`${planted} contains retired ID ${id}`]);
  });
});

/** Copy modules by project-relative path, so a new copy.ts must be added here. */
const COPY_MODULES: Record<string, Record<string, unknown>> = {
  "src/components/brand/copy.ts": brandCopy,
  "src/components/ceremony/copy.ts": ceremonyCopy,
  "src/components/ceremony/scene/copy.ts": sceneCopy,
  "src/components/demo/copy.ts": demoCopy,
  "src/components/how/copy.ts": howCopy,
  "src/components/landing/copy.ts": landingCopy,
  "src/components/live/copy.ts": liveCopy,
  "src/components/live/desk/copy.ts": deskCopy,
  "src/components/live/press/copy.ts": pressCopy,
  "src/components/reveal/copy.ts": revealCopy,
  "src/components/ui/copy.ts": uiCopy,
};

/** Keys whose strings are not visitor copy on the open pages. */
const SKIPPED_EXPORTS = new Set(["REAL_COPY"]);

interface UnsafeWording {
  name: string;
  pattern: RegExp;
  reason: string;
}

const UNSAFE_WORDING: readonly UnsafeWording[] = [
  {
    name: "a real-price claim",
    pattern: /\breal (fuel|gas|grocery|groceries|rent)\b/i,
    reason: "fixture figures are not real prices (E1 audit, 5057d1f)",
  },
  {
    name: "a demo letter called real",
    pattern: /\breal sealed letter\b/i,
    reason: "a 30-second demo letter is not a real sealed letter (data-integrity.md)",
  },
  {
    name: "a promised opening date at least three months away",
    pattern: /\bthree months away\b/i,
    reason: "real sealing is off until the 20 November 2026 go/no-go",
  },
];

interface CopyString {
  path: string;
  text: string;
}

function collectStrings(value: unknown, path: string, out: CopyString[]): void {
  if (typeof value === "string") {
    out.push({ path, text: value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectStrings(item, `${path}[${index}]`, out));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      collectStrings(item, `${path}.${key}`, out);
    }
  }
}

function copyStrings(): CopyString[] {
  const out: CopyString[] = [];
  for (const [file, module] of Object.entries(COPY_MODULES)) {
    for (const [exportName, value] of Object.entries(module)) {
      if (SKIPPED_EXPORTS.has(exportName)) continue;
      collectStrings(value, `${file}:${exportName}`, out);
    }
  }
  return out;
}

describe("copy wording", () => {
  it("covers every copy.ts module under src/components", () => {
    const onDisk = walk(join(PROJECT_ROOT, "src/components"))
      .filter((path) => /\/copy\.ts$/.test(path) && !TEST_FILE.test(path))
      .sort();
    expect(onDisk).toEqual(Object.keys(COPY_MODULES).sort());
  });

  it("reads real strings from the copy modules", () => {
    expect(copyStrings().length).toBeGreaterThan(50);
  });

  it("contains none of the unsafe wording the E1 audit removed", () => {
    const hits: string[] = [];
    for (const { path, text } of copyStrings()) {
      for (const rule of UNSAFE_WORDING) {
        if (rule.pattern.test(text)) {
          hits.push(`${path}: ${rule.name} (${rule.reason}): "${text}"`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
