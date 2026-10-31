// The catalogue of real figure series for the figures model (spec 02-demo-figures).
//
// These are metric definitions only, with no figures: the daily fetch job (a
// later spec) supplies the values, and sealed letters carry their own. All four
// were confirmed on 2026-10-31 against their publishers (see design.md). Sweden
// fuel is deferred to the real-data spec, so there are no Sweden entries here.
//
// display_name carries no change or judgement words: up and down get the same
// treatment (neutrality.md). Every metric satisfies MetricDefinitionV1, which is
// a strict object (id, display_name, unit, region, source, series_id), so no
// source_url sits on the metric itself; a figure referencing the series carries
// source_url with full provenance (data-integrity.md). The reference pages are
// recorded in the comments beside each entry.
//
// Pure module: no runtime dependencies, safe in the browser and on the server.

import type { CatalogueSeries } from "./types";

export const CATALOGUE: readonly CatalogueSeries[] = [
  {
    // Reference page (source_url for figures in this series):
    // https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMM_EPMR_PTE_NUS_DPG&f=W
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
  },
  {
    // Reference page (source_url for figures in this series):
    // https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMD_EPD2D_PTE_NUS_DPG&f=W
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
  },
  {
    // Reference page (source_url for figures in this series):
    // https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en
    metric: {
      id: "eu-petrol-euro95",
      display_name: "Euro-super 95 petrol, retail price including taxes",
      unit: "EUR per 1,000 litres",
      region: "EU27, weighted average",
      source: "European Commission, Weekly Oil Bulletin",
      series_id:
        'File Weekly_Oil_Bulletin_Prices_History_maticni_4web.xlsx, sheet "Prices with taxes", column C "EU_price_with_tax_euro95", country EU27 weighted average (rows marked EU_)',
    },
    period_type: "weekly",
    display_rescale: { divisor: 1000, unit: "EUR per litre" },
  },
  {
    // Reference page (source_url for figures in this series):
    // https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en
    metric: {
      id: "eu-diesel",
      display_name: "Automotive diesel, retail price including taxes",
      unit: "EUR per 1,000 litres",
      region: "EU27, weighted average",
      source: "European Commission, Weekly Oil Bulletin",
      series_id:
        'File Weekly_Oil_Bulletin_Prices_History_maticni_4web.xlsx, sheet "Prices with taxes", column D "EU_price_with_tax_diesel", country EU27 weighted average (rows marked EU_)',
    },
    period_type: "weekly",
    display_rescale: { divisor: 1000, unit: "EUR per litre" },
  },
];
