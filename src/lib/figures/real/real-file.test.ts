// Offline checks on the committed real figure file (spec 04-real-figures).
//
// fuel-figures.json holds official fuel prices written by scripts/prefetch-figures.
// These tests read the committed file with node:fs, load it through the same
// loader the app uses, and check every figure's provenance. No network.
//
// Reference URLs below are the ones recorded beside each series in
// src/lib/figures/catalogue.ts. They are copied here on purpose: if the catalogue
// changes a reference page, this test must be updated with it.

import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CATALOGUE } from "../catalogue";
import { loadFigureFile } from "../load";
import { isRealDate } from "../periods";

const FILE_PATH = fileURLToPath(new URL("./fuel-figures.json", import.meta.url));

const EARLIEST_PERIOD = "2023-06-01";
const MAX_FILE_BYTES = 1_000_000;
const RETRIEVED_AT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const PERIOD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PLACEHOLDER_RETRIEVED_AT = "2000-01-01T00:00:00Z";

const CATALOGUE_SOURCE_URLS: Readonly<Record<string, string>> = {
  "us-gasoline-regular":
    "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMM_EPMR_PTE_NUS_DPG&f=W",
  "us-diesel":
    "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMD_EPD2D_PTE_NUS_DPG&f=W",
  "eu-petrol-euro95": "https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en",
  "eu-diesel": "https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en",
};

// The UTC calendar date (YYYY-MM-DD) of an ISO timestamp ending in Z.
function utcDateOf(retrievedAt: string): string {
  return retrievedAt.slice(0, 10);
}

const raw = readFileSync(FILE_PATH, "utf8");
const json: unknown = JSON.parse(raw);
const file = json as {
  fixture: unknown;
  series: unknown[];
  figures: Array<{
    kind: string;
    metric_id: string;
    period: string;
    source: string;
    series_id: string;
    source_url: string;
    retrieved_at: string;
  }>;
};
const loaded = loadFigureFile(json, CATALOGUE);

const CATALOGUE_SERIES_IDS = new Set(CATALOGUE.map((entry) => entry.metric.series_id));
const CATALOGUE_METRIC_IDS = new Set(CATALOGUE.map((entry) => entry.metric.id));

describe("committed real figure file", () => {
  it("loads as a real (non-fixture) file with no series of its own", () => {
    expect(file.fixture).toBe(false);
    expect(loaded.fixture).toBe(false);
    expect(file.series).toEqual([]);
  });

  it("is at most 1,000,000 bytes", () => {
    expect(statSync(FILE_PATH).size).toBeLessThanOrEqual(MAX_FILE_BYTES);
  });

  it("has figures for the catalogue series only", () => {
    expect(file.figures.length).toBeGreaterThan(0);
    for (const figure of file.figures) {
      expect(CATALOGUE_METRIC_IDS.has(figure.metric_id)).toBe(true);
    }
  });

  it("gives every figure official provenance from a catalogue series", () => {
    for (const figure of file.figures) {
      expect(figure.kind).toBe("official");
      expect(CATALOGUE_SERIES_IDS.has(figure.series_id)).toBe(true);
      expect(figure.source).not.toContain("FIXTURE");
      expect(figure.series_id).not.toContain("FIXTURE");
    }
  });

  it("dates every figure on or after 2023-06-01 in YYYY-MM-DD form", () => {
    for (const figure of file.figures) {
      expect(figure.period).toMatch(PERIOD_PATTERN);
      expect(isRealDate(figure.period)).toBe(true);
      expect(figure.period >= EARLIEST_PERIOD).toBe(true);
    }
  });

  it("links every figure to the catalogue reference URL for its series", () => {
    for (const figure of file.figures) {
      expect(figure.source_url.startsWith("https://")).toBe(true);
      expect(figure.source_url).toBe(CATALOGUE_SOURCE_URLS[figure.metric_id]);
    }
  });

  it("records a real retrieval time that is not before the figure's period", () => {
    for (const figure of file.figures) {
      expect(figure.retrieved_at).toMatch(RETRIEVED_AT_PATTERN);
      expect(figure.retrieved_at).not.toBe(PLACEHOLDER_RETRIEVED_AT);
      expect(utcDateOf(figure.retrieved_at) >= figure.period).toBe(true);
    }
  });

  it("never has a period later than the UTC date it was retrieved", () => {
    for (const figure of file.figures) {
      expect(figure.period <= utcDateOf(figure.retrieved_at)).toBe(true);
    }
  });
});
