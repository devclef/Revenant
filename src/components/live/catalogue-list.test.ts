import { describe, expect, it } from "vitest";

import { isFixtureFigure } from "@/lib/figures";
import { DEMO_FIGURES } from "@/lib/figures/demo";

import {
  groupPickable,
  listPickableSeries,
  regionGroupFor,
  type PickableSeries,
} from "./catalogue-list";
import { catalogueMetric, figureFor, fixtureMetric, makeFigures } from "./test-figures";

const US = catalogueMetric("us-gasoline-regular");
const DIESEL = catalogueMetric("us-diesel");
const EU = catalogueMetric("eu-petrol-euro95");

describe("listPickableSeries", () => {
  it("keeps catalogue order and drops a series with no figures", () => {
    const figures = makeFigures([
      { metric: US, figures: [{ period: "2024-01-01", value: "3.10" }] },
      { metric: DIESEL, figures: [] },
      { metric: EU, figures: [{ period: "2024-01-01", value: "1800.00" }] },
    ]);

    const ids = listPickableSeries(figures).map((s) => s.metricId);

    expect(ids).toEqual(["us-gasoline-regular", "eu-petrol-euro95"]);
  });

  it("never reorders by movement: a series that rose most still keeps its place", () => {
    const figures = makeFigures([
      {
        metric: US,
        figures: [
          { period: "2024-01-01", value: "3.00" },
          { period: "2024-01-08", value: "3.01" },
        ],
      },
      {
        metric: DIESEL,
        figures: [
          { period: "2024-01-01", value: "1.00" },
          { period: "2026-10-26", value: "9.00" },
        ],
      },
    ]);

    const ids = listPickableSeries(figures).map((s) => s.metricId);

    expect(ids).toEqual(["us-gasoline-regular", "us-diesel"]);
  });

  it("reports the latest period, unit, region and display name from the series", () => {
    const figures = makeFigures([
      {
        metric: US,
        figures: [
          { period: "2024-01-01", value: "3.00" },
          { period: "2026-10-26", value: "3.41" },
        ],
      },
    ]);

    const [entry] = listPickableSeries(figures);

    expect(entry).toEqual({
      metricId: "us-gasoline-regular",
      displayName: US.display_name,
      unit: "USD per gallon",
      region: "U.S.",
      latestPeriod: "2026-10-26",
      isFixture: false,
    });
  });

  it("marks a series fixture only when its latest figure is fixture data", () => {
    const fixture = fixtureMetric("fixture-us-gasoline-regular");
    const mixedEarlyFixture = makeFigures([
      {
        metric: fixture,
        figures: [{ period: "2024-01-01", value: "3.00" }],
      },
      {
        metric: US,
        figures: [
          { period: "2024-01-01", value: "3.00" },
          { period: "2026-10-26", value: "3.41" },
        ],
      },
    ]);

    const byId = new Map(
      listPickableSeries(mixedEarlyFixture).map((s) => [s.metricId, s]),
    );

    expect(byId.get("fixture-us-gasoline-regular")?.isFixture).toBe(true);
    expect(byId.get("us-gasoline-regular")?.isFixture).toBe(false);
  });

  it("uses isFixtureFigure on the latest figure, not an earlier one", () => {
    // Fixture figure first, real figure last: the series is not fixture.
    const latestReal = makeFigures([
      {
        metric: US,
        figures: [
          { period: "2024-01-01", value: "3.00" },
          { period: "2026-10-26", value: "3.41" },
        ],
      },
    ]);
    const [entry] = listPickableSeries(latestReal);
    const latest = latestReal.series.get("us-gasoline-regular")!.figures.at(-1)!;

    expect(entry.isFixture).toBe(isFixtureFigure(latest));
    expect(entry.isFixture).toBe(false);

    // A figure that is fixture only by its series_id is still fixture.
    const fixtureFig = figureFor(fixtureMetric("fixture-series-x"), "2026-10-26", "1.00");
    expect(isFixtureFigure(fixtureFig)).toBe(true);
  });

  it("lists every series with figures in the demo figures, in the same order", () => {
    const expected = [...DEMO_FIGURES.series]
      .filter(([, s]) => s.figures.length > 0)
      .map(([id]) => id);

    const entries = listPickableSeries(DEMO_FIGURES);

    expect(entries.map((s) => s.metricId)).toEqual(expected);
    for (const entry of entries) {
      const series = DEMO_FIGURES.series.get(entry.metricId)!;
      const latest = series.figures.at(-1)!;
      expect(entry.latestPeriod).toBe(latest.period);
      expect(entry.isFixture).toBe(isFixtureFigure(latest));
    }
  });
});

describe("regionGroupFor", () => {
  it("maps U.S. to us", () => {
    expect(regionGroupFor("U.S.")).toBe("us");
  });

  it("maps any EU region to eu", () => {
    expect(regionGroupFor("EU27, weighted average")).toBe("eu");
    expect(regionGroupFor("EU")).toBe("eu");
  });

  it("returns null for Sweden and any unknown region", () => {
    expect(regionGroupFor("Sweden")).toBeNull();
    expect(regionGroupFor("Mars colony")).toBeNull();
  });
});

describe("groupPickable", () => {
  const item = (metricId: string, region: string): PickableSeries => ({
    metricId,
    displayName: metricId,
    unit: "unit",
    region,
    latestPeriod: "2024-01-01",
    isFixture: false,
  });

  it("returns US then EU, whatever the input order", () => {
    const groups = groupPickable([
      item("eu-a", "EU27, weighted average"),
      item("us-a", "U.S."),
    ]);

    expect(groups.map((g) => g.group)).toEqual(["us", "eu"]);
  });

  it("keeps catalogue order within each group", () => {
    const groups = groupPickable([
      item("us-1", "U.S."),
      item("eu-1", "EU27, weighted average"),
      item("us-2", "U.S."),
      item("eu-2", "EU27, weighted average"),
    ]);

    expect(groups[0].series.map((s) => s.metricId)).toEqual(["us-1", "us-2"]);
    expect(groups[1].series.map((s) => s.metricId)).toEqual(["eu-1", "eu-2"]);
  });

  it("leaves out an empty group", () => {
    const groups = groupPickable([item("us-1", "U.S.")]);

    expect(groups.map((g) => g.group)).toEqual(["us"]);
    expect(groupPickable([])).toEqual([]);
  });

  it("leaves out Sweden and unknown regions rather than inventing a heading", () => {
    const groups = groupPickable([
      item("se-1", "Sweden"),
      item("xx-1", "Mars colony"),
      item("us-1", "U.S."),
    ]);

    expect(groups).toEqual([{ group: "us", series: [item("us-1", "U.S.")] }]);
  });
});
