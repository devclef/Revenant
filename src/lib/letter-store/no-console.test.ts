// Source-scan guard: no `console.*` in the letter-store routes or helpers.
//
// The letter, secret and openings routes handle ciphertext, the time-lock
// `serverSecret` and encrypted recall answers. `crypto.md` and `tech.md` forbid
// logging any of it (R8.1): the server must never write a figure, a secret or a
// recall answer to a log. A stray `console.log` left in a route is the simplest
// way that invariant is broken, so this test reads the SOURCE TEXT of every
// route and every letter-store module and fails if any `console.*` call is
// present. It is a text scan, not a runtime check, so it catches the call even
// on a code path the other tests never exercise.
//
// The scanned set is asserted non-empty so the guard cannot pass vacuously if a
// path is renamed or a glob stops matching.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
// src/lib/letter-store -> src
const srcRoot = resolve(here, "..", "..");

// Every route file plus every non-test letter-store module. Listed explicitly
// so a new file that forgets its guard is a visible omission here, not a silent
// gap behind a glob.
const scannedFiles = [
  "app/api/letters/[id]/route.ts",
  "app/api/letters/[id]/secret/route.ts",
  "app/api/openings/route.ts",
  "app/api/letters/demo/prepare/route.ts",
  "app/api/letters/demo/seal/route.ts",
  "lib/letter-store/clock.ts",
  "lib/letter-store/http.ts",
  "lib/letter-store/queries.ts",
  "lib/letter-store/store.ts",
].map((rel) => resolve(srcRoot, rel));

// Matches console.log, console.error, console.warn, console["log"], etc.
const consoleCall = /console\s*(?:\.\s*\w+|\[)/;

describe("no console.* in letter-store routes and helpers (R8.1)", () => {
  it("scans a non-empty set of files", () => {
    expect(scannedFiles.length).toBeGreaterThan(0);
  });

  it.each(scannedFiles)("contains no console.* call: %s", (file) => {
    const source = readFileSync(file, "utf8");
    expect(source).not.toMatch(consoleCall);
  });
});
