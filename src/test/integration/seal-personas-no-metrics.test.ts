// Tests for sealing a persona with no metrics (the Text_Persona), and proof
// that the fuel personas' payloads did not change (issue #352).
//
// Three concerns, none of which needs Postgres:
//
//   (1) buildPersonaPayload on a no-metrics persona gives a format_version 1
//       payload with metrics: [] and figures: [], and recall_questions a1..an
//       built from author_questions in order, as text questions.
//   (2) The fuel personas' canonical payloads are byte-identical to the
//       output from before the no-metrics branch was added. The expected
//       SHA-256 values were taken from the pre-change module (commit 82c1efc)
//       and compared byte for byte in a throwaway test before being pinned here.
//   (3) The committed Persona_List round trip: sealPersonas over the whole
//       list with an insert-only in-memory store and real crypto stores every
//       persona once, a second run skips them all, and the Text_Persona opens
//       with the published Demo_Key to her letter and her author questions.

import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { PERSONAS, type Persona } from "@/lib/personas";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import { canonicalize, payloadV1Schema } from "@/lib/seal-format";
import {
  openLetter,
  parseBackupKey,
  PUBLIC_DEMO_BACKUP_KEY,
} from "@/lib/crypto";
import type { LetterRow } from "@/lib/letter-store/queries";

import {
  buildPersonaPayload,
  sealPersonas,
  type Deps,
} from "../../../scripts/seal-personas-core";

const REPO_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

const SEALED_AT = "2099-01-01T00:00:00.000Z";

function personaOrThrow(key: string): Persona {
  const found = PERSONAS.find((p) => p.key === key);
  if (found === undefined) {
    throw new Error(`test setup: ${key} is missing from PERSONAS`);
  }
  return found;
}

function letterText(persona: Persona): string {
  return readFileSync(
    resolve(REPO_ROOT, "content/personas", persona.letter_path),
    "utf8",
  );
}

function sha256Hex(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

const textPersona = personaOrThrow("us-priya");
const fuelPersonas = PERSONAS.filter((p) => p.metrics.length > 0);

// A tiny insert-only store. It has findLetter and storePersonaLetter, and
// nothing that updates or deletes a row.
class InsertOnlyStore {
  private rows = new Map<string, LetterRow>();
  insertCount = 0;

  findLetter = async (id: string): Promise<LetterRow | null> => {
    return this.rows.get(id) ?? null;
  };

  storePersonaLetter = async (input: {
    envelope: unknown;
    envelopeHash: string;
    serverSecret: Uint8Array;
  }): Promise<void> => {
    const id = String((input.envelope as { letterId?: unknown }).letterId);
    if (this.rows.has(id)) {
      throw new Error("insert-only store received a duplicate id");
    }
    this.rows.set(id, {
      id,
      envelope: JSON.stringify(input.envelope),
      envelopeHash: input.envelopeHash,
      opensAt: new Date(0),
      serverSecret: Buffer.from(input.serverSecret),
      demo: true,
      dbNow: new Date(0),
    } as LetterRow);
    this.insertCount++;
  };

  get(id: string): LetterRow | undefined {
    return this.rows.get(id);
  }
}

function depsFor(
  personas: readonly Persona[],
  store: InsertOnlyStore,
  texts: Map<string, string>,
): Deps {
  return {
    personas,
    readLetterText: (path) => {
      const t = texts.get(path);
      if (t === undefined) throw new Error(`no text for ${path}`);
      return t;
    },
    figures: DEMO_FIGURES,
    findLetter: store.findLetter,
    storePersonaLetter: store.storePersonaLetter,
    now: () => new Date(SEALED_AT),
    randomBytes: (n) => new Uint8Array(randomBytes(n)),
  };
}

describe("buildPersonaPayload: a persona with no metrics", () => {
  it("builds a v1 payload with metrics [] and figures []", () => {
    const text = letterText(textPersona);
    const built = buildPersonaPayload(textPersona, text, DEMO_FIGURES);

    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.payload.format_version).toBe(1);
    expect(built.payload.metrics).toEqual([]);
    expect(built.payload.figures).toEqual([]);
    expect(built.payload.letter_text).toBe(text);
    expect(built.payload.written_as_of).toBe(textPersona.written_as_of);
    expect(() => payloadV1Schema.parse(built.payload)).not.toThrow();
  });

  it("turns each author question into a text recall question a1..an, in order", () => {
    const questions = [
      "On the day you sealed this, what were you looking forward to most?",
      "On the day you sealed this, what were you worried about?",
      "On the day you sealed this, who did you talk to first?",
    ];
    const persona: Persona = { ...textPersona, author_questions: questions };
    const built = buildPersonaPayload(
      persona,
      letterText(textPersona),
      DEMO_FIGURES,
    );

    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.payload.recall_questions).toEqual([
      { id: "a1", answer_type: "text", text: questions[0] },
      { id: "a2", answer_type: "text", text: questions[1] },
      { id: "a3", answer_type: "text", text: questions[2] },
    ]);
  });

  it("fails with invalid_payload, and stores nothing, when the payload breaks the v1 schema", async () => {
    // An empty letter fails the schema's letter_text rule (1 to 5000 code
    // points), so the no-metrics build must refuse it.
    const built = buildPersonaPayload(textPersona, "", DEMO_FIGURES);
    expect(built).toEqual({ ok: false, reason: "invalid_payload" });

    const store = new InsertOnlyStore();
    const run = await sealPersonas(
      depsFor([textPersona], store, new Map([[textPersona.letter_path, ""]])),
    );
    expect(run.results).toEqual([
      {
        key: textPersona.key,
        letterId: textPersona.letter_id,
        result: "failed",
        reason: "invalid_payload",
      },
    ]);
    expect(run.exitCode).toBe(1);
    expect(store.insertCount).toBe(0);
    expect(store.get(textPersona.letter_id)).toBeUndefined();
  });
});

