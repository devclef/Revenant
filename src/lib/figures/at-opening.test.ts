// Pins the two "now" records each fuel persona gets from personaNowResponse.
//
// The expected figures are copied from src/lib/figures/real/fuel-figures.json
// (official EIA and European Commission Weekly Oil Bulletin records). They are
// real published values, not fixtures. Do not edit a value here unless the
// JSON file changes too.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { PERSONAS } from "../personas";
import { CATALOGUE } from "./catalogue";
import { figureAtOpening, personaNowResponse } from "./at-opening";
import { loadFigureFile } from "./load";
import fuelFigures from "./real/fuel-figures.json";
import { thenAndNow } from "./then-now";
import type { LoadedFigures } from "./types";

const LOADED = loadFigureFile(fuelFigures, CATALOGUE);
const GENERATED_AT = "2026-11-19T20:00:00Z";

// Maya and Tomás come from the Persona_List, so their opening dates and metrics
// are the ones the demo shows. The expectations below are read from that list
// and from the Figure_File, not from dates copied into this test.
function personaByKey(key: string) {
  const persona = PERSONAS.find((p) => p.key === key);
  if (persona === undefined) {
    throw new Error(`persona missing from Persona_List: ${key}`);
  }
  return persona;
}

const MAYA = personaByKey("us-maya");
const TOMAS = personaByKey("eu-tomas");

describe("at-opening reads the Persona_List", () => {
  it.each([
    ["Maya", MAYA],
    ["Tomás", TOMAS],
  ])(
    "%s: figureAtOpening and thenAndNow return the same figure for each metric",
    (_name, persona) => {
      const date = persona.opens_at.slice(0, 10);
      for (const m of persona.metrics) {
        const expected = thenAndNow(m.metric_id, date, LOADED).then;
        expect(expected.found).toBe(true);
        expect(figureAtOpening(m.metric_id, persona.opens_at, LOADED)).toEqual(
          expected,
        );
      }
    },
  );
});

describe("personaNowResponse: Maya (opens 5 November 2024)", () => {
  const body = personaNowResponse(MAYA, LOADED, GENERATED_AT);

  it("returns the revenant-figures-v1 body with one series per metric", () => {
    expect(body.format).toBe("revenant-figures-v1");
    expect(body.generated_at).toBe(GENERATED_AT);
    expect(body.series).toHaveLength(2);
  });

  it("holds the 4 November 2024 gasoline record", () => {
    expect(body.series[0]).toEqual({
      metric: {
        id: "us-gasoline-regular",
        display_name: "Regular gasoline (all formulations), retail price",
        unit: "USD per gallon",
        region: "U.S.",
        source:
          "U.S. Energy Information Administration (EIA), Weekly Retail Gasoline and Diesel Prices",
        series_id: "EMM_EPMR_PTE_NUS_DPG",
      },
      period_type: "weekly",
      last_success_at: null,
      fallback: false,
      figure: {
        kind: "official",
        metric_id: "us-gasoline-regular",
        value: "3.069",
        unit: "USD per gallon",
        region: "U.S.",
        period: "2024-11-04",
        source:
          "U.S. Energy Information Administration (EIA), Weekly Retail Gasoline and Diesel Prices",
        series_id: "EMM_EPMR_PTE_NUS_DPG",
        retrieved_at: "2026-11-01T16:39:37Z",
        source_url:
          "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMM_EPMR_PTE_NUS_DPG&f=W",
      },
    });
  });

  it("holds the 4 November 2024 diesel record", () => {
    expect(body.series[1]).toEqual({
      metric: {
        id: "us-diesel",
        display_name: "No. 2 diesel, retail price",
        unit: "USD per gallon",
        region: "U.S.",
        source:
          "U.S. Energy Information Administration (EIA), Weekly Retail Gasoline and Diesel Prices",
        series_id: "EMD_EPD2D_PTE_NUS_DPG",
      },
      period_type: "weekly",
      last_success_at: null,
      fallback: false,
      figure: {
        kind: "official",
        metric_id: "us-diesel",
        value: "3.536",
        unit: "USD per gallon",
        region: "U.S.",
        period: "2024-11-04",
        source:
          "U.S. Energy Information Administration (EIA), Weekly Retail Gasoline and Diesel Prices",
        series_id: "EMD_EPD2D_PTE_NUS_DPG",
        retrieved_at: "2026-11-01T16:39:37Z",
        source_url:
          "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMD_EPD2D_PTE_NUS_DPG&f=W",
      },
    });
  });
});

