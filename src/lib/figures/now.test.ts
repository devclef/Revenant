// Tests for the browser's Figures_API helpers (spec 08-judge-polish, Property 24
// and the example cases in tasks.md task 14).
//
// Property 24 is checked with fast-check against an independent oracle: a
// figure is picked by its series alone (source, series ID, unit and region),
// never by display name or metric ID.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import type { FigureV1, MetricDefinitionV1 } from "@/lib/seal-format";

import fetchStatus from "./real/fetch-status.json";
import {
  parseFiguresResponse,
  pickNow,
  type FiguresResponseV1,
} from "./now";

type OfficialFigure = Extract<FigureV1, { kind: "official" }>;

const RETRIEVED_AT = "2026-11-01T16:39:37Z";
const SOURCE_URL = "https://www.eia.gov/dnav/pet/";

const EIA_METRIC: MetricDefinitionV1 = {
  id: "us-gasoline-regular",
  display_name: "Regular gasoline",
  unit: "USD per gallon",
  region: "U.S.",
  source: "U.S. Energy Information Administration (EIA)",
  series_id: "EMM_EPMR_PTE_NUS_DPG",
};

function officialFigure(
  overrides: Partial<Extract<FigureV1, { kind: "official" }>> = {},
): FigureV1 {
  return {
    kind: "official",
    metric_id: "us-gasoline-regular",
    value: "3.412",
    unit: "USD per gallon",
    region: "U.S.",
    period: "2026-10-26",
    source: "U.S. Energy Information Administration (EIA)",
    series_id: "EMM_EPMR_PTE_NUS_DPG",
    retrieved_at: RETRIEVED_AT,
    source_url: SOURCE_URL,
    ...overrides,
  };
}

function response(
  series: FiguresResponseV1["series"],
): FiguresResponseV1 {
  return {
    format: "revenant-figures-v1",
    generated_at: "2026-11-05T15:00:00Z",
    source_mode: "file",
    series,
  };
}

function entry(
  metric: MetricDefinitionV1,
  figure: FigureV1 | null,
): FiguresResponseV1["series"][number] {
  return {
    metric,
    period_type: "weekly",
    last_success_at: "2026-11-05T06:30:00Z",
    figure,
  };
}

describe("parseFiguresResponse", () => {
  const valid = response([entry(EIA_METRIC, officialFigure())]);

  it("accepts a well-formed body and returns it unchanged", () => {
    const result = parseFiguresResponse(valid);
    expect(result).toEqual({ ok: true, value: valid });
  });

  it("accepts an entry with no figure and no last success", () => {
    const body = response([
      { ...entry(EIA_METRIC, null), last_success_at: null },
    ]);
    expect(parseFiguresResponse(body).ok).toBe(true);
  });

  it("rejects a body with the wrong format tag", () => {
    expect(parseFiguresResponse({ ...valid, format: "other" })).toEqual({
      ok: false,
    });
  });

  it("rejects an unknown period_type", () => {
    const body = {
      ...response([entry(EIA_METRIC, null)]),
      series: [{ ...entry(EIA_METRIC, null), period_type: "daily" }],
    };
    expect(parseFiguresResponse(body)).toEqual({ ok: false });
  });

  it("rejects an extra key on a series entry", () => {
    const body = {
      ...valid,
      series: [{ ...valid.series[0], note: "extra" }],
    };
    expect(parseFiguresResponse(body)).toEqual({ ok: false });
  });

  it("rejects a figure with a non-https source_url", () => {
    const body = response([
      entry(
        EIA_METRIC,
        officialFigure({ source_url: "http://example.org/x" }),
      ),
    ]);
    expect(parseFiguresResponse(body)).toEqual({ ok: false });
  });

  it("rejects a non-object body", () => {
    expect(parseFiguresResponse(null)).toEqual({ ok: false });
    expect(parseFiguresResponse("revenant-figures-v1")).toEqual({ ok: false });
  });
});

describe("pickNow examples", () => {
  it("returns the figure of the entry with the same source, series, unit and region", () => {
    const figure = officialFigure({ value: "3.541", period: "2026-10-19" });
    const body = response([
      entry(
        { ...EIA_METRIC, id: "other", display_name: "Other", series_id: "OTHER" },
        officialFigure({ series_id: "OTHER" }),
      ),
      entry(EIA_METRIC, figure),
    ]);
    expect(pickNow(officialFigure(), EIA_METRIC, body)).toEqual({
      found: true,
      figure,
    });
  });

  it("gives no_figure when the matching entry has figure null", () => {
    const body = response([entry(EIA_METRIC, null)]);
    expect(pickNow(officialFigure(), EIA_METRIC, body)).toEqual({
      found: false,
      reason: "no_figure",
    });
  });

  it("gives series_missing when no entry matches", () => {
    const body = response([
      entry({ ...EIA_METRIC, series_id: "OTHER_SERIES" }, officialFigure()),
    ]);
    expect(pickNow(officialFigure(), EIA_METRIC, body)).toEqual({
      found: false,
      reason: "series_missing",
    });
  });

  it("gives series_missing when only the unit differs", () => {
    const body = response([
      entry({ ...EIA_METRIC, unit: "USD per litre" }, officialFigure()),
    ]);
    expect(pickNow(officialFigure(), EIA_METRIC, body)).toEqual({
      found: false,
      reason: "series_missing",
    });
  });

  it("gives series_missing when only the region differs", () => {
    const body = response([
      entry({ ...EIA_METRIC, region: "EU" }, officialFigure()),
    ]);
    expect(pickNow(officialFigure(), EIA_METRIC, body)).toEqual({
      found: false,
      reason: "series_missing",
    });
  });

  it("gives series_missing when only the source differs", () => {
    const body = response([
      entry({ ...EIA_METRIC, source: "Eurostat" }, officialFigure()),
    ]);
    expect(pickNow(officialFigure(), EIA_METRIC, body)).toEqual({
      found: false,
      reason: "series_missing",
    });
  });

  it("never matches a self-reported figure, even against a self-reported entry", () => {
    const selfMetric: MetricDefinitionV1 = {
      ...EIA_METRIC,
      source: "self-reported",
      series_id: "rent",
      unit: "USD per month",
    };
    const selfFigure: FigureV1 = {
      kind: "self-reported",
      metric_id: "rent",
      value: "1200",
      unit: "USD per month",
      region: "U.S.",
      period: "2026-10",
      source: "self-reported",
      series_id: "rent",
      retrieved_at: RETRIEVED_AT,
    };
    const body = response([
      entry(selfMetric, officialFigure({ series_id: "rent", source: "self-reported" })),
    ]);
    expect(pickNow(selfFigure, selfMetric, body)).toEqual({
      found: false,
      reason: "series_missing",
    });
  });
});

