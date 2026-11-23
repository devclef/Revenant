// Tests for the persona sealing script's format version 2 path (spec 15, #512).
//
// These use fake personas and fake figures written in this file, never the
// committed Persona_List or DEMO_FIGURES, so they hold whatever the real
// content looks like. Four concerns:
//
//   (a) A persona with no sealed answers builds a format version 1 payload that
//       is byte-identical to the version 1 output, whether the answers map is
//       omitted, empty, or holds only another persona's answers.
//   (b) A persona with sealed answers builds a format version 2 payload, and
//       each author question carries its sealed_answer, in order. The sealed
//       envelope opens with the published demo key to the same answers.
//   (c) Two sealing runs over the same inputs produce byte-identical envelopes.
//       Every random byte goes through globalThis.crypto.getRandomValues, which
//       is replaced by a fixed sequence for the duration of each run.
//   (d) A count mismatch between the questions and the answers is refused as
//       invalid_payload, and nothing is stored.
//
// The bundle-level checks (the --hashes flag and the inlined sealed-answers map)
// need the built script, so they live in
// src/test/integration/seal-personas-v2-bundle.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";

import type { Persona } from "@/lib/personas";
import type { CatalogueSeries, FigureFile, LoadedFigures } from "@/lib/figures";
import { loadFigureFile } from "@/lib/figures";
import { expectedPrices } from "@/lib/personas/price-lines";
import {
  canonicalize,
  encodeBase64url,
  payloadV2Schema,
} from "@/lib/seal-format";
import {
  openLetter,
  parseBackupKey,
  PUBLIC_DEMO_BACKUP_KEY,
} from "@/lib/crypto";

import {
  buildPersonaPayload,
  sealPersonas,
  type Deps,
  type FoundLetter,
  type SealedAnswers,
} from "../../../scripts/seal-personas-core";

// ---------------------------------------------------------------------------
// Fake data
// ---------------------------------------------------------------------------

const SEALED_AT = "2099-01-01T00:00:00.000Z";
const WRITTEN_AS_OF = "2024-05-12";

// Fake letter IDs: 16 bytes of one constant each, so they never collide.
const FUEL_ID = encodeBase64url(new Uint8Array(16).fill(0x44));
const TEXT_ID = encodeBase64url(new Uint8Array(16).fill(0x55));

const FUEL_QUESTIONS = [
  "What is the commute costing me this spring?",
  "What did I hope the summer would bring?",
];
const TEXT_QUESTIONS = ["What am I looking forward to most?"];

// Fake fuel persona: two tracked metrics and two author questions.
const fuelPersona: Persona = {
  key: "fake-fuel",
  display_name: "Fake Fuel",
  region: "United States",
  letter_id: FUEL_ID,
  written_as_of: WRITTEN_AS_OF,
  opens_at: "2024-05-13T00:00:00.000Z",
  envelope_hash: "a".repeat(64),
  metrics: [
    {
      metric_id: "fake-gasoline",
      recall_subject: "a gallon of regular gasoline",
    },
    { metric_id: "fake-diesel", recall_subject: "a gallon of diesel" },
  ],
  author_questions: FUEL_QUESTIONS,
  intro_line: "A fake persona used only in tests.",
  letter_path: "letters/fake-fuel.txt",
};

// Fake text persona: no metrics, one author question.
const textPersona: Persona = {
  key: "fake-text",
  display_name: "Fake Text",
  region: "United States",
  letter_id: TEXT_ID,
  written_as_of: WRITTEN_AS_OF,
  opens_at: "2024-05-13T00:00:00.000Z",
  envelope_hash: "b".repeat(64),
  metrics: [],
  author_questions: TEXT_QUESTIONS,
  intro_line: "A fake persona used only in tests.",
  letter_path: "letters/fake-text.txt",
};

const FUEL_BODY =
  "A fake letter about the car and the week ahead. I kept the receipts.";
const TEXT_TEXT = "A fake letter about a quiet Sunday. I hope you remember it.";

const FUEL_ANSWERS = ["The drive to the clinic.", "A week at the lake."];
const TEXT_ANSWERS = ["The first warm evening on the balcony."];

// Fake figures, loaded through the real loader. Source and series IDs are
// labelled as fake, and no FIXTURE prefix is used, so the sealing guard does not
// refuse them: the guard is covered by its own tests.
const GASOLINE: CatalogueSeries = {
  metric: {
    id: "fake-gasoline",
    display_name: "Fake gasoline",
    unit: "USD per gallon",
    region: "U.S.",
    source: "Test series (fake data, not an official source)",
    series_id: "TEST-GASOLINE",
  },
  period_type: "weekly",
};

const DIESEL: CatalogueSeries = {
  metric: {
    id: "fake-diesel",
    display_name: "Fake diesel",
    unit: "USD per gallon",
    region: "U.S.",
    source: "Test series (fake data, not an official source)",
    series_id: "TEST-DIESEL",
  },
  period_type: "weekly",
};

