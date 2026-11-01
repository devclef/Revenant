// Unit tests for mergeLoadedFigures (spec 04-real-figures, R9; issue #81).
//
// Covers: series object identity, shared IDs allowed only for the same catalogue
// metric with at most one side holding figures, rejected duplicates throwing
// duplicate_metric_id at merged.series.<id>, the fixture OR rule, and that the
// result is frozen. No network.
//
// Fixture data below is FIXTURE-labelled (source, series_id and metric IDs all
// start with FIXTURE), in the same source format as the real EIA figures. It is
// never presented as real data.

import { describe, expect, it } from "vitest";

import type { FigureV1, MetricDefinitionV1 } from "@/lib/seal-format";

import { CATALOGUE } from "./catalogue";
import { FigureDataError, loadFigureFile } from "./load";
import { mergeLoadedFigures } from "./merge";
import type { CatalogueSeries, FigureFile, LoadedFigures } from "./types";

// --- Helpers -----------------------------------------------------------------

type OfficialFigure = Extract<FigureV1, { kind: "official" }>;

// The first catalogue entry (weekly EIA gasoline) and the second (weekly EIA diesel).
const GAS: MetricDefinitionV1 = CATALOGUE[0].metric;
const DIESEL: MetricDefinitionV1 = CATALOGUE[1].metric;

// A FIXTURE-prefixed series defined inside a fixture file.
const FIXTURE_SERIES_ID = "fixture-merge-weekly";
const FIXTURE_SERIES: CatalogueSeries = {
  metric: {
    id: FIXTURE_SERIES_ID,
    display_name: "Fixture merge series (fixture)",
    unit: "FIXTURE unit",
    region: "FIXTURE region",
    source: "FIXTURE source weekly",
    series_id: "FIXTURE-MERGE-WEEKLY",
  },
  period_type: "weekly",
};

function official(
  metric: MetricDefinitionV1,
  period: string,
  value: string,
): OfficialFigure {
  return {
    kind: "official",
    metric_id: metric.id,
    value,
    unit: metric.unit,
    region: metric.region,
    period,
    source: metric.source,
    series_id: metric.series_id,
    retrieved_at: "2026-10-30T14:02:11Z",
    source_url: "https://example.invalid/fixture",
  };
}

// A real-format set (fixture: false) loaded against the real catalogue.
// Every catalogue series is present in the result, with figures or without.
function realSet(figures: FigureV1[] = []): LoadedFigures {
  const file: FigureFile = { fixture: false, series: [], figures };
  return loadFigureFile(file, CATALOGUE);
}

// A fixture set (fixture: true) defining its own FIXTURE series.
function fixtureSet(figures: FigureV1[] = []): LoadedFigures {
  const file: FigureFile = {
    fixture: true,
    note: "FIXTURE data for merge tests, not real figures",
    series: [FIXTURE_SERIES],
    figures,
  };
  return loadFigureFile(file, CATALOGUE);
}

function fixtureFigure(period: string, value: string): OfficialFigure {
  return official(FIXTURE_SERIES.metric, period, value);
}

// Capture the error thrown by fn, or fail the test if nothing is thrown.
function thrownBy(fn: () => unknown): FigureDataError {
  try {
    fn();
  } catch (err) {
    if (err instanceof FigureDataError) return err;
    throw err;
  }
  throw new Error("expected mergeLoadedFigures to throw");
}

// Two Mondays in June 2023 (weekly periods are real Mondays).
const MON_1 = "2023-06-05";
const MON_2 = "2023-06-12";

// --- Series identity ---------------------------------------------------------

