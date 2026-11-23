// Tests that one bad persona text stops the whole persona seal run (spec 18,
// issue #625, Requirement 6.8). The Sealing_Script checks every letter and
// every sealed answer before its first insert, so a single failing text must
// leave the store untouched for every persona, including the valid ones.
//
// These use fake personas and fake figures written in this file, plus a fake
// insert function, so no database is needed.

import { describe, expect, it, vi } from "vitest";

import type { Persona } from "@/lib/personas";
import type { CatalogueSeries, FigureFile, LoadedFigures } from "@/lib/figures";
import { loadFigureFile } from "@/lib/figures";
import { expectedPrices } from "@/lib/personas/price-lines";
import { encodeBase64url } from "@/lib/seal-format";

import {
  sealPersonas,
  type Deps,
  type FoundLetter,
  type SealedAnswers,
} from "../../../scripts/seal-personas-core";

const SEALED_AT = "2099-01-01T00:00:00.000Z";
const WRITTEN_AS_OF = "2024-05-12";

const FUEL_ID = encodeBase64url(new Uint8Array(16).fill(0x66));
const TEXT_ID = encodeBase64url(new Uint8Array(16).fill(0x77));

const FUEL_QUESTIONS = [
  "What is the commute costing me this spring?",
  "What did I hope the summer would bring?",
];
const TEXT_QUESTIONS = ["What am I looking forward to most?"];

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
  ],
  author_questions: FUEL_QUESTIONS,
  intro_line: "A fake persona used only in tests.",
  letter_path: "letters/fake-fuel.txt",
};

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
const TEXT_BODY = "A fake letter about a quiet Sunday. I hope you remember it.";

const TEXT_ANSWERS = ["The first warm evening on the balcony."];

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

const FIGURES: LoadedFigures = loadFigureFile(
  {
    fixture: false,
    note: "fake figures for the persona text gate tests",
    series: [GASOLINE],
    figures: [
      fakeFigure(GASOLINE, "2024-04-29", "3.60"),
      fakeFigure(GASOLINE, "2024-05-06", "3.64"),
    ],
  } satisfies FigureFile,
  [],
);

// A passing letter: the body plus the Letter_Price_Line phrase for each "then"
// figure, the form the pre-seal text check requires.
function passingFuelText(): string {
  return [
    FUEL_BODY,
    ...expectedPrices(fuelPersona, FIGURES).map((p) => `about $${p}`),
  ].join(" ");
}

// Fake insert function: records every call and never touches a database.
function fakeStore(): {
  findLetter: Deps["findLetter"];
  storePersonaLetter: Deps["storePersonaLetter"];
  inserts: unknown[];
} {
  const rows = new Map<string, FoundLetter>();
  const inserts: unknown[] = [];
  return {
    findLetter: vi.fn(async (id: string) => rows.get(id) ?? null),
    storePersonaLetter: vi.fn(async (input) => {
      inserts.push(input);
    }),
    inserts,
  };
}

function depsFor(
  texts: Record<string, string>,
  sealedAnswers: SealedAnswers,
  store: ReturnType<typeof fakeStore>,
): Deps {
  return {
    personas: [fuelPersona, textPersona],
    readLetterText: (path) => {
      const text = texts[path];
      if (text === undefined) throw new Error(`no text for ${path}`);
      return text;
    },
    figures: FIGURES,
    sealedAnswers,
    findLetter: store.findLetter,
    storePersonaLetter: store.storePersonaLetter,
    now: () => new Date(SEALED_AT),
    randomBytes: (n) => new Uint8Array(n).fill(7),
  };
}

describe("sealPersonas stops the whole run on one bad text", () => {
  it("a letter failing checkLetterText reports the problem, exits 1 and inserts nothing", async () => {
    const store = fakeStore();
    const deps = depsFor(
      {
        "letters/fake-fuel.txt": passingFuelText(),
        // "!" breaks the plain-text rule, so checkLetterText reports a problem.
        "letters/fake-text.txt": `${TEXT_BODY}!`,
      },
      { "fake-text": TEXT_ANSWERS },
      store,
    );

    const run = await sealPersonas(deps);

    expect(run.problems.length).toBeGreaterThan(0);
    expect(run.problems.join("\n")).toContain("fake-text");
    expect(run.exitCode).toBe(1);
    expect(run.results).toEqual([]);
    // No persona is inserted, including the valid fuel persona.
    expect(store.storePersonaLetter).not.toHaveBeenCalled();
    expect(store.inserts).toHaveLength(0);
  });

  it("a sealed answer failing checkAnswerText reports the problem, exits 1 and inserts nothing", async () => {
    const store = fakeStore();
    const deps = depsFor(
      {
        "letters/fake-fuel.txt": passingFuelText(),
        "letters/fake-text.txt": TEXT_BODY,
      },
      {
        // The reference to "remember" is a problem for a sealed answer.
        "fake-text": ["I will remember the first warm evening."],
      },
      store,
    );

    const run = await sealPersonas(deps);

    expect(run.problems.length).toBeGreaterThan(0);
    expect(run.problems.join("\n")).toContain("fake-text");
    expect(run.exitCode).toBe(1);
    expect(run.results).toEqual([]);
    expect(store.storePersonaLetter).not.toHaveBeenCalled();
    expect(store.inserts).toHaveLength(0);
  });

  it("with every text passing, the same run seals both personas", async () => {
    // Control case: the fixtures above are valid except for the one bad text,
    // so without that text the run stores the personas.
    const store = fakeStore();
    const deps = depsFor(
      {
        "letters/fake-fuel.txt": passingFuelText(),
        "letters/fake-text.txt": TEXT_BODY,
      },
      { "fake-text": TEXT_ANSWERS },
      store,
    );

    const run = await sealPersonas(deps);

    expect(run.problems).toEqual([]);
    expect(run.results.map((r) => r.result)).toEqual(["stored", "stored"]);
    expect(store.storePersonaLetter).toHaveBeenCalledTimes(2);
  });
});