// One figure for a series, copying the series' own metric fields so every
// figure carries full provenance.
function fakeFigure(
  series: CatalogueSeries,
  period: string,
  value: string,
): FigureFile["figures"][number] {
  return {
    kind: "official",
    metric_id: series.metric.id,
    value,
    unit: series.metric.unit,
    region: series.metric.region,
    period,
    source: series.metric.source,
    series_id: series.metric.series_id,
    retrieved_at: "2000-01-01T00:00:00Z",
    source_url: "https://example.invalid/test-series",
  };
}

const fakeFile: FigureFile = {
  fixture: false,
  note: "fake figures for the persona sealing tests",
  series: [GASOLINE, DIESEL],
  figures: [
    fakeFigure(GASOLINE, "2024-04-29", "3.60"),
    fakeFigure(GASOLINE, "2024-05-06", "3.64"),
    fakeFigure(DIESEL, "2024-04-29", "3.85"),
    fakeFigure(DIESEL, "2024-05-06", "3.89"),
  ],
};

const FIGURES: LoadedFigures = loadFigureFile(fakeFile, []);

// The fuel letter states each tracked "then" price as "about $<value>", the
// Letter_Price_Line form the pre-seal text check requires (checkPersonaTexts).
const FUEL_TEXT = [
  FUEL_BODY,
  ...expectedPrices(fuelPersona, FIGURES).map((p) => `about $${p}`),
].join(" ");

// ---------------------------------------------------------------------------
// Deterministic randomness and in-memory deps
// ---------------------------------------------------------------------------

// Replace globalThis.crypto.getRandomValues with a fixed sequence for one run,
// so every nonce, content key and server secret is the same on each run.
function installDeterministicRandom(): void {
  let state = 1;
  vi.spyOn(globalThis.crypto, "getRandomValues").mockImplementation((array) => {
    if (array === null) {
      throw new TypeError("getRandomValues: null array");
    }
    const view = new Uint8Array(
      array.buffer,
      array.byteOffset,
      array.byteLength,
    );
    for (let i = 0; i < view.length; i++) {
      state = (Math.imul(state, 1103515245) + 12345) >>> 0;
      view[i] = state >>> 24;
    }
    return array;
  });
}

type Stored = {
  envelope: unknown;
  envelopeHash: string;
  serverSecret: Uint8Array;
};

