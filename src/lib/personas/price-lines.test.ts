import { describe, expect, it } from "vitest";

import { DEMO_FIGURES } from "@/lib/figures/demo";
import type { LoadedFigures } from "@/lib/figures/types";
import { thenAndNow } from "@/lib/figures/then-now";

import { PERSONAS } from "./index";
import { recordCandidate } from "./record-candidate";
import { PRICE_RE, expectedPrices } from "./price-lines";

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
