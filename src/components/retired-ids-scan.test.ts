import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import * as brandCopy from "./brand/copy";
import * as ceremonyCopy from "./ceremony/copy";
import * as demoCopy from "./demo/copy";
import * as howCopy from "./how/copy";
import * as landingCopy from "./landing/copy";
import * as liveCopy from "./live/copy";
import * as revealCopy from "./reveal/copy";
import * as sceneCopy from "./ceremony/scene/copy";
import * as uiCopy from "./ui/copy";

/**
 * Two guards for spec 10 group E (issue #312).
 *
 * 1. Retired persona letter IDs. The IDs listed as `retired_letter_ids` in the
 *    Persona_List (content/personas/personas.json) must not appear in any
 *    non-test file under src/ or content/, other than the Persona_List itself.
 *    The two IDs checked here are the ones named in the E1 ticket. Every ID in
 *    the list is checked, so a future retirement is covered too.
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
const SCANNED_ROOTS = ["src", "content"];
const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".txt",
  ".md",
  ".css",
  ".html",
  ".svg",
  ".yaml",
  ".yml",
  ".sql",
]);

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

function extensionOf(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot);
}

function readPersonaList(): { retired: string[] } {
  const parsed = JSON.parse(readFileSync(join(PROJECT_ROOT, PERSONA_LIST), "utf8")) as {
    retired_letter_ids?: unknown;
  };
  if (!Array.isArray(parsed.retired_letter_ids)) {
    throw new Error(`${PERSONA_LIST} has no retired_letter_ids array`);
  }
  return { retired: parsed.retired_letter_ids.map(String) };
}

describe("retired persona letter IDs", () => {
  const { retired } = readPersonaList();

  it("lists the two IDs the E1 ticket names", () => {
    expect(retired).toEqual(
      expect.arrayContaining(["ydsos6hcjdEUOs3sK42RQg", "8t6Bz4bWlaUky-byt1mzGg"]),
    );
  });

  it("appears in no non-test file under src/ or content/ except the Persona_List", () => {
    const files = SCANNED_ROOTS.flatMap((root) => walk(join(PROJECT_ROOT, root))).filter(
      (path) =>
        path !== PERSONA_LIST &&
        TEXT_EXTENSIONS.has(extensionOf(path)) &&
        !TEST_FILE.test(path),
    );

    // Guard against a vacuous pass: the scan must read real source files.
    expect(files.length).toBeGreaterThan(100);

    const hits: string[] = [];
    for (const path of files) {
      const text = readFileSync(join(PROJECT_ROOT, path), "utf8");
      for (const id of retired) {
        if (text.includes(id)) hits.push(`${path} contains retired ID ${id}`);
      }
    }
    expect(hits).toEqual([]);
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
