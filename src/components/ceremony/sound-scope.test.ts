// Feature: 07-judge-journey, R22.4 and R22.5: no spec 07 code calls the sound
// code or the browser's vibration API.
//
// Sound and vibration are spec 05 R14 behaviour, and the Seal_Break is the one
// place they play. So the scan works from an allowlist: the files that already
// wire the break cue and the sound toggle may import the sound code. Every other
// non-test source file under the Ceremony, reveal and demo trees must not. The
// ground shake and the Emergence live in files that are not on the allowlist,
// so they are covered by this test (R9.15, R22.5).
//
// The scan reads source text after blanking comments, so a doc comment that
// names `navigator.vibrate` does not trip it.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
// src/components/ceremony -> src
const srcRoot = resolve(here, "..", "..");
const ROOTS = [
  join(srcRoot, "components", "ceremony"),
  join(srcRoot, "components", "reveal"),
  join(srcRoot, "components", "demo"),
  join(srcRoot, "app"),
];

/**
 * Files that may import the sound code, with the reason. The sound folder
 * itself is excluded from the scan, because it is the sound code.
 */
const ALLOWED_SOUND_CALLERS: ReadonlyMap<string, string> = new Map([
  ["components/ceremony/CeremonyRoot.tsx", "spec 05 R14.1: holds the toggle state and fires the toggle cue"],
  ["components/ceremony/seal/useSealBreak.ts", "spec 05 R14.2: fires the Seal_Break cue"],
  ["components/ceremony/seal/SealBreak.tsx", "spec 05 R14.2: reads the sound toggle context for the break"],
  ["components/reveal/Reveal.tsx", "spec 05 R14: the reveal's toggle and break cues"],
  ["components/ceremony/scene/TopBar.tsx", "spec 09 C4.4: the Top_Bar sound toggle between Calm and Skip (persona page)"],
  ["components/ceremony/scene/SceneShell.tsx", "spec 09 C4.4: holds the sound state and provides SoundEnabledContext above the persona page"],
]);

const isTest = (name: string): boolean => /\.(test|spec)\.tsx?$/.test(name);
const isSource = (name: string): boolean => /\.tsx?$/.test(name) && !isTest(name);

function collect(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "sound" || entry.name === "__fixtures__") continue;
      out.push(...collect(full));
    } else if (isSource(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Blank block and line comments, keeping line numbers and string literals. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
}

const relPath = (file: string): string =>
  relative(srcRoot, file).split("\\").join("/");

/** True when the code imports or requires the sound folder. */
const importsSound = (code: string): boolean =>
  /(?:from|import)\s*\(?\s*["'][^"']*\/sound\/[^"']*["']/.test(code) ||
  /(?:from|import)\s*\(?\s*["']@\/components\/ceremony\/sound[^"']*["']/.test(code);

/** True when the code calls the browser's vibration API. */
const callsVibrate = (code: string): boolean =>
  /\bnavigator\s*\.\s*vibrate\b/.test(code) || /\.\s*vibrate\s*\(/.test(code);

const files = ROOTS.flatMap((root) => collect(root));

describe("spec 07 code does not call sound or vibration (R22.4, R22.5)", () => {
  it("scans a non-empty set of source files, so the scan cannot pass vacuously", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("only the allowlisted files import the sound code", () => {
    const violations: string[] = [];
    for (const file of files) {
      const rel = relPath(file);
      if (ALLOWED_SOUND_CALLERS.has(rel)) continue;
      if (importsSound(stripComments(readFileSync(file, "utf8")))) {
        violations.push(rel);
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("no file outside the sound folder calls navigator.vibrate", () => {
    const violations: string[] = [];
    for (const file of files) {
      if (callsVibrate(stripComments(readFileSync(file, "utf8")))) {
        violations.push(relPath(file));
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("the allowlisted callers exist, so the allowlist is not stale", () => {
    for (const rel of ALLOWED_SOUND_CALLERS.keys()) {
      expect(existsSync(join(srcRoot, rel)), rel).toBe(true);
    }
  });

  it("the sound folder is the only place that calls navigator.vibrate", () => {
    const soundFile = join(srcRoot, "components", "ceremony", "sound", "sound.ts");
    expect(callsVibrate(stripComments(readFileSync(soundFile, "utf8")))).toBe(true);
  });

  it("would flag a real sound import and a real vibrate call (the scan is not vacuous)", () => {
    const sample = `import { soundCues } from "@/components/ceremony/sound/cues";\nnavigator.vibrate([10]);`;
    expect(importsSound(stripComments(sample))).toBe(true);
    expect(callsVibrate(stripComments(sample))).toBe(true);
  });

  it("does not flag a comment that merely names the sound code", () => {
    const sample = `// No navigator.vibrate and no sound/ import here.\nexport const x = 1;`;
    expect(importsSound(stripComments(sample))).toBe(false);
    expect(callsVibrate(stripComments(sample))).toBe(false);
  });
});
