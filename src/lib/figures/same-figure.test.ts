// Unit tests for isSameFigure (spec 03-persona-demo, issue #383).

import { describe, expect, it } from "vitest";

import type { FigureV1 } from "@/lib/seal-format";

import { isSameFigure } from "./same-figure";

// A valid official figure with every provenance field present. Overrides let a
// test vary one field at a time while every other field stays comparable.
function official(overrides: Partial<FigureV1> = {}): FigureV1 {
  return {
    kind: "official",
    metric_id: "us-gasoline",
    value: "3.40",
    unit: "USD per gallon",
    region: "U.S. city average",
    period: "2024-09",
    source: "U.S. EIA",
    series_id: "EMM_EPMR_PTE_NUS_DPG",
    retrieved_at: "2026-10-30T14:02:11Z",
    source_url: "https://www.eia.gov/series",
    ...overrides,
  } as FigureV1;
}

// A valid self-reported figure. Its source is fixed to "self-reported" and it
// has no source_url.
function selfReported(overrides: Partial<FigureV1> = {}): FigureV1 {
  return {
    kind: "self-reported",
    metric_id: "my-rent",
    value: "900",
    unit: "USD per month",
    region: "U.S. city average",
    period: "2024-09",
    source: "self-reported",
    series_id: "self",
    retrieved_at: "2026-10-30T14:02:11Z",
    ...overrides,
  } as FigureV1;
}

describe("isSameFigure", () => {
  it("returns true for identical official figures", () => {
    expect(isSameFigure(official(), official())).toBe(true);
  });

  it("treats 3.40 and 3.4 as the same figure", () => {
    expect(
      isSameFigure(official({ value: "3.40" }), official({ value: "3.4" })),
    ).toBe(true);
    expect(
      isSameFigure(official({ value: "3.4" }), official({ value: "3.40" })),
    ).toBe(true);
  });

  it("returns false for a last-digit difference", () => {
    expect(
      isSameFigure(official({ value: "3.41" }), official({ value: "3.40" })),
    ).toBe(false);
    expect(
      isSameFigure(official({ value: "3.40" }), official({ value: "3.41" })),
    ).toBe(false);
  });

  it("returns false for a revised figure with the same period and a different value", () => {
    const then = official({ value: "3.40", period: "2024-09" });
    const revised = official({ value: "3.45", period: "2024-09" });
    expect(isSameFigure(then, revised)).toBe(false);
  });

  it("returns false for a different period with the same value", () => {
    const then = official({ value: "3.40", period: "2024-09" });
    const now = official({ value: "3.40", period: "2024-10" });
    expect(isSameFigure(then, now)).toBe(false);
  });

  it.each([
    ["source", { source: "Other publisher" }],
    ["series_id", { series_id: "OTHER_SERIES" }],
    ["unit", { unit: "USD per litre" }],
    ["region", { region: "Other region" }],
  ])("returns false when only the %s differs", (_name, change) => {
    const then = official();
    const now = official(change as Partial<FigureV1>);
    expect(isSameFigure(then, now)).toBe(false);
    expect(isSameFigure(now, then)).toBe(false);
  });

  it("returns false when either figure is self-reported", () => {
    expect(isSameFigure(selfReported(), selfReported())).toBe(false);
    expect(isSameFigure(official(), selfReported())).toBe(false);
    expect(isSameFigure(selfReported(), official())).toBe(false);
  });

  it("returns false when a value does not parse as a decimal", () => {
    expect(
      isSameFigure(official({ value: "abc" }), official({ value: "3.40" })),
    ).toBe(false);
    expect(
      isSameFigure(official({ value: "3.40" }), official({ value: "abc" })),
    ).toBe(false);
    expect(isSameFigure(official({ value: "" }), official({ value: "" }))).toBe(
      false,
    );
  });
});
