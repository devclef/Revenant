// Tests for locale selection by region (spec 03-persona-demo).

import { describe, expect, it } from "vitest";

import { localeForRegion } from "./locale";

describe("localeForRegion", () => {
  it("returns 'en-US' for the 'U.S.' region", () => {
    expect(localeForRegion("U.S.")).toBe("en-US");
  });

  it("returns 'en' for every other region", () => {
    expect(localeForRegion("EU")).toBe("en");
    expect(localeForRegion("")).toBe("en");
    expect(localeForRegion("Sweden")).toBe("en");
    expect(localeForRegion("U.S. city average")).toBe("en");
  });
});