// An insert-only in-memory store: findLetter reads, storePersonaLetter inserts.
function memoryDeps(
  personas: readonly Persona[],
  sealedAnswers: SealedAnswers,
): { deps: Deps; stored: Stored[] } {
  const rows = new Map<string, FoundLetter>();
  const stored: Stored[] = [];
  const deps: Deps = {
    personas,
    readLetterText: (path) =>
      path === fuelPersona.letter_path ? FUEL_TEXT : TEXT_TEXT,
    figures: FIGURES,
    sealedAnswers,
    findLetter: async (id) => rows.get(id) ?? null,
    storePersonaLetter: async (input) => {
      stored.push({
        envelope: input.envelope,
        envelopeHash: input.envelopeHash,
        serverSecret: input.serverSecret,
      });
    },
    now: () => new Date(SEALED_AT),
    randomBytes: (n) => globalThis.crypto.getRandomValues(new Uint8Array(n)),
  };
  return { deps, stored };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// (a) No sealed answers: version 1, byte-identical.
// ---------------------------------------------------------------------------

describe("persona without sealed answers stays on format version 1", () => {
  it("builds the same version 1 bytes whether the answers map is omitted, empty or holds another persona", () => {
    const omitted = buildPersonaPayload(fuelPersona, FUEL_TEXT, FIGURES);
    const empty = buildPersonaPayload(fuelPersona, FUEL_TEXT, FIGURES, {});
    const otherOnly = buildPersonaPayload(fuelPersona, FUEL_TEXT, FIGURES, {
      "fake-text": TEXT_ANSWERS,
    });

    expect(omitted.ok).toBe(true);
    expect(empty.ok).toBe(true);
    expect(otherOnly.ok).toBe(true);
    if (!omitted.ok || !empty.ok || !otherOnly.ok) return;

    expect(omitted.payload.format_version).toBe(1);
    const bytes = canonicalize(omitted.payload);
    expect(canonicalize(empty.payload)).toBe(bytes);
    expect(canonicalize(otherOnly.payload)).toBe(bytes);
  });

  it("keeps a no-metrics persona on version 1 with no sealed answer on its questions", () => {
    const omitted = buildPersonaPayload(textPersona, TEXT_TEXT, FIGURES);
    const withOther = buildPersonaPayload(textPersona, TEXT_TEXT, FIGURES, {
      "fake-fuel": FUEL_ANSWERS,
    });
    expect(omitted.ok && omitted.payload.format_version).toBe(1);
    expect(withOther.ok).toBe(true);
    if (!omitted.ok || !withOther.ok) return;
    expect(canonicalize(withOther.payload)).toBe(canonicalize(omitted.payload));
    for (const question of omitted.payload.recall_questions) {
      expect(question).not.toHaveProperty("sealed_answer");
    }
  });
});

// ---------------------------------------------------------------------------
// (b) Sealed answers: version 2, each answer present.
// ---------------------------------------------------------------------------

describe("persona with sealed answers builds format version 2", () => {
  it("writes each author question as a text question with its sealed answer, after the number questions", () => {
    const built = buildPersonaPayload(fuelPersona, FUEL_TEXT, FIGURES, {
      "fake-fuel": FUEL_ANSWERS,
    });
    if (!built.ok || built.payload.format_version !== 2) {
      throw new Error("test setup: expected a version 2 payload");
    }

    // Schema for version 2 accepts the payload as built.
    expect(payloadV2Schema.safeParse(built.payload).success).toBe(true);

    const questions = built.payload.recall_questions;
    const textQuestions = questions.filter((q) => q.answer_type === "text");
    expect(textQuestions.map((q) => q.id)).toEqual(["a1", "a2"]);
    expect(textQuestions.map((q) => q.text)).toEqual(FUEL_QUESTIONS);
    expect(textQuestions.map((q) => q.sealed_answer)).toEqual(FUEL_ANSWERS);

    // Number questions come first, then the text questions.
    const firstText = questions.findIndex((q) => q.answer_type === "text");
    expect(
      questions.slice(0, firstText).every((q) => q.answer_type === "number"),
    ).toBe(true);
    expect(
      questions.slice(firstText).every((q) => q.answer_type === "text"),
    ).toBe(true);
  });

  it("builds a version 2 payload for a no-metrics persona with no figures", () => {
    const built = buildPersonaPayload(textPersona, TEXT_TEXT, FIGURES, {
      "fake-text": TEXT_ANSWERS,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.payload.format_version).toBe(2);
    expect(built.payload.metrics).toEqual([]);
    expect(built.payload.figures).toEqual([]);
    expect(built.payload.recall_questions).toEqual([
      {
        id: "a1",
        answer_type: "text",
        text: TEXT_QUESTIONS[0],
        sealed_answer: TEXT_ANSWERS[0],
      },
    ]);
  });

  it("refuses a count mismatch between author questions and sealed answers as invalid_payload", () => {
    const built = buildPersonaPayload(fuelPersona, FUEL_TEXT, FIGURES, {
      "fake-fuel": [FUEL_ANSWERS[0]],
    });
    expect(built).toEqual({ ok: false, reason: "invalid_payload" });
  });

  it("seals the answers so the demo key opens them back to the same text", async () => {
    installDeterministicRandom();
    const { deps, stored } = memoryDeps([fuelPersona], {
      "fake-fuel": FUEL_ANSWERS,
    });

    const { results, exitCode } = await sealPersonas(deps);
    expect(exitCode).toBe(0);
    expect(results).toEqual([
      { key: "fake-fuel", letterId: FUEL_ID, result: "stored" },
    ]);
    expect(stored).toHaveLength(1);

    const demoKey = parseBackupKey(PUBLIC_DEMO_BACKUP_KEY);
    if (!demoKey.ok) throw new Error("test setup: demo key did not parse");
    const row = stored[0];
    const opened = await openLetter({
      envelope: row.envelope,
      envelopeHash: row.envelopeHash,
      serverSecret: row.serverSecret,
      backupKey: demoKey.key,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    if (opened.payload.format_version !== 2) {
      throw new Error("test setup: expected a version 2 payload");
    }
    const sealedTexts = opened.payload.recall_questions.flatMap((q) =>
      q.answer_type === "text" ? [q.sealed_answer] : [],
    );
    expect(sealedTexts).toEqual(FUEL_ANSWERS);
  });
});

// ---------------------------------------------------------------------------
// (c) Determinism: two runs, byte-identical envelopes.
// ---------------------------------------------------------------------------

describe("sealing is deterministic under a fixed random source", () => {
  it("two runs over the same personas and answers store byte-identical envelopes", async () => {
    const personas = [fuelPersona, textPersona];
    const answers: SealedAnswers = {
      "fake-fuel": FUEL_ANSWERS,
      "fake-text": TEXT_ANSWERS,
    };

    const runOnce = async (): Promise<Stored[]> => {
      installDeterministicRandom();
      const { deps, stored } = memoryDeps(personas, answers);
      const { exitCode } = await sealPersonas(deps);
      expect(exitCode).toBe(0);
      vi.restoreAllMocks();
      return stored;
    };

    const first = await runOnce();
    const second = await runOnce();

    expect(first).toHaveLength(2);
    expect(second).toHaveLength(2);
    for (let i = 0; i < first.length; i++) {
      expect(canonicalize(second[i].envelope)).toBe(
        canonicalize(first[i].envelope),
      );
      expect(second[i].envelopeHash).toBe(first[i].envelopeHash);
      expect(Buffer.from(second[i].serverSecret)).toEqual(
        Buffer.from(first[i].serverSecret),
      );
    }
  });
});
