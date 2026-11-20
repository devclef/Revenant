// Bundle-level tests for the persona sealing script's version 2 wiring (spec 15,
// #512, task 4/4). They run the built bundle, so they need no database.
//
//   (a) `--hashes` prints one line per persona, "seal-personas <key> <letter_id>
//       <envelope_hash>", with the committed values, and exits 0 before the
//       DATABASE_URL guard, even with DATABASE_URL unset.
//   (b) The sealed-answers map is inlined into the bundle. When the committed
//       content/personas/letters/sealed-answers.json is absent, the build inlines
//       {} (every persona stays on format version 1). When it is present, its
//       answers are inlined.
//
// This file lives in the integration project because it writes dist/ through
// the build script. That project runs one file at a time, so it cannot race the
// other bundle builds.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { PERSONAS } from "@/lib/personas";

const REPO_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
const BUILD_SCRIPT = resolve(REPO_ROOT, "scripts/seal-personas.build.mjs");
const BUNDLE = resolve(REPO_ROOT, "dist/seal-personas.mjs");
const SEALED_ANSWERS_FILE = resolve(
  REPO_ROOT,
  "content/personas/letters/sealed-answers.json",
);

// Build the bundle once for both describes, from the committed build script.
beforeAll(() => {
  execFileSync("node", [BUILD_SCRIPT], { cwd: REPO_ROOT, stdio: "pipe" });
}, 120_000);

describe("seal-personas bundle: --hashes", () => {
  it("prints key, letter_id and envelope_hash for each persona and exits 0 before the DATABASE_URL guard", () => {
    expect(existsSync(BUNDLE)).toBe(true);

    // DATABASE_URL is removed entirely. Without --hashes the guard would exit 1,
    // so a 0 here means --hashes ran first.
    const env = { ...process.env };
    delete env.DATABASE_URL;
    const run = spawnSync("node", [BUNDLE, "--hashes"], {
      cwd: REPO_ROOT,
      env,
      encoding: "utf8",
      timeout: 60_000,
    });

    expect(run.status).toBe(0);
    expect(run.stderr).toBe("");

    const expected = PERSONAS.map(
      (p) => `seal-personas ${p.key} ${p.letter_id} ${p.envelope_hash}`,
    );
    expect(run.stdout).toBe(`${expected.join("\n")}\n`);

    // Each line has exactly four space-separated fields, and the hash is 64 hex.
    for (const line of run.stdout.trimEnd().split("\n")) {
      const fields = line.split(" ");
      expect(fields).toHaveLength(4);
      expect(fields[3]).toMatch(/^[0-9a-f]{64}$/);
    }

    // No connection string, secret or PRF material appears on either stream.
    expect(run.stdout).not.toContain("DATABASE_URL");
    expect(run.stdout).not.toContain("postgres");
  }, 120_000);
});

describe("seal-personas bundle: sealed-answers map", () => {
  it("inlines {} when sealed-answers.json is absent, and the committed answers when it is present", () => {
    const bundle = readFileSync(BUNDLE, "utf8");

    if (!existsSync(SEALED_ANSWERS_FILE)) {
      // The missing-file case: the plugin exports an empty object, so no persona
      // has an entry and every persona is sealed as format version 1.
      expect(bundle).toContain(
        "var virtual_persona_sealed_answers_default = {};",
      );
      return;
    }

    // The present-file case: every persona key and answer from the committed file
    // reaches the bundle.
    const answers = JSON.parse(
      readFileSync(SEALED_ANSWERS_FILE, "utf8"),
    ) as Record<string, string[]>;
    for (const [key, list] of Object.entries(answers)) {
      expect(bundle).toContain(JSON.stringify(key));
      for (const answer of list) {
        expect(bundle).toContain(JSON.stringify(answer));
      }
    }
  }, 120_000);
});
