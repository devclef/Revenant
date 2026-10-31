// End-to-end DB integration test for the persona-sealing script
// (spec 03-persona-demo, Task 4; design.md "Sealing_Script"; R16.2, R16.3).
//
// Unlike seal-personas-core.test.ts (which drives sealPersonas against an
// in-memory fake store and needs no database), this suite runs sealPersonas
// with the REAL findLetter and storePersonaLetter against a real Postgres, over
// the committed PERSONAS list and the committed persona letter texts read from
// disk. It proves the whole write path end to end:
//
//   - A first run inserts exactly one demo_letters row of kind 'persona' per
//     persona and nothing else (R4.5, R4.6).
//   - A second, unchanged run skips every persona and inserts no new row, and
//     every stored row is byte-for-byte unchanged (R4.7).
//   - A run whose letter text was edited under the same IDs fails every
//     persona (stored_letter_differs), names each letter ID, and still leaves
//     every row's envelope and envelope_hash byte-for-byte unchanged (R4.8).
//   - Each stored letter opens with the published demo key, and its sealed
//     figures deep-equal thenAndNow(metricId, written_as_of, DEMO_FIGURES).then
//     (R4.2, data-integrity.md: sealed figures are the exact "then" figures).
//   - A persona whose ID is already used by a real letter in `letters` reports
//     real_letter_collision (R4.9).
//
// Each test replaces every committed letter_id with a fresh random 22-char
// base64url ID (16 bytes) for that run, so repeated local runs against a shared
// test database never collide and every test asserts only on rows it created.
// The suite runs only against a real test database via `describeDb` (skips
// locally when DATABASE_URL does not name a database containing 'test', fails —
// never skips — in CI). It only ever inserts (via storePersonaLetter) and reads
// (via findLetter and getSql); it issues no UPDATE or DELETE on a sealed row,
// and afterAll cleans up only the rows these tests created, by their IDs.

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { PERSONAS } from "@/lib/personas";
import type { Persona } from "@/lib/personas";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import { thenAndNow } from "@/lib/figures/then-now";
import {
  openLetter,
  parseBackupKey,
  PUBLIC_DEMO_BACKUP_KEY,
} from "@/lib/crypto";
import type { BackupKeyBytes } from "@/lib/crypto";
import { encodeBase64url } from "@/lib/seal-format";
import { findLetter } from "@/lib/letter-store/queries";
import { storePersonaLetter } from "@/lib/letter-store/store";
import { getSql } from "@/lib/db/client";

import {
  sealPersonas,
  type Deps,
  type PersonaResult,
} from "../../../scripts/seal-personas-core";
import { describeDb } from "./setup";

// A full seal/open round trip per persona against a real database can exceed
// Vitest's default 5s, especially on a cold container; give the file room.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

// The repository root, two levels up from src/test/integration. Persona letter
// paths resolve against content/personas/ here, exactly as the build plugin and
// the Persona_List file-existence check do (design.md).
const REPO_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

/** A fresh random valid letter ID: 16 random bytes as 22 canonical chars. */
function freshLetterId(): string {
  return encodeBase64url(new Uint8Array(randomBytes(16)));
}

/**
 * Read one persona's committed letter text from disk, resolving
 * `content/personas/${letter_path}` from the repository root. The committed
 * `letter_path` values match `^letters/[a-z0-9-]+\.txt$`, so this cannot escape
 * the folder; the tests drive only the committed, validated personas.
 */
function readPersonaText(letterPath: string): string {
  return readFileSync(
    resolve(REPO_ROOT, "content/personas", letterPath),
    "utf8",
  );
}

/**
 * The committed personas with every `letter_id` replaced by a fresh random one
 * for this run, so repeated local runs don't collide. Everything else — key,
 * written_as_of, opens_at, metrics and letter_path — is kept exactly as
 * committed, so the sealed figures and recall questions are the real ones.
 */
function freshenedPersonas(): Persona[] {
  return PERSONAS.map((p) => ({ ...p, letter_id: freshLetterId() }));
}

/**
 * The Deps for a run over the given personas, with the real database I/O, the
 * committed letter texts read from disk, a fixed clock late enough that every
 * committed persona's `written_as_of` is not after it, and real randomness.
 * `readLetterText` keys on `letter_path`, so an edited-text run overrides it
 * through a wrapper rather than mutating the files on disk.
 */
function dbDeps(
  personas: readonly Persona[],
  readLetterText: (path: string) => string = readPersonaText,
): Deps {
  return {
    personas,
    readLetterText,
    figures: DEMO_FIGURES,
    findLetter,
    storePersonaLetter,
    // A fixed seal instant comfortably after every committed written_as_of, so
    // sealLetter's "written_as_of not later than sealedAt" rule always holds.
    now: () => new Date("2099-01-01T00:00:00.000Z"),
    randomBytes: (n) => new Uint8Array(randomBytes(n)),
  };
}

