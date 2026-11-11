import { describe, expect, it } from "vitest";
import { rescaleForDisplay } from "@/lib/figures";
import { DISPLAY_PRECISION_FUEL, displayPrecisionForUnit } from "./display-precision";

describe("display precision (P5.1)", () => {
  it("uses two decimals for fuel", () => {
    expect(DISPLAY_PRECISION_FUEL).toBe(2);
  });

  it("gives USD per gallon two decimals", () => {
    expect(displayPrecisionForUnit("USD per gallon")).toBe(2);
  });

  it("gives EUR per litre two decimals, the unit shown after rescale", () => {
    // The EU Oil Bulletin publishes EUR per 1,000 litres; the reveal shows
    // EUR per litre. The precision keys on the shown unit.
    const rescale = { divisor: 1000, unit: "EUR per litre" };
    const shownUnit = rescale.unit;
    expect(rescaleForDisplay("1789.5", rescale.divisor)).toBe("1.7895");
    expect(displayPrecisionForUnit(shownUnit)).toBe(2);
  });

  it("returns undefined for other units so they keep published precision", () => {
    expect(displayPrecisionForUnit("EUR per 1,000 litres")).toBeUndefined();
    expect(displayPrecisionForUnit("index, 2015 = 100")).toBeUndefined();
    expect(displayPrecisionForUnit("")).toBeUndefined();
  });
});