describe("mergeLoadedFigures: series identity", () => {
  it("keeps the exact series objects from both inputs when IDs are disjoint", () => {
    const a = realSet([official(GAS, MON_1, "3.541")]);
    const b = fixtureSet([fixtureFigure(MON_1, "1.00")]);

    const merged = mergeLoadedFigures(a, b);

    expect(merged.series.get(GAS.id)).toBe(a.series.get(GAS.id));
    expect(merged.series.get(FIXTURE_SERIES_ID)).toBe(
      b.series.get(FIXTURE_SERIES_ID),
    );
  });

  it("holds the same LoadedSeries instance for every ID, not copies", () => {
    const a = realSet([official(GAS, MON_1, "3.541")]);
    const b = realSet([official(DIESEL, MON_1, "3.812")]);

    const merged = mergeLoadedFigures(a, b);

    // Every catalogue ID is shared. The side with figures wins, and a wins
    // when neither side has figures.
    for (const [id, series] of merged.series) {
      const fromB = b.series.get(id);
      const expected =
        fromB !== undefined && fromB.figures.length > 0
          ? fromB
          : a.series.get(id);
      expect(series).toBe(expected);
    }
  });

  it("keeps every catalogue ID from both inputs in the merged map", () => {
    const a = realSet();
    const b = fixtureSet();

    const merged = mergeLoadedFigures(a, b);

    // a's IDs first, then each b ID a does not hold (the shared IDs appear once).
    const expectedIds = [
      ...a.series.keys(),
      ...[...b.series.keys()].filter((id) => !a.series.has(id)),
    ];
    expect([...merged.series.keys()]).toEqual(expectedIds);
  });

  it("uses a's series for a shared ID when only a has figures", () => {
    const a = realSet([official(GAS, MON_1, "3.541")]);
    const b = realSet(); // same catalogue metric, no figures

    const merged = mergeLoadedFigures(a, b);

    expect(merged.series.get(GAS.id)).toBe(a.series.get(GAS.id));
    expect(merged.series.get(GAS.id)?.figures).toHaveLength(1);
  });

  it("uses b's series for a shared ID when only b has figures", () => {
    const a = realSet(); // same catalogue metric, no figures
    const b = realSet([official(GAS, MON_1, "3.541")]);

    const merged = mergeLoadedFigures(a, b);

    expect(merged.series.get(GAS.id)).toBe(b.series.get(GAS.id));
    expect(merged.series.get(GAS.id)?.figures).toHaveLength(1);
  });

  it("keeps a's position for a shared ID taken from b", () => {
    const a = realSet(); // every catalogue ID, no figures
    const b = realSet([official(GAS, MON_1, "3.541")]);

    const merged = mergeLoadedFigures(a, b);

    const expectedOrder = [...a.series.keys()];
    expect([...merged.series.keys()]).toEqual(expectedOrder);
  });

  it("keeps a's series for a shared ID when neither side has figures", () => {
    const a = realSet();
    const b = realSet();

    const merged = mergeLoadedFigures(a, b);

    expect(merged.series.get(GAS.id)).toBe(a.series.get(GAS.id));
  });

  it("rejects a shared ID when both sides have figures", () => {
    const a = realSet([official(GAS, MON_1, "3.541")]);
    const b = realSet([official(GAS, MON_2, "3.560")]);

    const err = thrownBy(() => mergeLoadedFigures(a, b));

    expect(err).toBeInstanceOf(FigureDataError);
    expect(err.rule).toBe("duplicate_metric_id");
    expect(err.path).toBe(`merged.series.${GAS.id}`);
  });

  it("rejects a shared file-defined ID because each load has its own metric object", () => {
    // Same content, but parsed separately, so the metric objects differ.
    const a = fixtureSet(); // FIXTURE series, no figures
    const b = fixtureSet([fixtureFigure(MON_1, "1.00")]);

    const err = thrownBy(() => mergeLoadedFigures(a, b));

    expect(err.rule).toBe("duplicate_metric_id");
    expect(err.path).toBe(`merged.series.${FIXTURE_SERIES_ID}`);
  });

  it("names the offending ID in the error path", () => {
    const a = realSet([official(DIESEL, MON_1, "3.812")]);
    const b = realSet([official(DIESEL, MON_2, "3.900")]);

    const err = thrownBy(() => mergeLoadedFigures(a, b));

    expect(err.path).toBe(`merged.series.${DIESEL.id}`);
    expect(err.message).toContain("duplicate_metric_id");
  });
});

// --- Fixture OR rule ---------------------------------------------------------

describe("mergeLoadedFigures: fixture flag", () => {
  it("is false when neither input is fixture", () => {
    const merged = mergeLoadedFigures(realSet(), realSet());
    expect(merged.fixture).toBe(false);
  });

  it("is true when only a is fixture", () => {
    const merged = mergeLoadedFigures(fixtureSet(), realSet());
    expect(merged.fixture).toBe(true);
  });

  it("is true when only b is fixture", () => {
    const merged = mergeLoadedFigures(realSet(), fixtureSet());
    expect(merged.fixture).toBe(true);
  });

  it("is true when both inputs are fixture", () => {
    const other: CatalogueSeries = {
      ...FIXTURE_SERIES,
      metric: { ...FIXTURE_SERIES.metric, id: "fixture-merge-other", series_id: "FIXTURE-MERGE-OTHER" },
    };
    const otherFile: FigureFile = {
      fixture: true,
      note: "second FIXTURE set for the both-fixture case",
      series: [other],
      figures: [],
    };
    const b = loadFigureFile(otherFile, CATALOGUE);

    const merged = mergeLoadedFigures(fixtureSet(), b);
    expect(merged.fixture).toBe(true);
  });

  it("keeps each FIXTURE figure labelled by its own FIXTURE source", () => {
    const a = realSet([official(GAS, MON_1, "3.541")]);
    const b = fixtureSet([fixtureFigure(MON_1, "1.00")]);
    const merged = mergeLoadedFigures(a, b);

    const fixtureSeries = merged.series.get(FIXTURE_SERIES_ID);
    expect(fixtureSeries?.metric.source.startsWith("FIXTURE")).toBe(true);
    expect(merged.series.get(GAS.id)?.metric.source.startsWith("FIXTURE")).toBe(false);
  });
});

// --- Frozen result -----------------------------------------------------------

describe("mergeLoadedFigures: frozen result", () => {
  it("returns a frozen LoadedFigures object", () => {
    const merged = mergeLoadedFigures(
      realSet([official(GAS, MON_1, "3.541")]),
      fixtureSet([fixtureFigure(MON_1, "1.00")]),
    );

    expect(Object.isFrozen(merged)).toBe(true);
  });

  it("returns a frozen series map", () => {
    const merged = mergeLoadedFigures(realSet(), fixtureSet());

    expect(Object.isFrozen(merged.series)).toBe(true);
  });

  it("does not freeze or change the input sets", () => {
    const a = realSet([official(GAS, MON_1, "3.541")]);
    const b = fixtureSet([fixtureFigure(MON_1, "1.00")]);
    const aKeysBefore = [...a.series.keys()];
    const bKeysBefore = [...b.series.keys()];

    mergeLoadedFigures(a, b);

    expect([...a.series.keys()]).toEqual(aKeysBefore);
    expect([...b.series.keys()]).toEqual(bKeysBefore);
    expect(a.series.get(GAS.id)?.figures).toHaveLength(1);
  });
});
