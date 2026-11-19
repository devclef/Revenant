// Pins the two "now" records each fuel persona gets from personaNowResponse.
//
// The expected figures are copied from src/lib/figures/real/fuel-figures.json
// (official EIA and European Commission Weekly Oil Bulletin records). They are
// real published values, not fixtures. Do not edit a value here unless the
// JSON file changes too.

import { describe, expect, it } from "vitest";

import { CATALOGUE } from "./catalogue";
import { personaNowResponse } from "./at-opening";
import { loadFigureFile } from "./load";
import fuelFigures from "./real/fuel-figures.json";

const LOADED = loadFigureFile(fuelFigures, CATALOGUE);
const GENERATED_AT = "2026-11-19T20:00:00Z";

const MAYA = {
  opens_at: "2024-11-05T00:00:00.000Z",
  metrics: [{ metric_id: "us-gasoline-regular" }, { metric_id: "us-diesel" }],
};

const TOMAS = {
  opens_at: "2024-06-09T00:00:00.000Z",
  metrics: [{ metric_id: "eu-petrol-euro95" }, { metric_id: "eu-diesel" }],
};

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
