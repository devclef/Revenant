// Published precision per series (spec 03-persona-demo, design.md).
//
// A row exists only for a series whose publisher page prints a fixed number of
// decimals on every value. A series without a row keeps the precision of its
// stored value as fetched; nothing here rounds or pads a figure.
//
// Checked 2026-11-21 (UTC) against the EIA series history pages. Every value
// cell on each page has exactly three decimals:
//   EMM_EPMR_PTE_NUS_DPG  https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMM_EPMR_PTE_NUS_DPG&f=W
//     1,886 value cells, each with 3 decimals (latest 2026-Nov week 11/16: 3.805).
//   EMD_EPD2D_PTE_NUS_DPG https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMD_EPD2D_PTE_NUS_DPG&f=W
//     1,705 value cells, each with 3 decimals (latest 2026-Nov week 11/16: 5.937).
// No European Commission Weekly Oil Bulletin row: its published precision is
// not confirmed here.

export interface PublishedPrecision {
  // Fractional digits the publisher prints for every value of the series.
  decimals: number;
  // Date (UTC, YYYY-MM-DD) on which the publisher page was checked.
  checkedOn: string;
  // Publisher page that shows the precision.
  sourceUrl: string;
}

export const PUBLISHED_PRECISION: Readonly<Record<string, PublishedPrecision>> =
  {
    EMM_EPMR_PTE_NUS_DPG: {
      decimals: 3,
      checkedOn: "2026-11-21",
      sourceUrl:
        "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMM_EPMR_PTE_NUS_DPG&f=W",
    },
    EMD_EPD2D_PTE_NUS_DPG: {
      decimals: 3,
      checkedOn: "2026-11-21",
      sourceUrl:
        "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMD_EPD2D_PTE_NUS_DPG&f=W",
    },
  };