describe("personaNowResponse: Tomás (opens 9 June 2024)", () => {
  const body = personaNowResponse(TOMAS, LOADED, GENERATED_AT);

  it("returns one series per metric", () => {
    expect(body.series).toHaveLength(2);
  });

  it("holds the 3 June 2024 petrol record", () => {
    expect(body.series[0]?.figure).toEqual({
      kind: "official",
      metric_id: "eu-petrol-euro95",
      value: "1741.8449858013737",
      unit: "EUR per 1,000 litres",
      region: "EU27, weighted average",
      period: "2024-06-03",
      source: "European Commission, Weekly Oil Bulletin",
      series_id:
        'File Weekly_Oil_Bulletin_Prices_History_maticni_4web.xlsx, sheet "Prices with taxes", column C "EU_price_with_tax_euro95", country EU27 weighted average (rows marked EU_)',
      retrieved_at: "2026-11-01T16:39:38Z",
      source_url:
        "https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en",
    });
  });

  it("holds the 3 June 2024 diesel record", () => {
    expect(body.series[1]?.figure).toEqual({
      kind: "official",
      metric_id: "eu-diesel",
      value: "1601.4368204069326",
      unit: "EUR per 1,000 litres",
      region: "EU27, weighted average",
      period: "2024-06-03",
      source: "European Commission, Weekly Oil Bulletin",
      series_id:
        'File Weekly_Oil_Bulletin_Prices_History_maticni_4web.xlsx, sheet "Prices with taxes", column D "EU_price_with_tax_diesel", country EU27 weighted average (rows marked EU_)',
      retrieved_at: "2026-11-01T16:39:38Z",
      source_url:
        "https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en",
    });
  });
});

describe("figureAtOpening: a gap stays a gap", () => {
  // The earliest US gasoline record is 5 June 2023. Any opening date before it
  // has no figure at or before it.
  it("returns none_at_or_before_date with no figure when no record is at or before the opening date", () => {
    const result = figureAtOpening(
      "us-gasoline-regular",
      "2023-06-04T00:00:00.000Z",
      LOADED,
    );
    expect(result).toEqual({
      found: false,
      reason: "none_at_or_before_date",
    });
    expect(result).not.toHaveProperty("figure");
  });

  it("gives personaNowResponse a null figure with no value for that series", () => {
    const body = personaNowResponse(
      {
        opens_at: "2023-06-04T00:00:00.000Z",
        metrics: [{ metric_id: "us-gasoline-regular" }],
      },
      LOADED,
      GENERATED_AT,
    );
    expect(body.series[0]?.figure).toBeNull();
  });
});

describe("figureAtOpening: records after the opening date are ignored", () => {
  // The file holds US gasoline records for 1 January 2024 and 8 January 2024.
  // An opening date of 7 January 2024 must return the 1 January record.
  it("returns the 1 January 2024 record for an opening date of 7 January 2024", () => {
    const later = LOADED.series
      .get("us-gasoline-regular")
      ?.figures.find((f) => f.period === "2024-01-08");
    expect(later?.value).toBe("3.073");

    const result = figureAtOpening(
      "us-gasoline-regular",
      "2024-01-07T00:00:00.000Z",
      LOADED,
    );
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.figure.period).toBe("2024-01-01");
      expect(result.figure.value).toBe("3.089");
    }
  });

  it("returns the 8 January 2024 record once the opening date is 8 January 2024", () => {
    const result = figureAtOpening(
      "us-gasoline-regular",
      "2024-01-08T00:00:00.000Z",
      LOADED,
    );
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.figure.period).toBe("2024-01-08");
    }
  });
});

describe("figureAtOpening: latest record at or before the opening date (property)", () => {
  // Record sets are random ordered subsets of the real US gasoline records, so
  // a missing week, a single record and an empty set are all generated. The
  // expected answer is found by brute force: the largest period not after the
  // opening date. Weekly period ends are the period dates themselves, so the
  // comparison is on "YYYY-MM-DD" strings.
  const gasoline = LOADED.series.get("us-gasoline-regular");
  if (gasoline === undefined) {
    throw new Error("fixture missing us-gasoline-regular");
  }
  const allRecords = [...gasoline.figures];

  const recordSetArb = fc.subarray(allRecords, {
    maxLength: allRecords.length,
  });
  const openingDateArb = fc
    .date({
      min: new Date("2022-12-01T00:00:00Z"),
      max: new Date("2027-01-01T00:00:00Z"),
      noInvalidDate: true,
    })
    .map((d) => d.toISOString());

  it("returns the record with the latest period at or before opensAt for any generated record set and opening date", () => {
    fc.assert(
      fc.property(recordSetArb, openingDateArb, (records, opensAt) => {
        const data: LoadedFigures = {
          fixture: false,
          series: new Map([
            [
              "us-gasoline-regular",
              {
                metric: gasoline.metric,
                period_type: gasoline.period_type,
                figures: records,
              },
            ],
          ]),
        };

        const date = opensAt.slice(0, 10);
        const eligible = records.map((f) => f.period).filter((p) => p <= date);
        const expectedPeriod =
          eligible.length === 0
            ? undefined
            : eligible.reduce((a, b) => (a > b ? a : b));

        const result = figureAtOpening("us-gasoline-regular", opensAt, data);
        if (expectedPeriod === undefined) {
          // An empty record set is no_figures; a non-empty set with nothing at
          // or before the date is none_at_or_before_date (then-and-now rules).
          expect(result).toEqual({
            found: false,
            reason:
              records.length === 0 ? "no_figures" : "none_at_or_before_date",
          });
        } else {
          expect(result.found).toBe(true);
          if (result.found) {
            expect(result.figure.period).toBe(expectedPeriod);
          }
        }
      }),
      { numRuns: 200 },
    );
  });
});
