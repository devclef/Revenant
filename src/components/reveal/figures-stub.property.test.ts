// Property 1 for the figures stub: whatever passing figures and metrics it is
// given, the body it builds holds a metric that metricDefinitionV1Schema
// accepts and a figure that figureV1Schema accepts. The stub reads its format
// literal from figuresResponseV1Schema, so the body also keeps that format.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { figuresResponseFrom } from "./figures-stub";
import { figuresResponseV1Schema } from "@/lib/figures/now";
import type { LoadedFigures, LoadedSeries } from "@/lib/figures/types";
import {
  figureV1Schema,
  metricDefinitionV1Schema,
  type FigureV1,
  type MetricDefinitionV1,
} from "@/lib/seal-format";

const shortString = fc.string({ minLength: 1, maxLength: 50 });

const valueArb = fc
  .tuple(fc.integer({ min: 0, max: 99999 }), fc.integer({ min: 0, max: 999 }))
  .map(([whole, frac]) => `${whole}.${frac}`);

const isoArb = fc
  .date({
    min: new Date("1970-01-01T00:00:00.000Z"),
    max: new Date("2099-12-31T23:59:59.999Z"),
    noInvalidDate: true,
  })
  .map((d) => d.toISOString());

const metricArb: fc.Arbitrary<MetricDefinitionV1> = fc.record({
  id: shortString,
  display_name: shortString,
  unit: shortString,
  region: shortString,
  source: shortString,
  series_id: shortString,
});

/** An official or self-reported figure that uses the metric's identity fields. */
function figureArb(metric: MetricDefinitionV1): fc.Arbitrary<FigureV1> {
  const official = fc.record({
    kind: fc.constant("official" as const),
    metric_id: fc.constant(metric.id),
    value: valueArb,
    unit: fc.constant(metric.unit),
    region: fc.constant(metric.region),
    period: shortString,
    source: fc.constant(metric.source),
    series_id: fc.constant(metric.series_id),
    retrieved_at: isoArb,
    source_url: fc.webUrl({ validSchemes: ["https"] }),
  });
  const selfReported = fc.record({
    kind: fc.constant("self-reported" as const),
    metric_id: fc.constant(metric.id),
    value: valueArb,
    unit: fc.constant(metric.unit),
    region: fc.constant(metric.region),
    period: shortString,
    source: fc.constant("self-reported" as const),
    series_id: fc.constant(metric.series_id),
    retrieved_at: isoArb,
  });
  return fc.oneof(official, selfReported) as fc.Arbitrary<FigureV1>;
}

const seriesArb: fc.Arbitrary<LoadedSeries> = metricArb.chain((metric) =>
  fc
    .record({
      period_type: fc.constantFrom("weekly" as const, "monthly" as const),
      figures: fc.array(figureArb(metric), { maxLength: 3 }),
    })
    .map(({ period_type, figures }) => ({
      metric,
      period_type,
      figures,
    })),
);

/** A loaded set of 0 to 4 series, each with a unique metric id. */
const loadedArb: fc.Arbitrary<LoadedFigures> = fc
  .array(seriesArb, { maxLength: 4 })
  .map((entries) => {
    const series = new Map<string, LoadedSeries>();
    entries.forEach((entry, i) => {
      const metric = { ...entry.metric, id: `${i}-${entry.metric.id}` };
      const figures = entry.figures.map((f) => ({ ...f, metric_id: metric.id }));
      series.set(metric.id, { ...entry, metric, figures });
    });
    return { fixture: false, series };
  });

describe("figuresResponseFrom (Property 1)", () => {
  it("every metric and figure in the body is accepted by its schema", () => {
    fc.assert(
      fc.property(loadedArb, (loaded) => {
        const body = figuresResponseFrom(loaded);
        for (const entry of body.series) {
          expect(() => metricDefinitionV1Schema.parse(entry.metric)).not.toThrow();
          if (entry.figure !== null) {
            expect(() => figureV1Schema.parse(entry.figure)).not.toThrow();
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it("keeps the format literal from figuresResponseV1Schema", () => {
    fc.assert(
      fc.property(loadedArb, (loaded) => {
        const body = figuresResponseFrom(loaded);
        expect(body.format).toBe(figuresResponseV1Schema.shape.format.value);
        expect(() => figuresResponseV1Schema.parse(body)).not.toThrow();
      }),
      { numRuns: 100 },
    );
  });
});
