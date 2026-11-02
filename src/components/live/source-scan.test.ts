/**
 * R22.8 source scan for the live demo (spec 06-lock-and-unlock): the
 * Sealing_Flow and the Unlock_Flow write nothing to `localStorage`,
 * `sessionStorage`, IndexedDB or cookies, make no `console` call, and register
 * no service worker. crypto.md and tech.md forbid the seal and open flows from
 * touching persistent browser storage, the console, or a service worker that
 * could cache a card or a key.
 *
 * The reveal/demo source scan (src/components/reveal/source-scan.test.ts)
 * already covers src/components/live for localStorage, sessionStorage,
 * indexedDB, document.cookie, console. and history. This scan is the live
 * demo's own, and it adds `serviceWorker` to that list, which the Backup_Fallback
 * and the keepsake cards (R20.5, R21.5) must never register.
 *
 * It is a lint-style heuristic, not a full parser: comments and string literals
 * are blanked first, so a doc comment that merely names one of these tokens
 * does not trip it. Each assertion seeds from a non-empty file set so it can
 * never pass by scanning nothing.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const liveRoot = here;
const srcRoot = resolve(here, "..", "..");
const relFromSrc = (file: string): string =>
  file.slice(srcRoot.length + 1).replace(/\\/g, "/");

/** Recursively collect files under `dir` matching `pred`, skipping fixtures. */
function collectFiles(dir: string, pred: (name: string) => boolean): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__fixtures__") continue;
      out.push(...collectFiles(full, pred));
      continue;
    }
    if (pred(entry.name)) out.push(full);
  }
  return out;
}

const isTestName = (name: string): boolean => /\.(test|spec)\.tsx?$/.test(name);
const isSourceTs = (name: string): boolean => /\.tsx?$/.test(name) && !isTestName(name);

/** Replace matched regions with spaces of equal length (keeps line numbers). */
function blank(source: string, re: RegExp): string {
  return source.replace(re, (m) => " ".repeat(m.length));
}

/** Blank block comments, line comments, template/single/double string literals. */
function stripCommentsAndStrings(source: string): string {
  let s = source;
  s = blank(s, /\/\*[\s\S]*?\*\//g);
  s = blank(s, /\/\/[^\n]*/g);
  s = blank(s, /`(?:\\.|[^`\\])*`/g);
  s = blank(s, /"(?:\\.|[^"\\])*"/g);
  s = blank(s, /'(?:\\.|[^'\\])*'/g);
  return s;
}

/** Forbidden tokens and a human label for each. */
const FORBIDDEN: ReadonlyArray<readonly [RegExp, string]> = [
  [/\blocalStorage\b/, "localStorage"],
  [/\bsessionStorage\b/, "sessionStorage"],
  [/\bindexedDB\b/, "indexedDB"],
  [/document\s*\.\s*cookie\b/, "document.cookie"],
  [/\bconsole\s*\./, "console."],
  [/\bserviceWorker\b/, "serviceWorker"],
];

describe("R22.8: the live demo writes no storage, logs nothing, registers no service worker", () => {
  // Scan SOURCE only; the tests themselves legitimately name these tokens in
  // their patterns.
  const sources = collectFiles(liveRoot, isSourceTs);

  it("has a non-empty set of source files to scan", () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it("uses none of the forbidden browser APIs", () => {
    const violations: string[] = [];
    for (const file of sources) {
      const code = stripCommentsAndStrings(readFileSync(file, "utf8"));
      for (const [re, label] of FORBIDDEN) {
        if (re.test(code)) {
          violations.push(`${relFromSrc(file)} uses "${label}"`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("would flag each forbidden token (the scan is not vacuous)", () => {
    const samples: ReadonlyArray<readonly [string, string]> = [
      ["localStorage.setItem('k', v)", "localStorage"],
      ["sessionStorage.getItem('k')", "sessionStorage"],
      ["const db = indexedDB.open('x')", "indexedDB"],
      ["document.cookie = 'a=b'", "document.cookie"],
      ["console.log('leak')", "console."],
      ["navigator.serviceWorker.register('/sw.js')", "serviceWorker"],
    ];
    for (const [snippet, expectedLabel] of samples) {
      const code = stripCommentsAndStrings(snippet);
      const hit = FORBIDDEN.find(([re]) => re.test(code));
      expect(hit?.[1], `expected to flag ${expectedLabel} in: ${snippet}`).toBe(expectedLabel);
    }
  });

  it("does not flag a token that only appears in a comment or string", () => {
    const code = stripCommentsAndStrings(
      `// never call localStorage here\nconst note = "no serviceWorker is registered";`,
    );
    const hit = FORBIDDEN.find(([re]) => re.test(code));
    expect(hit).toBeUndefined();
  });
});
