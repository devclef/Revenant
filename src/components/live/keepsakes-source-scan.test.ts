/**
 * Source scan for the keepsakes (spec 06, task 11; R20.5, R20.6).
 *
 *  1. No non-test code under src/ mentions `serviceWorker`. A service worker
 *     could cache a letter card or a key (R20.5).
 *  2. The keepsake modules make no network call: no fetch(, XMLHttpRequest,
 *     sendBeacon or WebSocket (R20.1, R20.6).
 *
 * Comments and string literals are blanked first, so a doc comment that names
 * a token does not trip it. Test files are skipped on purpose.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "..", "..");
const keepsakeFiles = ["LetterCard.tsx", "SealedKeepsakes.tsx", "keepsake-files.ts"].map((name) =>
  join(here, name),
);

function collect(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "__fixtures__" || entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collect(full));
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function blank(source: string, re: RegExp): string {
  return source.replace(re, (m) => " ".repeat(m.length));
}

function stripCommentsAndStrings(source: string): string {
  let s = source;
  s = blank(s, /\/\*[\s\S]*?\*\//g);
  s = blank(s, /\/\/[^\n]*/g);
  s = blank(s, /`(?:\\.|[^`\\])*`/g);
  s = blank(s, /"(?:\\.|[^"\\])*"/g);
  s = blank(s, /'(?:\\.|[^'\\])*'/g);
  return s;
}

const NETWORK: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bfetch\s*\(/, "fetch("],
  [/\bXMLHttpRequest\b/, "XMLHttpRequest"],
  [/\bsendBeacon\b/, "sendBeacon"],
  [/\bWebSocket\b/, "WebSocket"],
];

describe("keepsakes source scan", () => {
  const allSources = collect(srcRoot);

  it("has a non-empty set of src files to scan", () => {
    expect(allSources.length).toBeGreaterThan(10);
    expect(keepsakeFiles.every((file) => existsSync(file))).toBe(true);
  });

  it("registers no service worker anywhere under src/", () => {
    const violations: string[] = [];
    for (const file of allSources) {
      const code = stripCommentsAndStrings(readFileSync(file, "utf8"));
      if (/\bserviceWorker\b/.test(code)) {
        violations.push(file.slice(srcRoot.length + 1));
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("makes no network call from the keepsake modules", () => {
    const violations: string[] = [];
    for (const file of keepsakeFiles) {
      const code = stripCommentsAndStrings(readFileSync(file, "utf8"));
      for (const [re, label] of NETWORK) {
        if (re.test(code)) violations.push(`${file.slice(here.length + 1)} uses "${label}"`);
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("would flag a service worker registration (the scan is not vacuous)", () => {
    const code = stripCommentsAndStrings("navigator.serviceWorker.register('/sw.js');");
    expect(/\bserviceWorker\b/.test(code)).toBe(true);
  });

  it("would not flag a service worker named only in a comment", () => {
    const code = stripCommentsAndStrings("// no serviceWorker here\nconst x = 1;");
    expect(/\bserviceWorker\b/.test(code)).toBe(false);
  });
});
