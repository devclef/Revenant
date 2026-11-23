// Guards the layout gate baseline and the pinned Sample_Candidate (spec 18,
// Requirement 11 and the Live_Walk pin in tools/qa/layout-check.mjs).
//
// No date or sample literal is written in this file. The current opening date
// is read from content/personas/personas.json, the pinned seed from
// tools/qa/layout-check.mjs, and the candidates from content/personas/letters/samples.json.
// Retired dates are matched by shape ("Opens {day} {month} {year}"), so this file
// never names one.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  pickSamples,
  type PickQuestion,
} from "../components/reveal/sample-pick";

const REPO_ROOT = resolve(__dirname, "../..");
const BASELINE_PATH = resolve(REPO_ROOT, "tools/qa/layout-gate-baseline.json");
const SAMPLES_PATH = resolve(
  REPO_ROOT,
  "content/personas/letters/samples.json",
);
const PERSONAS_PATH = resolve(REPO_ROOT, "content/personas/personas.json");
const LAYOUT_CHECK_PATH = resolve(REPO_ROOT, "tools/qa/layout-check.mjs");

/** Files that hold walk expectations or baseline rows and must not hold a sample value. */
const SAMPLE_FREE_FILES = [
  "tools/qa/layout-gate-baseline.json",
  "src/test/integration/live-walk.test.ts",
  "src/test/integration/live-walk-helpers.ts",
  "src/test/integration/live-walk-helpers.test.ts",
];

type Baseline = { blockers: { check: string; detail: string }[] };
type Samples = Record<string, Record<string, string[]>>;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/** The opening date as the envelope writes it, in UTC, in en-GB day-date form. */
function formatOpeningDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The seed the layout check pins for the sample pick (SAMPLE_SEED in layout-check.mjs). */
function pinnedSampleSeed(): number {
  const source = readFileSync(LAYOUT_CHECK_PATH, "utf8");
  const match = /^const SAMPLE_SEED = (\d+);$/m.exec(source);
  if (!match)
    throw new Error("SAMPLE_SEED is not declared in tools/qa/layout-check.mjs");
  return Number(match[1]);
}

const DATE_IN_OPENS = /Opens (\d{1,2} [A-Za-z]+ \d{4})/g;

describe("layout gate baseline GO1 rows", () => {
  const baseline = readJson<Baseline>(BASELINE_PATH);
  const go1Rows = baseline.blockers.filter((row) => row.check === "GO1");
  const personas = readJson<{ personas: { opens_at: string }[] }>(
    PERSONAS_PATH,
  ).personas;
  const currentOpening = formatOpeningDate(personas[0].opens_at);

  it("reads the current opening date from the persona list", () => {
    expect(personas.length).toBeGreaterThan(0);
    for (const persona of personas) {
      expect(formatOpeningDate(persona.opens_at)).toBe(currentOpening);
    }
  });

  it("has GO1 rows that name the current opening date", () => {
    const named = go1Rows.filter((row) =>
      row.detail.includes(`Opens ${currentOpening}`),
    );
    expect(named.length).toBeGreaterThan(0);
  });

  it("holds no GO1 row with any other opening date", () => {
    const stale: string[] = [];
    for (const row of go1Rows) {
      for (const match of row.detail.matchAll(DATE_IN_OPENS)) {
        if (match[1] !== currentOpening) stale.push(row.detail);
      }
    }
    expect(stale).toEqual([]);
  });
});

describe("pinned Sample_Candidate", () => {
  const samples = readJson<Samples>(SAMPLES_PATH);
  const seed = pinnedSampleSeed();

  it("is pinned to seed 1", () => {
    expect(seed).toBe(1);
  });

  it("picks one of the four candidates for every persona figure at the pinned seed", () => {
    for (const [personaKey, byMetric] of Object.entries(samples)) {
      const metricIds = Object.keys(byMetric);
      const questions = metricIds.map((metricId) => ({
        id: `q-${personaKey}-${metricId}`,
        answer_type: "number",
        metric_id: metricId,
      })) as unknown as PickQuestion[];

      const picked = pickSamples(byMetric, questions, seed);

      for (const metricId of metricIds) {
        const candidates = byMetric[metricId];
        expect(candidates, `${personaKey} ${metricId}`).toHaveLength(4);
        const value = picked[`q-${personaKey}-${metricId}`];
        expect(candidates, `${personaKey} ${metricId}`).toContain(value);
      }
    }
  });
});

describe("sample values stay out of tests and baseline", () => {
  const samples = readJson<Samples>(SAMPLES_PATH);
  const values = [
    ...new Set(
      Object.values(samples).flatMap((byMetric) =>
        Object.values(byMetric).flat(),
      ),
    ),
  ];

  it.each(SAMPLE_FREE_FILES)("%s holds no quoted sample value", (file) => {
    const text = readFileSync(resolve(REPO_ROOT, file), "utf8");
    const found = values.filter((value) => {
      const escaped = value.replace(/\./g, "\\.");
      return new RegExp(`["'\`]${escaped}["'\`]`).test(text);
    });
    expect(found).toEqual([]);
  });
});
