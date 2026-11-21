// Tests for the published-precision table (spec 03-persona-demo, design.md).

import { describe, expect, it } from "vitest";

import { PUBLISHED_PRECISION } from "./published-precision";

describe("PUBLISHED_PRECISION", () => {
  it("has rows only for the two EIA series checked on 2026-11-21", () => {
    expect(Object.keys(PUBLISHED_PRECISION).sort()).toEqual([
      "EMD_EPD2D_PTE_NUS_DPG",
      "EMM_EPMR_PTE_NUS_DPG",
    ]);
  });

  it("has no Oil Bulletin row", () => {
    for (const key of Object.keys(PUBLISHED_PRECISION)) {
      expect(key.toLowerCase()).not.toContain("oil");
      expect(key.toLowerCase()).not.toContain("bulletin");
    }
  });

  it("records three published decimals for each EIA series", () => {
    expect(PUBLISHED_PRECISION.EMM_EPMR_PTE_NUS_DPG?.decimals).toBe(3);
    expect(PUBLISHED_PRECISION.EMD_EPD2D_PTE_NUS_DPG?.decimals).toBe(3);
  });

  it("gives each row the check date and the EIA page it came from", () => {
    for (const [seriesId, row] of Object.entries(PUBLISHED_PRECISION)) {
      expect(row.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(row.sourceUrl).toBe(
        `https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=${seriesId}&f=W`,
      );
    }
  });
});
