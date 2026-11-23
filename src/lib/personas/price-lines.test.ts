import { describe, expect, it } from "vitest";

import { DEMO_FIGURES } from "@/lib/figures/demo";
import type { LoadedFigures } from "@/lib/figures/types";
import { thenAndNow } from "@/lib/figures/then-now";

import { PERSONAS } from "./index";
import { recordCandidate } from "./record-candidate";
import { PRICE_RE, expectedPrices, weekOfMonthWords } from "./price-lines";

const TWO_DECIMALS = /^[0-9]+\.[0-9]{2}$/;

function numbersIn(text: string): string[] {
  return [...text.matchAll(PRICE_RE)].map((m) => m[1]);
}

describe("PRICE_RE", () => {
  it("matches a dollar price with two decimals and captures the number", () => {
    expect(numbersIn("The radio put it at about $3.89 a gallon.")).toEqual([
      "3.89",
    ]);
  });

  it("matches a euro price with two decimals", () => {
    expect(numbersIn("Petrol was about €1.79 a litre.")).toEqual(["1.79"]);
  });

  it("ignores prices without exactly two decimals", () => {
    expect(numbersIn("about $3.8 and about $3.894 and about $3")).toEqual([]);
  });

  it("ignores a bare number that is not a price phrase", () => {
    expect(numbersIn("I paid 3.64 at the pump.")).toEqual([]);
  });

  it("finds every price in a letter, in order", () => {
    expect(numbersIn("about $3.64, then later about €1.65.")).toEqual([
      "3.64",
      "1.65",
    ]);
  });
});

describe("expectedPrices", () => {
  it("returns one two-decimal number per tracked metric for each persona", () => {
    for (const persona of PERSONAS) {
      const prices = expectedPrices(persona);
      expect(prices).toHaveLength(persona.metrics.length);
      for (const price of prices) {
        expect(price).toMatch(TWO_DECIMALS);
      }
    }
  });

  it("matches recordCandidate of the then-figure for each metric", () => {
    for (const persona of PERSONAS) {
      const expected = persona.metrics.map((metric) => {
        const { then } = thenAndNow(
          metric.metric_id,
          persona.written_as_of,
          DEMO_FIGURES,
        );
        if (!then.found) throw new Error("test expects a then-figure");
        return recordCandidate(then.figure);
      });
      expect(expectedPrices(persona)).toEqual(expected);
    }
  });

  it("throws when a sealed then-figure is missing, rather than estimating", () => {
    const empty: LoadedFigures = { fixture: false, series: new Map() };
    const [persona] = PERSONAS;
    expect(() => expectedPrices(persona, empty)).toThrow(RangeError);
  });
});

describe("weekOfMonthWords", () => {
  it.each([
    ["2024-11-01", "first week of November"],
    ["2024-11-07", "first week of November"],
    ["2024-11-08", "second week of November"],
    ["2024-11-11", "second week of November"],
    ["2024-11-14", "second week of November"],
    ["2024-11-15", "third week of November"],
    ["2024-11-21", "third week of November"],
    ["2024-11-22", "fourth week of November"],
    ["2024-11-28", "fourth week of November"],
    ["2024-11-29", "fifth week of November"],
    ["2024-11-30", "fifth week of November"],
  ])("names the week of %s as %s", (period, words) => {
    expect(weekOfMonthWords(period)).toBe(words);
  });

  it("checks each day range boundary in every month length", () => {
    // 31-day month: day 31 is the fifth week.
    expect(weekOfMonthWords("2024-05-31")).toBe("fifth week of May");
    // Leap-year February: day 29 exists and is the fifth week.
    expect(weekOfMonthWords("2024-02-29")).toBe("fifth week of February");
    // Non-leap February ends on day 28, the fourth week.
    expect(weekOfMonthWords("2026-02-28")).toBe("fourth week of February");
    // The first week of a month that starts on a Monday.
    expect(weekOfMonthWords("2026-11-16")).toBe("third week of November");
  });

  it("names the month of the period's own start date", () => {
    expect(weekOfMonthWords("2024-05-06")).toBe("first week of May");
    expect(weekOfMonthWords("2024-12-02")).toBe("first week of December");
  });

  it("rejects a period that is not a real calendar date", () => {
    expect(() => weekOfMonthWords("2024-02-30")).toThrow(RangeError);
    expect(() => weekOfMonthWords("2024-13-01")).toThrow(RangeError);
    expect(() => weekOfMonthWords("2024-11")).toThrow(RangeError);
    expect(() => weekOfMonthWords("")).toThrow(RangeError);
  });
});
