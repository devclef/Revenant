// Tests for the bundled fallback lookup (spec 08-judge-polish, Fallback_Refresh).
// Reads the committed fuel-figures.json through the same loader the app uses.
// No network. The expected values come from the file itself.

import { describe, expect, it } from "vitest";

import fuelFigures from "./real/fuel-figures.json";

import { bundledLatestFigure } from "./bundled-latest";
import { CATALOGUE } from "./catalogue";
import { isFixtureFigure } from "./fixture";
import type { CatalogueSeries } from "./types";

type RawFigure = (typeof fuelFigures.figures)[number];

// The latest row for a metric in the raw file: greatest period, then newest
// retrieved_at. Periods are ISO dates, so string order is date order.
function expectedLatest(metricId: string): RawFigure | null {
  let best: RawFigure | null = null;
  for (const fig of fuelFigures.figures) {
    if (fig.metric_id !== metricId) continue;
    if (
      best === null ||
      fig.period > best.period ||
      (fig.period === best.period && fig.retrieved_at > best.retrieved_at)
    ) {
      best = fig;
    }
  }
  return best;
}

describe("bundledLatestFigure", () => {
  it("returns the latest real figure for each catalogue series in the file, field for field", () => {
    for (const series of CATALOGUE) {
      const expected = expectedLatest(series.metric.id);
      if (expected === null) continue;
      const figure = bundledLatestFigure(series);
      expect(figure).not.toBeNull();
      expect(figure).toEqual(expected);
      expect(figure).toMatchObject({
        value: expect.any(String),
        unit: expect.any(String),
        region: expect.any(String),
        period: expect.any(String),
        source: expect.any(String),
        series_id: expect.any(String),
        source_url: expect.any(String),
        retrieved_at: expect.any(String),
      });
    }
  });

  it("returns a figure for at least one catalogue series", () => {
    const found = CATALOGUE.filter((s) => bundledLatestFigure(s) !== null);
    expect(found.length).toBeGreaterThan(0);
  });

  it("returns null for a series the file holds no figures for", () => {
    const unknown: CatalogueSeries = {
      ...CATALOGUE[0],
      metric: { ...CATALOGUE[0].metric, id: "no-such-series" },
    };
    expect(bundledLatestFigure(unknown)).toBeNull();
  });

  it("never returns a fixture figure", () => {
    for (const series of CATALOGUE) {
      const figure = bundledLatestFigure(series);
      if (figure !== null) {
        expect(isFixtureFigure(figure)).toBe(false);
      }
    }
  });

  it("returns a copy, so changing it does not change the next lookup", () => {
    const series = CATALOGUE.find((s) => bundledLatestFigure(s) !== null);
    if (series === undefined) throw new Error("no bundled figure to test");
    const first = bundledLatestFigure(series);
    if (first === null) throw new Error("no bundled figure to test");
    (first as { value: string }).value = "0.000";
    expect(bundledLatestFigure(series)).not.toEqual(first);
  });
});