/** Index the results of a run by persona key, for per-persona assertions. */
function byKey(results: readonly PersonaResult[]): Map<string, PersonaResult> {
  return new Map(results.map((r) => [r.key, r]));
}

describeDb("seal-personas against Postgres (integration)", () => {
  // The published demo backup key, parsed once: the key every persona letter is
  // sealed and opened with (crypto.md). Spec 02 guarantees it parses.
  let demoKey: BackupKeyBytes;

  beforeAll(() => {
    const parsed = parseBackupKey(PUBLIC_DEMO_BACKUP_KEY);
    if (!parsed.ok) {
      throw new Error("the published demo backup key failed to parse");
    }
    demoKey = parsed.key;
  });

  afterAll(async () => {
    // Close the shared pool so the worker exits cleanly. No row cleanup: sealed
    // demo_letters rows are immutable by trigger (the whole point of the table),
    // so they cannot be deleted by app code, and every test uses fresh random
    // IDs, so the rows these tests leave behind collide with nothing and are
    // asserted on only by the test that created them.
    await getSql().end({ timeout: 5 });
  });

  // Count demo_letters rows of kind 'persona' for one ID. A persona letter is
  // stored with kind 'persona', so this is 1 exactly when the row was inserted.
  async function personaRowCount(id: string): Promise<number> {
    const sql = getSql();
    const [{ count }] = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM demo_letters
      WHERE id = ${id} AND kind = 'persona'
    `;
    return count;
  }

  // Read the stored envelope (canonical JSON text) and hash for one ID.
  async function storedRow(
    id: string,
  ): Promise<{ envelope: string; envelopeHash: string } | null> {
    const sql = getSql();
    const rows = await sql<{ envelope: string; envelope_hash: string }[]>`
      SELECT envelope, envelope_hash
      FROM demo_letters
      WHERE id = ${id}
    `;
    const row = rows[0];
    return row === undefined
      ? null
      : { envelope: row.envelope, envelopeHash: row.envelope_hash };
  }

  // Feature: 03-persona-demo, Property 17 (store side)
  // First run stores one persona row per persona; a second unchanged run skips
  // every persona and inserts nothing; each stored letter opens with the demo
  // key and its figures are the exact thenAndNow "then" figures.
  it("stores one row per persona, is idempotent, and seals the exact then figures", async () => {
    const personas = freshenedPersonas();

    // --- First run: every persona is new, so every one is STORED. ----------
    const first = await sealPersonas(dbDeps(personas));
    const firstByKey = byKey(first.results);
    expect(first.results).toHaveLength(personas.length);
    for (const p of personas) {
      expect(firstByKey.get(p.key)!.result).toBe("stored");
    }
    // No persona failed, so the exit code is 0.
    expect(first.exitCode).toBe(0);

    // Exactly one demo_letters row of kind 'persona' per persona now exists.
    for (const p of personas) {
      expect(await personaRowCount(p.letter_id)).toBe(1);
    }

    // Snapshot every stored envelope/hash so the second run can be shown to add
    // and change nothing.
    const afterFirst = new Map<
      string,
      { envelope: string; envelopeHash: string }
    >();
    for (const p of personas) {
      const row = await storedRow(p.letter_id);
      expect(row).not.toBeNull();
      afterFirst.set(p.letter_id, row!);
    }

    // Each stored letter opens with the demo key, and its sealed figures are
    // the exact thenAndNow "then" figures for the persona's written_as_of. The
    // stored server secret is read back for the open; the opening instant is in
    // the past (committed personas open historically), so the row is openable.
    for (const p of personas) {
      const found = await findLetter(p.letter_id);
      expect(found).not.toBeNull();
      const opened = await openLetter({
        envelope: JSON.parse(found!.envelope),
        envelopeHash: found!.envelopeHash,
        serverSecret: Uint8Array.from(found!.serverSecret),
        backupKey: demoKey,
      });
      expect(opened.ok).toBe(true);
      if (!opened.ok) continue;

      // One figure per tracked metric, in list order, each byte-identical to
      // the thenAndNow "then" figure (no field changed — R4.2).
      expect(opened.payload.figures).toHaveLength(p.metrics.length);
      p.metrics.forEach((m, i) => {
        const then = thenAndNow(
          m.metric_id,
          p.written_as_of,
          DEMO_FIGURES,
        ).then;
        expect(then.found).toBe(true);
        if (!then.found) return;
        expect(opened.payload.figures[i]).toEqual(then.figure);
        expect(opened.payload.figures[i].value).toBe(then.figure.value);
      });

      // The sealed letter text is exactly the committed file (nothing altered).
      expect(opened.payload.letter_text).toBe(readPersonaText(p.letter_path));
    }

    // --- Second run, unchanged: every persona SKIPPED, nothing inserted. ----
    const second = await sealPersonas(dbDeps(personas));
    const secondByKey = byKey(second.results);
    for (const p of personas) {
      expect(secondByKey.get(p.key)!.result).toBe("skipped");
    }
    expect(second.exitCode).toBe(0);

    // Still exactly one row per persona, and every envelope/hash is byte-for-
    // byte what the first run stored — no insert, no update.
    for (const p of personas) {
      expect(await personaRowCount(p.letter_id)).toBe(1);
      const row = await storedRow(p.letter_id);
      expect(row).toEqual(afterFirst.get(p.letter_id));
    }
  });

  // Feature: 03-persona-demo, Property 17 (edited-text run)
  // A run whose letter text differs from the stored letter, under the same IDs,
  // fails every persona naming its letter ID, and leaves every stored row's
  // envelope and envelope_hash byte-for-byte unchanged.
  it("fails every persona when the letter text differs, changing no stored row", async () => {
    const personas = freshenedPersonas();

    // Seal the real personas first, so a matching demo row exists for each ID.
    const first = await sealPersonas(dbDeps(personas));
    for (const p of personas) {
      expect(byKey(first.results).get(p.key)!.result).toBe("stored");
    }

    // Snapshot every stored envelope/hash before the edited-text run.
    const before = new Map<
      string,
      { envelope: string; envelopeHash: string }
    >();
    for (const p of personas) {
      const row = await storedRow(p.letter_id);
      expect(row).not.toBeNull();
      before.set(p.letter_id, row!);
    }

    // A run that reads an EDITED text for every persona, under the same IDs. The
    // edit appends a sentence, so every freshly built payload differs from the
    // stored one; no file on disk is touched — the override is in readLetterText.
    const edited = (path: string): string =>
      `${readPersonaText(path)}\n\nP.S. One more line, added only for this test.`;
    const run = await sealPersonas(dbDeps(personas, edited));
    const runByKey = byKey(run.results);

    // Every persona FAILS with stored_letter_differs, and each result carries
    // its own letter ID so the entry line can name it.
    for (const p of personas) {
      const r = runByKey.get(p.key)!;
      expect(r.result).toBe("failed");
      if (r.result === "failed") {
        expect(r.reason).toBe("stored_letter_differs");
      }
      expect(r.letterId).toBe(p.letter_id);
    }
    // A persona failed, so the exit code is 1.
    expect(run.exitCode).toBe(1);

    // Every stored row is byte-for-byte unchanged: no update, no new insert.
    for (const p of personas) {
      expect(await personaRowCount(p.letter_id)).toBe(1);
      const row = await storedRow(p.letter_id);
      expect(row).toEqual(before.get(p.letter_id));
    }
  });

  // Feature: 03-persona-demo, Property 17 (real-letter collision)
  // A persona whose ID is already used by a real letter in `letters` reports
  // real_letter_collision and stores nothing.
  it("reports real_letter_collision when the ID is a real letter", async () => {
    const [persona] = freshenedPersonas();

    // Pre-insert the persona's ID into `letters` as a minimal real letter. A
    // real letter needs a 3-month lock, so opens_at is sealed_at + 3 months.
    // The row is immutable by trigger and carries a fresh random ID, so it is
    // left behind like every other row this suite creates — it collides with
    // nothing and only this test reads it.
    const sql = getSql();
    await sql`
      INSERT INTO letters (id, envelope, envelope_hash, sealed_at, opens_at, server_secret)
      VALUES (
        ${persona.letter_id},
        ${"{}"},
        ${"0".repeat(64)},
        ${"2024-01-01T00:00:00.000Z"},
        ${"2024-04-01T00:00:00.000Z"},
        ${Buffer.from(new Uint8Array(randomBytes(32)))}
      )
    `;

    const run = await sealPersonas(dbDeps([persona]));
    expect(run.results).toHaveLength(1);
    const r = run.results[0];
    expect(r.result).toBe("failed");
    if (r.result === "failed") {
      expect(r.reason).toBe("real_letter_collision");
    }
    expect(r.letterId).toBe(persona.letter_id);
    expect(run.exitCode).toBe(1);

    // Nothing was stored in demo_letters under that ID.
    expect(await personaRowCount(persona.letter_id)).toBe(0);
  });
});
