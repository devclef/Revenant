import { describe, expect, it } from "vitest";
import { displayFigureValue } from "./display-figure";

describe("displayFigureValue", () => {
  it("applies the display rescale and shows the rescaled unit", () => {
    // The EU Oil Bulletin publishes EUR per 1,000 litres. The reveal shows
    // EUR per litre, rounded to the fuel precision of two decimals.
    expect(
      displayFigureValue(
        "1954.037871213403",
        "EUR per 1,000 litres",
        "EU27, weighted average",
      ),
    ).toEqual({
      text: "1.95",
      unit: "EUR per litre",
    });
  });

  it("leaves a unit with no rescale unchanged", () => {
    expect(displayFigureValue("3.412", "USD per gallon", "U.S.")).toEqual({
      text: "3.41",
      unit: "USD per gallon",
    });
  });

  it("keeps the published precision for units with no display precision", () => {
    // Index units have no display precision, so the figure keeps the decimals
    // it was published with. Intl alone would round this to three decimals.
    expect(displayFigureValue("104.2", "index, 2015 = 100", "U.S.")).toEqual({
      text: "104.2",
      unit: "index, 2015 = 100",
    });
    expect(
      displayFigureValue("104.123456", "index, 2015 = 100", "U.S.").text,
    ).toBe("104.123456");
  });

  it("uses two decimals for every unit on the fuel precision list", () => {
    expect(
      displayFigureValue("1.5", "EUR per litre", "EU27, weighted average").text,
    ).toBe("1.50");
  });
});