describe("Property 24: the browser picks the now figure by its series alone", () => {
  const sources = ["U.S. EIA", "European Commission"];
  const seriesIds = ["EMM_EPMR_PTE_NUS_DPG", "PRI_EU_SUPER95"];
  const units = ["USD per gallon", "EUR per litre"];
  const regions = ["U.S.", "EU"];

  // One entry per (source, series, unit, region) tuple, so "the one entry" is
  // well defined. Display names, metric IDs and periods vary freely, to show
  // that they do not take part in the match.
  const metricArb = fc.record({
    id: fc.stringMatching(/^[a-z]{3,8}$/),
    display_name: fc.stringMatching(/^[A-Za-z ]{1,20}$/),
    source: fc.constantFrom(...sources),
    series_id: fc.constantFrom(...seriesIds),
    unit: fc.constantFrom(...units),
    region: fc.constantFrom(...regions),
  });

  const figureArb = fc
    .record({
      value: fc.constantFrom("3.412", "0.5", "1234.000001"),
      period: fc.constantFrom("2026-10-26", "2026-09-28", "2026-08-03"),
      retrieved_at: fc.constant(RETRIEVED_AT),
    })
    .map(
      ({ value, period, retrieved_at }): OfficialFigure => ({
        kind: "official",
        metric_id: "anything",
        value,
        unit: "unused",
        region: "unused",
        period,
        source: "unused",
        series_id: "unused",
        retrieved_at,
        source_url: SOURCE_URL,
      }),
    );

  const seriesArb = fc
    .uniqueArray(
      fc.record({
        metric: metricArb,
        figure: fc.option(figureArb, { nil: null }),
      }),
      {
        maxLength: 6,
        selector: (e) =>
          [
            e.metric.source,
            e.metric.series_id,
            e.metric.unit,
            e.metric.region,
          ].join("|"),
      },
    );

  const sealedArb = fc.record({
    metric: metricArb,
    figure: figureArb,
  });

  it("matches the oracle for any response and any sealed official figure", () => {
    fc.assert(
      fc.property(seriesArb, sealedArb, (entries, sealed) => {
        const body = response(
          entries.map((e) => ({
            metric: e.metric,
            period_type: "weekly" as const,
            last_success_at: null,
            figure: e.figure,
          })),
        );

        const sealedFigure: OfficialFigure = {
          ...sealed.figure,
          kind: "official",
          source: sealed.metric.source,
          series_id: sealed.metric.series_id,
          unit: sealed.metric.unit,
          region: sealed.metric.region,
        };

        const matches = entries.filter(
          (e) =>
            e.metric.source === sealed.metric.source &&
            e.metric.series_id === sealed.metric.series_id &&
            e.metric.unit === sealed.metric.unit &&
            e.metric.region === sealed.metric.region,
        );

        const expected =
          matches.length === 0
            ? { found: false, reason: "series_missing" }
            : matches[0].figure === null
              ? { found: false, reason: "no_figure" }
              : { found: true, figure: matches[0].figure };

        expect(pickNow(sealedFigure, sealed.metric, body)).toEqual(expected);
      }),
      { numRuns: 300 },
    );
  });

  it("ignores display name and metric id when the series matches", () => {
    fc.assert(
      fc.property(figureArb, metricArb, metricArb, (figure, a, b) => {
        const sealedMetric = { ...a, source: sources[0], series_id: seriesIds[0], unit: units[0], region: regions[0] };
        const listed = { ...b, source: sealedMetric.source, series_id: sealedMetric.series_id, unit: sealedMetric.unit, region: sealedMetric.region };
        const body = response([entry(listed, figure)]);
        expect(
          pickNow({ ...figure, source: sealedMetric.source, series_id: sealedMetric.series_id, unit: sealedMetric.unit, region: sealedMetric.region }, sealedMetric, body),
        ).toEqual({ found: true, figure });
      }),
      { numRuns: 100 },
    );
  });
});

describe("fetch-status.json", () => {
  it("starts as an empty series map", () => {
    expect(fetchStatus).toEqual({});
  });
});
