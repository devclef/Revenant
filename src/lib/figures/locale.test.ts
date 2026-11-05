// Tests for locale selection by region (spec 03-persona-demo).

import { describe, expect, it } from "vitest";

import { formatValue } from "./format-change";
import { localeForRegion } from "./locale";

describe("localeForRegion", () => {
  // One row per locale. Each row names the region, the locale it maps to, and
  // an example value rendered through the number formatter.
  const rows: ReadonlyArray<{
    region: string;
    locale: string;
    example: string;
  }> = [
    { region: "U.S.", locale: "en-US", example: "3.412" },
    { region: "EU27, weighted average", locale: "en-IE", example: "3.412" },
    { region: "EU", locale: "en-GB", example: "3.412" },
  ];

  it.each(rows)("maps $region to $locale", ({ region, locale }) => {
    expect(localeForRegion(region)).toBe(locale);
  });

  it.each(rows)(
    "renders 3.412 with a dot decimal separator for $locale",
    ({ region, example }) => {
      expect(formatValue(example, region, 3)).toBe("3.412");
    },
  );

  it("falls back to en-GB for every other region", () => {
    expect(localeForRegion("")).toBe("en-GB");
    expect(localeForRegion("U.S. city average")).toBe("en-GB");
    expect(localeForRegion("Sweden")).toBe("en-GB");
  });
});
