// Offline checks on the eight Persona_Figures (spec 18-persona-dates, task 3).
//
// Every row is read from the committed fuel-figures.json through thenAndNow
// (the "then" figure at the written-as-of date) and figureAtOpening (the
// at-opening figure at the opening date). No value is typed in here: the test
// checks that each row carries full provenance.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { figureAtOpening } from "../at-opening";
import { CATALOGUE } from "../catalogue";
import { loadFigureFile } from "../load";
import { thenAndNow } from "../then-now";

const FILE_PATH = fileURLToPath(
  new URL("./fuel-figures.json", import.meta.url),
);
const WRITTEN_AS_OF = "2024-11-17";
const OPENS_AT = "2026-11-17T00:00:00.000Z";

const PERSONA_METRICS: ReadonlyArray<{ persona: string; metric: string }> = [
  { persona: "us-maya", metric: "us-gasoline-regular" },
  { persona: "us-maya", metric: "us-diesel" },
  { persona: "eu-tomas", metric: "eu-petrol-euro95" },
  { persona: "eu-tomas", metric: "eu-diesel" },
];

const loaded = loadFigureFile(
  JSON.parse(readFileSync(FILE_PATH, "utf8")),
  CATALOGUE,
);

// The figure union has a self-reported variant without source_url, so the
// provenance check reads fields by name through a plain record view.
function asRecord(figure: object): Record<string, unknown> {
  return figure as Record<string, unknown>;
}

const PROVENANCE_FIELDS = [
  "value",
  "unit",
  "region",
  "period",
  "source",
  "series_id",
  "source_url",
  "retrieved_at",
] as const;

describe("Persona_Figures: then figures at the written-as-of date", () => {
  for (const { persona, metric } of PERSONA_METRICS) {
    it(`${persona} ${metric} has full provenance`, () => {
      const result = thenAndNow(metric, WRITTEN_AS_OF, loaded).then;
      expect(result.found, `${persona} ${metric}`).toBe(true);
      if (!result.found) return;
      const row = asRecord(result.figure);
      for (const field of PROVENANCE_FIELDS) {
        expect(row[field], `${persona} ${metric} ${field}`).toBeTruthy();
      }
      expect(result.figure.period <= WRITTEN_AS_OF).toBe(true);
    });
  }
});

describe("Persona_Figures: at-opening figures", () => {
  for (const { persona, metric } of PERSONA_METRICS) {
    it(`${persona} ${metric} has full provenance`, () => {
      const result = figureAtOpening(metric, OPENS_AT, loaded);
      expect(result.found, `${persona} ${metric}`).toBe(true);
      if (!result.found) return;
      const row = asRecord(result.figure);
      for (const field of PROVENANCE_FIELDS) {
        expect(row[field], `${persona} ${metric} ${field}`).toBeTruthy();
      }
      expect(result.figure.period <= OPENS_AT.slice(0, 10)).toBe(true);
    });
  }
});
