// Fixture-validation tests for the demo figures (spec 02-demo-figures, Task 2).
//
// These lock down the US fuel fixture the persona demo ships: every figure and
// metric parses against the sealed-letter schemas, the data-integrity fixture
// rules (R4.1–R4.7) hold, and the fixture is detected as fixture data. No
// network, no database — the fixture is a JSON file imported at test time, and
// DEMO_FIGURES is the same file after loadFigureFile.

import { describe, expect, it } from "vitest";
import { figureV1Schema, metricDefinitionV1Schema } from "@/lib/seal-format";

import { DEMO_FIGURES } from ".";
import { isFixtureFigure, isFixtureMetric } from "../fixture";
import { CATALOGUE } from "../catalogue";
import fixture from "./us-fuel.fixture.json";

const GASOLINE_ID = "fixture-us-gasoline-regular";
const DIESEL_ID = "fixture-us-diesel";

// Periods that fall inside the demo window vs after it (the ticket's split of
// 3 figures per series in the window and 2 after).
const WINDOW_PERIODS = ["2023-11-06", "2024-05-06", "2024-11-04"];
const AFTER_PERIODS = ["2025-11-03", "2026-10-26"];

describe("us-fuel fixture: shape", () => {
  it("has the top-level fixture flag and a note (R4.1)", () => {
    expect(fixture.fixture).toBe(true);
    expect(typeof fixture.note).toBe("string");
    expect(fixture.note.length).toBeGreaterThan(0);
  });

  it("defines exactly the two US fuel fixture series", () => {
    const ids = fixture.series.map((s) => s.metric.id);
    expect(ids).toEqual([GASOLINE_ID, DIESEL_ID]);
  });

  it("has ten figures, five per series", () => {
    expect(fixture.figures).toHaveLength(10);
    expect(
      fixture.figures.filter((f) => f.metric_id === GASOLINE_ID),
    ).toHaveLength(5);
    expect(
      fixture.figures.filter((f) => f.metric_id === DIESEL_ID),
    ).toHaveLength(5);
  });
});

describe("us-fuel fixture: schema conformance", () => {
  it("every figure parses with figureV1Schema", () => {
    for (const f of fixture.figures) {
      expect(() => figureV1Schema.parse(f)).not.toThrow();
    }
  });

  it("every metric parses with metricDefinitionV1Schema", () => {
    for (const s of fixture.series) {
      expect(() => metricDefinitionV1Schema.parse(s.metric)).not.toThrow();
    }
  });
});

describe("us-fuel fixture: data-integrity rules R4.1–R4.7", () => {
  it("R4.2: every figure source and series_id is FIXTURE-prefixed", () => {
    for (const f of fixture.figures) {
      expect(f.source.startsWith("FIXTURE")).toBe(true);
      expect(f.series_id.startsWith("FIXTURE")).toBe(true);
    }
  });

  it("R4.2: every metric source and series_id is FIXTURE-prefixed", () => {
    for (const s of fixture.series) {
      expect(s.metric.source.startsWith("FIXTURE")).toBe(true);
      expect(s.metric.series_id.startsWith("FIXTURE")).toBe(true);
    }
  });

  it("R4.3: every value matches ^[0-9]+\\.00$", () => {
    for (const f of fixture.figures) {
      expect(f.value).toMatch(/^[0-9]+\.00$/);
    }
  });

  it("R4.4: every retrieved_at is 2000-01-01T00:00:00Z", () => {
    for (const f of fixture.figures) {
      expect(f.retrieved_at).toBe("2000-01-01T00:00:00Z");
    }
  });

  it("R4.5: three figures per series fall in the demo window, two after", () => {
    for (const id of [GASOLINE_ID, DIESEL_ID]) {
      const periods = fixture.figures
        .filter((f) => f.metric_id === id)
        .map((f) => f.period);
      expect(periods.filter((p) => WINDOW_PERIODS.includes(p))).toHaveLength(3);
      expect(periods.filter((p) => AFTER_PERIODS.includes(p))).toHaveLength(2);
    }
  });

  it("R4.6: there are no EU figures or EU series", () => {
    for (const f of fixture.figures) {
      expect(f.region).toBe("U.S.");
      expect(f.unit).toBe("USD per gallon");
    }
    for (const s of fixture.series) {
      expect(s.metric.region).toBe("U.S.");
    }
  });

  it("R4.7: display names are the catalogue names plus ' (fixture)', else equal", () => {
    const byRealId = new Map(CATALOGUE.map((c) => [c.metric.id, c.metric]));
    const pairs: Array<[string, string]> = [
      [GASOLINE_ID, "us-gasoline-regular"],
      [DIESEL_ID, "us-diesel"],
    ];
    for (const [fixtureId, realId] of pairs) {
      const fixtureMetric = fixture.series.find(
        (s) => s.metric.id === fixtureId,
      )!.metric;
      const realMetric = byRealId.get(realId)!;
      expect(fixtureMetric.display_name).toBe(
        `${realMetric.display_name} (fixture)`,
      );
      expect(fixtureMetric.unit).toBe(realMetric.unit);
      expect(fixtureMetric.region).toBe(realMetric.region);
    }
  });
});

describe("us-fuel fixture: detected as fixture data", () => {
  it("every figure is an isFixtureFigure", () => {
    for (const f of fixture.figures) {
      expect(isFixtureFigure(f)).toBe(true);
    }
  });

  it("every metric is an isFixtureMetric", () => {
    for (const s of fixture.series) {
      expect(isFixtureMetric(s.metric)).toBe(true);
    }
  });
});

describe("DEMO_FIGURES: loaded fixture", () => {
  it("is flagged as a fixture", () => {
    expect(DEMO_FIGURES.fixture).toBe(true);
  });

  it("holds the four catalogue series with figures and the two fixture series with five each", () => {
    const keys = [...DEMO_FIGURES.series.keys()];
    expect(keys).toContain(GASOLINE_ID);
    expect(keys).toContain(DIESEL_ID);
    for (const id of [
      "us-gasoline-regular",
      "us-diesel",
      "eu-petrol-euro95",
      "eu-diesel",
    ]) {
      const series = DEMO_FIGURES.series.get(id);
      expect(series).toBeDefined();
      expect(series!.figures.length).toBeGreaterThan(0);
    }
    for (const id of [GASOLINE_ID, DIESEL_ID]) {
      expect(DEMO_FIGURES.series.get(id)!.figures).toHaveLength(5);
    }
    expect(DEMO_FIGURES.fixture).toBe(true);
  });

  it("each loaded series carries five figures sorted oldest first", () => {
    for (const id of [GASOLINE_ID, DIESEL_ID]) {
      const series = DEMO_FIGURES.series.get(id)!;
      expect(series.figures).toHaveLength(5);
      const periods = series.figures.map((f) => f.period);
      expect(periods).toEqual([...periods].sort());
    }
  });
});
