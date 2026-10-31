import { describe, expect, it } from "vitest";
import {
  figureV1Schema,
  metricDefinitionV1Schema,
  payloadV1Schema,
  type FigureV1,
  type MetricDefinitionV1,
} from "../index";

// The single-figure and single-metric schemas must be the exact objects
// payloadV1Schema is built from, so validating a figure on its own and inside a
// payload can never disagree.

const metric: MetricDefinitionV1 = {
  id: "test-metric",
  display_name: "Test metric",
  unit: "TEST unit",
  region: "Test region",
  source: "FIXTURE test source",
  series_id: "FIXTURE-TEST-1",
};

const figure: FigureV1 = {
  metric_id: "test-metric",
  kind: "official",
  value: "1.00",
  unit: "TEST unit",
  region: "Test region",
  period: "2024-11-04",
  source: "FIXTURE test source",
  series_id: "FIXTURE-TEST-1",
  retrieved_at: "2000-01-01T00:00:00Z",
  source_url: "https://example.org/test",
};

describe("payload v1 single-item exports", () => {
  it("are the same schema objects payloadV1Schema uses", () => {
    expect(payloadV1Schema.shape.figures.element).toBe(figureV1Schema);
    expect(payloadV1Schema.shape.metrics.element).toBe(metricDefinitionV1Schema);
  });

  it("accept a valid figure and metric on their own and inside a payload", () => {
    expect(figureV1Schema.parse(figure)).toEqual(figure);
    expect(metricDefinitionV1Schema.parse(metric)).toEqual(metric);
    const payload = {
      format_version: 1,
      letter_text: "Test letter.",
      metrics: [metric],
      figures: [figure],
      recall_questions: [],
    };
    expect(payloadV1Schema.parse(payload)).toEqual(payload);
  });

  it("leave payload v1 rules unchanged: a figure with a dangling metric_id still fails", () => {
    const payload = {
      format_version: 1,
      letter_text: "Test letter.",
      metrics: [metric],
      figures: [{ ...figure, metric_id: "missing" }],
      recall_questions: [],
    };
    expect(figureV1Schema.safeParse(payload.figures[0]).success).toBe(true);
    expect(payloadV1Schema.safeParse(payload).success).toBe(false);
  });
});
