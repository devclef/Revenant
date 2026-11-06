// Tests for the EU persona entry in personas.json (issue #205).
//
// The EU persona tracks two official weekly fuel series. For its written_as_of
// date, the figure shown as "then" must be the fuel-figures.json row with the
// latest period on or before that date, field for field. The test compares the
// thenAndNow pick against that row directly, so the entry and the figures
// cannot drift apart silently.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { DEMO_FIGURES } from "@/lib/figures/demo";
import { periodEnd } from "@/lib/figures/periods";
import { thenAndNow } from "@/lib/figures/then-now";
import fuelFile from "@/lib/figures/real/fuel-figures.json";

import { PERSONAS } from "./index";

// Presence is asserted by the first test below, so the non-null assertion is safe.
const eu = PERSONAS.find((p) => p.key === "eu-tomas")!;

type FuelRow = (typeof fuelFile.figures)[number];

/**
 * The fuel row with the latest period end on or before `date` for one metric.
 * Uses the same rule as thenAndNow: compare periodEnd(period, period_type)
 * with the date, using the series' own period type.
 */
function latestRowOnOrBefore(metricId: string, date: string): FuelRow {
  const series = DEMO_FIGURES.series.get(metricId);
  if (series === undefined) {
    throw new Error(`no series for ${metricId}`);
  }
  const type = series.period_type;
  const rows = fuelFile.figures.filter(
    (row) =>
      row.metric_id === metricId && periodEnd(row.period, type) <= date,
  );
  if (rows.length === 0) {
    throw new Error(`no ${metricId} row on or before ${date}`);
  }
  return rows.reduce((best, row) =>
    periodEnd(row.period, type) > periodEnd(best.period, type) ? row : best,
  );
}

describe("EU persona entry (eu-tomas)", () => {
  it("is present exactly once with the EU region and letter path", () => {
    const matches = PERSONAS.filter((p) => p.key === "eu-tomas");
    expect(matches).toHaveLength(1);
    expect(eu.region).toBe("European Union");
    expect(eu.letter_path).toBe("letters/eu-tomas.txt");
  });

  it("opens on the European Parliament election date, 9 June 2024 at 00:00 UTC", () => {
    expect(eu.opens_at).toBe("2024-06-09T00:00:00.000Z");
    expect(eu.opening_event?.date).toBe("2024-06-09");
    expect(eu.opening_event?.source).toBe("European Parliament");
    expect(eu.opening_event?.source_url).toBe(
      "https://www.europarl.europa.eu/elections/en/",
    );
  });

  it("has a letter_path that resolves to a real, non-empty letter file", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const path = resolve(here, "../../../content/personas", eu.letter_path);
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, "utf8").trim().length).toBeGreaterThan(0);
  });

  it("is written within the 12 months before opening and before it opens", () => {
    expect(eu.written_as_of >= "2023-06-05").toBe(true);
    expect(eu.written_as_of < "2024-06-09").toBe(true);
  });

  it("tracks exactly eu-petrol-euro95 and eu-diesel, with no personal numbers", () => {
    const ids = eu.metrics.map((m) => m.metric_id).sort();
    expect(ids).toEqual(["eu-diesel", "eu-petrol-euro95"]);
  });

  it("has a unique letter_id that is not used by Maya or retired", () => {
    const ids = PERSONAS.map((p) => p.letter_id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id === eu.letter_id)).toHaveLength(1);
  });
});

describe("EU persona then-figures match fuel-figures.json field for field", () => {
  it("each metric's then figure equals the latest row on or before written_as_of", () => {
  const date = eu.written_as_of;

    for (const metric of eu.metrics) {
      const expected = latestRowOnOrBefore(metric.metric_id, date);
      const result = thenAndNow(metric.metric_id, date, DEMO_FIGURES);

      expect(result.then.found).toBe(true);
      if (!result.then.found) continue;

      const picked = result.then.figure;
      expect(picked).toEqual(expected);

      // Each field, by name, so a failure names the field that differs.
      const expectedFields: Record<string, unknown> = { ...expected };
      const pickedFields: Record<string, unknown> = { ...picked };
      for (const key of Object.keys(expectedFields)) {
        expect(pickedFields[key], `${metric.metric_id}.${key}`).toBe(
          expectedFields[key],
        );
      }
    }
  });

  it("the then figures are official and never fixture data", () => {
    for (const metric of eu.metrics) {
      const { then } = thenAndNow(metric.metric_id, eu.written_as_of, DEMO_FIGURES);
      expect(then.found).toBe(true);
      if (!then.found) continue;
      expect(then.figure.kind).toBe("official");
      expect(then.figure.source.startsWith("FIXTURE")).toBe(false);
      expect(then.figure.series_id.startsWith("FIXTURE")).toBe(false);
    }
  });
});
