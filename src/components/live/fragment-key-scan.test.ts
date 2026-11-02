import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Source scan for the backup key (spec 06 task 12, R21.6). The key lives in
 * the browser: it is read from the fragment, typed into the key field and
 * sent only as a parsed key to openLetter. No code on the key path makes a
 * network request, writes to storage or logs. The API modules never see the
 * key text. This is a text heuristic: comments and string literals are
 * blanked first. Each file is checked for existence, so the scan cannot pass
 * by reading nothing.
 */

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "..");

const KEY_PATH_FILES = [
  "components/live/LiveLetter.tsx",
  "components/live/UnlockView.tsx",
  "components/live/BackupKeyCard.tsx",
  "components/live/unlock.ts",
  "components/reveal/OpeningFlow.tsx",
  "lib/cards/fragment.ts",
];

const API_FILES = ["components/live/api.ts", "components/reveal/api.ts"];

const FORBIDDEN = [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /sendBeacon/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bindexedDB\b/,
  /document\.cookie/,
  /serviceWorker/,
  /\bconsole\./,
  /new\s+WebSocket/,
];

/** Blank comments and string literals so only code is scanned. */
function codeOnly(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
    .replace(/`(?:\\.|[^`\\])*`/g, "``");
}

function read(rel: string): string {
  const full = join(src, rel);
  expect(existsSync(full), `${rel} must exist`).toBe(true);
  const text = readFileSync(full, "utf8");
  expect(text.length, `${rel} must not be empty`).toBeGreaterThan(0);
  return codeOnly(text);
}

describe("backup key never leaves the browser (R21.6)", () => {
  for (const rel of KEY_PATH_FILES) {
    it(`${rel} makes no request, storage or console call`, () => {
      const code = read(rel);
      for (const pattern of FORBIDDEN) {
        expect(code, `${rel} matches ${pattern}`).not.toMatch(pattern);
      }
    });
  }

  for (const rel of API_FILES) {
    it(`${rel} never references the key text`, () => {
      const code = read(rel);
      expect(code).not.toMatch(/initialBackupKey|keyText|readKeyFragment|takeBackupKeyFromLocation/);
    });
  }

  it("LiveLetter reads the key in its mount effect, before rendering the flow", () => {
    const code = read("components/live/LiveLetter.tsx");
    expect(code).toMatch(/useEffect\(\(\) => \{\s*setBackupKey\(takeBackupKeyFromLocation\(window\)\);/);
  });
});
