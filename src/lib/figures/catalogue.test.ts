// Tests for the figure-series catalogue (spec 02-demo-figures).
//
// The catalogue holds metric definitions only. These tests guard the
// non-negotiables: every metric validates against the sealed-letter schema
// (data-integrity.md, one schema only), no catalogue entry is fixture data,
// display_name carries no change or judgement words (neutrality.md), the ID
// order is fixed, only the EU entries rescale EUR per 1,000 litres to per
// litre, and every entry is weekly. No network.

import { describe, expect, it } from "vitest";

import { metricDefinitionV1Schema } from "@/lib/seal-format";

import { CATALOGUE } from "./catalogue";
import { isFixtureMetric } from "./fixture";

describe("CATALOGUE", () => {
  it("every metric passes metricDefinitionV1Schema", () => {
    for (const series of CATALOGUE) {
      const result = metricDefinitionV1Schema.safeParse(series.metric);
      expect(result.success, `metric ${series.metric.id} failed schema`).toBe(
        true,
      );
    }
  });

  it("no catalogue metric is detected as fixture data", () => {
    for (const series of CATALOGUE) {
      expect(
        isFixtureMetric(series.metric),
        `metric ${series.metric.id} is fixture`,
      ).toBe(false);
    }
  });

  it("no display_name contains a change or judgement word", () => {
    const changeWords = [
      "rose",
      "fell",
      "soared",
      "plunged",
      "cheaper",
      "expensive",
    ];
    for (const series of CATALOGUE) {
      const name = series.metric.display_name.toLowerCase();
      for (const word of changeWords) {
        expect(
          name.includes(word),
          `metric ${series.metric.id} display_name contains "${word}"`,
        ).toBe(false);
      }
    }
  });

  it("has the four series in a fixed ID order", () => {
    expect(CATALOGUE.map((s) => s.metric.id)).toEqual([
      "us-gasoline-regular",
      "us-diesel",
      "eu-petrol-euro95",
      "eu-diesel",
    ]);
  });

  it("only the two EU entries carry display_rescale ÷1000 to EUR per litre", () => {
    for (const series of CATALOGUE) {
      const isEu = series.metric.id.startsWith("eu-");
      if (isEu) {
        expect(
          series.display_rescale,
          `EU metric ${series.metric.id} missing display_rescale`,
        ).toEqual({ divisor: 1000, unit: "EUR per litre" });
      } else {
        expect(
          series.display_rescale,
          `US metric ${series.metric.id} should not have display_rescale`,
        ).toBeUndefined();
      }
    }
  });

  it("every entry is weekly", () => {
    for (const series of CATALOGUE) {
      expect(series.period_type, `metric ${series.metric.id}`).toBe("weekly");
    }
  });
});
