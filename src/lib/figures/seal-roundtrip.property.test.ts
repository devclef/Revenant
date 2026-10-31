// Seal round-trip property tests (spec 02-demo-figures, Task 2).
//
// Properties 1 and 2 from design.md, each one fast-check test with
// { numRuns: 100 }. They take non-empty subsets of the real US fuel fixture
// figures (the data the persona demo ships), build a minimal valid payload,
// and confirm the payload survives the seal canonical-JSON round trip unchanged
// and is still detected as fixture data.
//
// No network, no database: the fixture is a JSON file imported at test time,
// canonicalize and payloadV1Schema come from the sealed-letter format.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { canonicalize, payloadV1Schema } from "@/lib/seal-format";
import type { FigureV1, MetricDefinitionV1 } from "@/lib/seal-format";

import { isFixtureFigure, isFixtureMetric } from "./fixture";
import fixture from "./demo/us-fuel.fixture.json";

// A fixed, schema-valid letter text used for every generated payload.
const LETTER_TEXT = "A letter sealed for the then-and-now demo.";

// The fixture's figures and the metric definitions they can reference. The
// fixture JSON stores metric definitions on series[].metric; a payload needs
// them flat in `metrics`, so build that map once.
const FIXTURE_FIGURES = fixture.figures as unknown as FigureV1[];
const METRIC_BY_ID = new Map<string, MetricDefinitionV1>(
  fixture.series.map((s) => [s.metric.id, s.metric as MetricDefinitionV1]),
);

// A non-empty subset of the fixture figures (preserving their order), as an
// arbitrary. uniqueArray over indices keeps each figure at most once.
const subsetArb: fc.Arbitrary<FigureV1[]> = fc
  .uniqueArray(fc.integer({ min: 0, max: FIXTURE_FIGURES.length - 1 }), {
    minLength: 1,
    maxLength: FIXTURE_FIGURES.length,
  })
  .map((indices) =>
    [...indices].sort((a, b) => a - b).map((i) => FIXTURE_FIGURES[i]),
  );

// Build a minimal payload from a figure subset: fixed letter text, the metrics
// those figures reference (deduped, in first-seen order), no recall questions.
function payloadFor(figures: FigureV1[]) {
  const metricIds: string[] = [];
  for (const f of figures) {
    if (!metricIds.includes(f.metric_id)) metricIds.push(f.metric_id);
  }
  const metrics = metricIds.map((id) => METRIC_BY_ID.get(id)!);
  return {
    format_version: 1 as const,
    letter_text: LETTER_TEXT,
    metrics,
    figures,
    recall_questions: [],
  };
}

describe("fixture subsets seal and parse unchanged", () => {
  // Feature: 02-demo-figures, Property 1: Fixture subsets seal and parse unchanged
  it("Property 1: any non-empty fixture subset passes payloadV1Schema and round-trips deeply equal", () => {
    fc.assert(
      fc.property(subsetArb, (figures) => {
        const payload = payloadFor(figures);

        // The payload is valid.
        expect(payloadV1Schema.safeParse(payload).success).toBe(true);

        // Canonicalize -> JSON.parse -> re-parse against the schema.
        const roundTripped = payloadV1Schema.parse(
          JSON.parse(canonicalize(payload)),
        );

        // Figures are deeply equal to the inputs, in the same order.
        expect(roundTripped.figures).toEqual(figures);

        // Every value string is byte-identical.
        for (let i = 0; i < figures.length; i++) {
          expect(roundTripped.figures[i].value).toBe(figures[i].value);
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: 02-demo-figures, Property 2: Fixture detection survives sealing
  it("Property 2: after the round trip every parsed figure and its metric are still fixture data", () => {
    fc.assert(
      fc.property(subsetArb, (figures) => {
        const payload = payloadFor(figures);
        const roundTripped = payloadV1Schema.parse(
          JSON.parse(canonicalize(payload)),
        );

        for (const f of roundTripped.figures) {
          expect(isFixtureFigure(f)).toBe(true);
        }
        for (const m of roundTripped.metrics) {
          expect(isFixtureMetric(m)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