describe("buildPersonaPayload: the fuel personas are unchanged", () => {
  // Expected SHA-256 of canonicalize(payload) for each fuel persona, built with
  // the committed letter text and DEMO_FIGURES. Taken from the pre-change
  // module and compared byte for byte, so any change to the metric path breaks
  // this test.
  const EXPECTED_SHA256: Record<string, string> = {
    "us-maya":
      "0866d7bf8c7d7455b6dcd48704e9d16c6d4565aa2d60dd94776261df888d350b",
    "eu-tomas":
      "e814c438679c13c58e46f1c9163a99297dc9cf5bd10df1a21560827435a1a0f4",
  };

  it("pins exactly the two fuel personas", () => {
    expect(fuelPersonas.map((p) => p.key).sort()).toEqual(
      Object.keys(EXPECTED_SHA256).sort(),
    );
  });

  for (const key of Object.keys(EXPECTED_SHA256)) {
    it(`${key}: canonical payload hash is unchanged`, () => {
      const persona = personaOrThrow(key);
      const built = buildPersonaPayload(
        persona,
        letterText(persona),
        DEMO_FIGURES,
      );
      expect(built.ok).toBe(true);
      if (!built.ok) return;
      expect(built.payload.metrics).toHaveLength(persona.metrics.length);
      expect(built.payload.figures).toHaveLength(persona.metrics.length);
      expect(sha256Hex(canonicalize(built.payload))).toBe(EXPECTED_SHA256[key]);
    });
  }
});

describe("Persona_List round trip with the Demo_Key (insert-only store, real crypto)", () => {
  it("stores every persona once, skips them on a re-run, and opens the Text_Persona with the Demo_Key", async () => {
    const store = new InsertOnlyStore();
    const texts = new Map(
      PERSONAS.map((p) => [p.letter_path, letterText(p)] as const),
    );
    const deps = depsFor(PERSONAS, store, texts);

    const first = await sealPersonas(deps);
    expect(first.exitCode).toBe(0);
    expect(first.results.every((r) => r.result === "stored")).toBe(true);
    expect(store.insertCount).toBe(PERSONAS.length);

    const second = await sealPersonas(deps);
    expect(second.exitCode).toBe(0);
    expect(second.results.every((r) => r.result === "skipped")).toBe(true);
    expect(store.insertCount).toBe(PERSONAS.length);

    const parsed = parseBackupKey(PUBLIC_DEMO_BACKUP_KEY);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const row = store.get(textPersona.letter_id);
    expect(row).toBeDefined();
    if (row === undefined) return;
    const opened = await openLetter({
      envelope: JSON.parse(row.envelope),
      envelopeHash: row.envelopeHash,
      serverSecret: Uint8Array.from(row.serverSecret),
      backupKey: parsed.key,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    expect(opened.payload.letter_text).toBe(letterText(textPersona));
    expect(opened.payload.metrics).toEqual([]);
    expect(opened.payload.figures).toEqual([]);
    expect(opened.payload.recall_questions).toEqual(
      (textPersona.author_questions ?? []).map((text, i) => ({
        id: `a${i + 1}`,
        answer_type: "text",
        text,
      })),
    );
  });
});
