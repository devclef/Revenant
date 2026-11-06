// Unit tests for the FIXTURE guard in the persona-sealing core
// (data-integrity.md: fixture figures may not be sealed into a persona letter).
//
// No database. A fake store records every write, so the tests can assert that
// a fixture persona never reaches `storePersonaLetter`. The guard runs before
// any read or write, so the fake store must see no call at all.

import { describe, expect, it } from "vitest";

import { PERSONAS, type Persona } from "@/lib/personas";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import type { LoadedFigures, LoadedSeries } from "@/lib/figures";

import {
  assertNoFixtureFigures,
  sealPersonas,
  type Deps,
} from "../../../scripts/seal-personas-core";

// The first persona that tracks at least one metric the demo figures define.
const persona: Persona = PERSONAS.find((p) =>
  p.metrics.some((m) => DEMO_FIGURES.series.has(m.metric_id)),
) as Persona;
const metricId = persona.metrics.find((m) =>
  DEMO_FIGURES.series.has(m.metric_id),
)!.metric_id;
const baseSeries = DEMO_FIGURES.series.get(metricId) as LoadedSeries;

// The element type of a series' figures, so a spread keeps the union shape.
type FigureEntry = LoadedSeries["figures"][number];

function withSeries(series: LoadedSeries): LoadedFigures {
  const map = new Map(DEMO_FIGURES.series);
  map.set(metricId, series);
  return { ...DEMO_FIGURES, series: map };
}

type FakeStore = {
  writes: unknown[];
  lookups: string[];
};

function fakeDeps(figures: LoadedFigures): { deps: Deps; store: FakeStore } {
  const store: FakeStore = { writes: [], lookups: [] };
  const deps: Deps = {
    personas: [persona],
    readLetterText: () => "placeholder letter text",
    figures,
    findLetter: async (id) => {
      store.lookups.push(id);
      return null;
    },
    storePersonaLetter: async (input) => {
      store.writes.push(input);
    },
    now: () => new Date("2026-11-06T13:00:00.000Z"),
    randomBytes: (n) => new Uint8Array(n),
  };
  return { deps, store };
}

describe("FIXTURE guard in persona sealing", () => {
  it("passes for the real demo figures", () => {
    expect(() =>
      assertNoFixtureFigures(PERSONAS, DEMO_FIGURES),
    ).not.toThrow();
  });

  it("throws for a FIXTURE metric source, naming the persona and series ID", () => {
    const figures = withSeries({
      ...baseSeries,
      metric: { ...baseSeries.metric, source: "FIXTURE demo source" },
    });
    const expectedSeriesId = baseSeries.metric.series_id;

    expect(() => assertNoFixtureFigures(PERSONAS, figures)).toThrow(
      `persona "${persona.key}" tracks fixture series "${expectedSeriesId}"`,
    );
  });

  it("throws for a FIXTURE metric series_id, naming the persona and that series ID", () => {
    const fixtureSeriesId = "FIXTURE-SERIES-1";
    const figures = withSeries({
      ...baseSeries,
      metric: { ...baseSeries.metric, series_id: fixtureSeriesId },
    });

    expect(() => assertNoFixtureFigures(PERSONAS, figures)).toThrow(
      `persona "${persona.key}" tracks fixture series "${fixtureSeriesId}"`,
    );
  });

  it("throws for a FIXTURE figure source, naming the persona and the figure's series ID", () => {
    const figures = withSeries({
      ...baseSeries,
      figures: baseSeries.figures.map((f, i) =>
        i === 0
          ? ({ ...f, source: "FIXTURE figure source" } as FigureEntry)
          : f,
      ),
    });
    const expectedSeriesId = baseSeries.figures[0].series_id;

    expect(() => assertNoFixtureFigures(PERSONAS, figures)).toThrow(
      `persona "${persona.key}" tracks fixture series "${expectedSeriesId}"`,
    );
  });

  it("sealPersonas rejects a FIXTURE source and writes nothing to the store", async () => {
    const { deps, store } = fakeDeps(
      withSeries({
        ...baseSeries,
        metric: { ...baseSeries.metric, source: "FIXTURE demo source" },
      }),
    );

    await expect(sealPersonas(deps)).rejects.toThrow(
      `persona "${persona.key}" tracks fixture series`,
    );
    expect(store.writes).toEqual([]);
    expect(store.lookups).toEqual([]);
  });

  it("sealPersonas rejects a FIXTURE series_id and writes nothing to the store", async () => {
    const fixtureSeriesId = "FIXTURE-SERIES-2";
    const { deps, store } = fakeDeps(
      withSeries({
        ...baseSeries,
        metric: { ...baseSeries.metric, series_id: fixtureSeriesId },
      }),
    );

    await expect(sealPersonas(deps)).rejects.toThrow(
      `persona "${persona.key}" tracks fixture series "${fixtureSeriesId}"`,
    );
    expect(store.writes).toEqual([]);
    expect(store.lookups).toEqual([]);
  });
});
