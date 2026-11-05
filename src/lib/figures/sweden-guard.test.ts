// Guard tests for the figure modules: U.S. and EU only, no Sweden and no SEK
// (spec 03-persona-demo, R23.1), and one period format for letters and figures
// (Property 17, R15.2, R15.3).
//
// The first check fails if any catalogue entry or any row of the real figure
// file names Sweden as a region or carries a SEK unit. The second check runs
// formatPeriod over weekly and monthly inputs for every region and confirms the
// output does not depend on the region.

import { describe, expect, it } from "vitest";

import fuelFigures from "./real/fuel-figures.json";
import { CATALOGUE } from "./catalogue";
import { formatPeriod } from "./format-change";

// Any region text that names Sweden, in any case.
const SWEDEN_RE = /sweden/i;

// The currency code that must never appear in a figure unit.
const SEK = "SEK";

interface FuelFigureRow {
  metric_id: string;
  unit: string;
  region: string;
  period: string;
}

const fuelRows = (fuelFigures as { figures: FuelFigureRow[] }).figures;

describe("Sweden and SEK guard (R23.1)", () => {
  it("the catalogue has at least one series to check", () => {
    expect(CATALOGUE.length).toBeGreaterThan(0);
  });

  it("no catalogue region names Sweden and no catalogue unit contains SEK", () => {
    for (const series of CATALOGUE) {
      const { metric } = series;
      expect(metric.region, `catalogue ${metric.id} region`).not.toMatch(
        SWEDEN_RE,
      );
      expect(metric.unit, `catalogue ${metric.id} unit`).not.toContain(SEK);
      if (series.display_rescale) {
        expect(
          series.display_rescale.unit,
          `catalogue ${metric.id} display unit`,
        ).not.toContain(SEK);
      }
    }
  });

  it("the real figure file has rows to check", () => {
    expect(fuelRows.length).toBeGreaterThan(0);
  });

  it("no real figure row names Sweden and no real figure unit contains SEK", () => {
    for (const row of fuelRows) {
      expect(row.region, `${row.metric_id} ${row.period} region`).not.toMatch(
        SWEDEN_RE,
      );
      expect(row.unit, `${row.metric_id} ${row.period} unit`).not.toContain(
        SEK,
      );
    }
  });
});

describe("period format is one way for every region (Property 17)", () => {
  // Weekly (YYYY-MM-DD) and monthly (YYYY-MM) inputs, with a known output.
  const CASES: ReadonlyArray<{ period: string; expected: string }> = [
    { period: "2026-10-26", expected: "26 Oct 2026" },
    { period: "2026-10", expected: "Oct 2026" },
  ];

  const regions = [
    ...new Set([
      ...CATALOGUE.map((s) => s.metric.region),
      ...fuelRows.map((r) => r.region),
    ]),
  ];

  it("checks at least one region", () => {
    expect(regions.length).toBeGreaterThan(0);
  });

  for (const { period, expected } of CASES) {
    it(`formats ${period} the same way for every region`, () => {
      for (const region of regions) {
        expect(formatPeriod(period, region), region).toBe(expected);
      }
    });
  }

  it("formats every real figure period the same way for every region", () => {
    for (const row of fuelRows) {
      const outputs = regions.map((region) => formatPeriod(row.period, region));
      expect(new Set(outputs).size, row.period).toBe(1);
    }
  });
});
