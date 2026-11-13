// Feature: 09-demo-polish, task 16 (issue #263): the figure helpers behind the
// Receipt_Card. FigureLine no longer renders a row; receiptFigureOf and
// receiptSourceOf build the data that ReceiptCard draws (C3.1). These tests
// keep the provenance label rules (R13.1-R13.4), the display rescale (R11.10)
// and the source control (R11.2) that the old FigureLine markup tested.

import { describe, expect, it } from "vitest";

import { figureLabel, receiptFigureOf, receiptSourceOf } from "./FigureLine";
import { REVEAL_COPY } from "./copy";
import { formatPeriod, type DisplayRescale } from "@/lib/figures";
import type { FigureV1 } from "@/lib/seal-format";

const OFFICIAL: Readonly<FigureV1> = {
  kind: "official",
  metric_id: "fuel",
  value: "3.412",
  unit: "USD per gallon",
  region: "U.S. city average",
  period: "2024-10",
  source: "U.S. EIA",
  series_id: "EMM_EPMR_PTE_NUS_DPG",
  retrieved_at: "2024-10-30T14:02:11Z",
  source_url: "https://www.eia.gov/series",
};

const FIXTURE: Readonly<FigureV1> = {
  ...OFFICIAL,
  source: "FIXTURE publisher",
  series_id: "FIXTURE_FUEL",
};

const SELF: Readonly<FigureV1> = {
  kind: "self-reported",
  metric_id: "rent",
  value: "850.00",
  unit: "USD per month",
  region: "U.S. city average",
  period: "2024-10",
  source: "self-reported",
  series_id: "self",
} as unknown as Readonly<FigureV1>;

describe("provenance labels (R13.1 to R13.4)", () => {
  it("reads historical record for a persona then figure", () => {
    expect(figureLabel(OFFICIAL, "then", "persona")).toBe(
      "historical record, retrieved 30 Oct 2024",
    );
  });

  it("reads sealed with the letter for a live or real then figure", () => {
    expect(figureLabel(OFFICIAL, "then", "live")).toBe(
      "sealed with the letter, retrieved 30 Oct 2024",
    );
    expect(figureLabel(OFFICIAL, "then", "real")).not.toContain("historical record");
  });

  it("reads retrieved for a now figure whatever the letter kind", () => {
    for (const kind of ["persona", "live", "real"] as const) {
      expect(figureLabel(OFFICIAL, "now", kind)).toBe("retrieved 30 Oct 2024");
    }
  });

  it("reads fixture data for a fixture figure and never historical record", () => {
    expect(figureLabel(FIXTURE, "then", "persona")).toBe(REVEAL_COPY.labelFixtureData);
    expect(figureLabel(FIXTURE, "now", "persona")).toBe(REVEAL_COPY.labelFixtureData);
  });

  it("reads self-reported for a self-reported figure, never retrieved", () => {
    const label = figureLabel(SELF, "now", "persona");
    expect(label).toBe(REVEAL_COPY.labelSelfReported);
    expect(label).not.toContain("retrieved");
    expect(label).not.toContain("historical record");
  });

  it("uses the UTC date, so a late-evening retrieval never shifts a day", () => {
    const late = { ...OFFICIAL, retrieved_at: "2024-10-30T23:30:00Z" };
    expect(figureLabel(late, "now", "persona")).toBe("retrieved 30 Oct 2024");
  });
});

describe("receiptFigureOf builds the Then and Now row (C3.1, R11.1 to R11.3)", () => {
  it("carries the value, unit, period, region and label of the figure", () => {
    const row = receiptFigureOf(OFFICIAL, "then", "persona");
    // A USD per gallon figure is shown at display precision (P5.1).
    expect(row.value).toBe("3.41");
    expect(row.unit).toBe("USD per gallon");
    expect(row.period).toBe(formatPeriod("2024-10", "U.S. city average"));
    expect(row.region).toBe("U.S. city average");
    expect(row.label).toBe("historical record, retrieved 30 Oct 2024");
    expect(row.note).toBeUndefined();
  });

  it("shows the rescaled value and unit with the rescale note (R11.10)", () => {
    const rescale: DisplayRescale = { divisor: 1000, unit: "EUR per litre" };
    const eu: Readonly<FigureV1> = { ...OFFICIAL, value: "3412", unit: "EUR per 1,000 litres" };
    const row = receiptFigureOf(eu, "now", "persona", rescale);
    expect(row.value).toBe("3.41");
    expect(row.unit).toBe("EUR per litre");
    expect(row.note).toBe(
      REVEAL_COPY.rescaledNote
        .replace("{toUnit}", "EUR per litre")
        .replace("{fromUnit}", "EUR per 1,000 litres"),
    );
  });

  it("never changes the stored value when a rescale applies", () => {
    const rescale: DisplayRescale = { divisor: 1000, unit: "EUR per litre" };
    const eu: Readonly<FigureV1> = { ...OFFICIAL, value: "3412", unit: "EUR per 1,000 litres" };
    receiptFigureOf(eu, "now", "persona", rescale);
    expect(eu.value).toBe("3412");
  });
});

describe("receiptSourceOf builds the source control (R11.2)", () => {
  it("carries the source, the series ID and the source_url of an official figure", () => {
    expect(receiptSourceOf(OFFICIAL)).toEqual({
      source: "U.S. EIA",
      seriesId: "EMM_EPMR_PTE_NUS_DPG",
      sourceUrl: "https://www.eia.gov/series",
      asPublished: "As published: 3.412 USD per gallon",
    });
  });

  it("has no source link for a self-reported figure (no source_url in the schema)", () => {
    expect(receiptSourceOf(SELF).sourceUrl).toBeUndefined();
  });
});

describe("receiptFigureOf routes values through displayFigureValue (K1)", () => {
  it("shows a 1954.037871213403 EUR per 1,000 litres figure as 1.95 EUR per litre", () => {
    const eu: Readonly<FigureV1> = {
      ...OFFICIAL,
      value: "1954.037871213403",
      unit: "EUR per 1,000 litres",
      region: "EU27, weighted average",
    };
    const row = receiptFigureOf(eu, "now", "persona");
    expect(row.value).toBe("1.95");
    expect(row.unit).toBe("EUR per litre");
    expect(row.note).toBe(
      REVEAL_COPY.rescaledNote
        .replace("{toUnit}", "EUR per litre")
        .replace("{fromUnit}", "EUR per 1,000 litres"),
    );
  });

  it("uses the short retrieved date in the label, e.g. 'retrieved 30 Oct 2026'", () => {
    const recent = { ...OFFICIAL, retrieved_at: "2026-10-30T14:02:11Z" };
    expect(receiptFigureOf(recent, "now", "persona").label).toBe("retrieved 30 Oct 2026");
    expect(figureLabel(recent, "then", "live")).toBe(
      "sealed with the letter, retrieved 30 Oct 2026",
    );
  });
});
