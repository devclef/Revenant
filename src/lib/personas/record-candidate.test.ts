// Property 23: no question's sample list holds the Record_Candidate (spec 10
// design.md; requirements C5.2, C5.11). The Record_Candidate is still computed
// for the P1 letter price lines. The P1 half of the property (the
// Letter_Price_Line) is checked with expectedPrices, which P1 adds later.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { DEMO_FIGURES } from "@/lib/figures/demo";
import { thenAndNow } from "@/lib/figures/then-now";
import { displayRescaleForUnit } from "@/lib/figures/rescale";

import { PERSONAS } from "./index";
import { SAMPLE_CANDIDATES } from "./samples";
import { classifyCandidate } from "./spread";
import { recordCandidate, shownThenValue } from "./record-candidate";

const TWO_DECIMALS = /^[0-9]+\.[0-9]{2}$/;

describe("recordCandidate (Property 23)", () => {
  it("writes the shown Then_Value with two decimals for the design's four values", () => {
    const figure = (value: string, unit: string, region: string) => ({
      value,
      unit,
      region,
    });
    expect(recordCandidate(figure("3.643", "USD per gallon", "U.S."))).toBe(
      "3.64",
    );
    expect(recordCandidate(figure("3.894", "USD per gallon", "U.S."))).toBe(
      "3.89",
    );
    expect(
      recordCandidate(
        figure(
          "1791.3149889844324",
          "EUR per 1,000 litres",
          "EU27, weighted average",
        ),
      ),
    ).toBe("1.79");
    expect(
      recordCandidate(
        figure(
          "1645.194212158339",
          "EUR per 1,000 litres",
          "EU27, weighted average",
        ),
      ),
    ).toBe("1.65");
  });

  it("applies the Display_Rescale only to a unit that has one", () => {
    expect(
      shownThenValue({
        value: "1791.3149889844324",
        unit: "EUR per 1,000 litres",
        region: "EU27, weighted average",
      }),
    ).toBe("1.7913149889844324");
    expect(
      shownThenValue({
        value: "3.643",
        unit: "USD per gallon",
        region: "U.S.",
      }),
    ).toBe("3.643");
    expect(displayRescaleForUnit("USD per gallon")).toBeNull();
  });

  it("is always two decimals and classifies as near against the shown Then_Value", () => {
    // Values of at least 0.1 in the field's unit, in the two units the Testify field shows.
    const decimalArb = fc
      .tuple(
        fc.bigInt({ min: BigInt(1), max: BigInt(10) ** BigInt(9) }),
        fc.integer({ min: 0, max: 6 }),
      )
      .map(([int, scale]) => {
        const digits = int.toString().padStart(scale + 1, "0");
        return scale === 0
          ? digits
          : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
      })
      // Below 999 the two-decimal Record_Candidate never rounds up to 1,000
      // and so never gets a grouping separator (design.md C5.2).
      .filter((text) => Number(text) >= 0.1 && Number(text) < 999);

    const units = [
      { unit: "USD per gallon", region: "U.S." },
      { unit: "EUR per 1,000 litres", region: "EU27, weighted average" },
    ];

    fc.assert(
      fc.property(decimalArb, fc.constantFrom(...units), (shown, u) => {
        // For a rescaled unit the sealed value is the shown value times 1000,
        // written by moving the decimal point three places right.
        const sealed =
          displayRescaleForUnit(u.unit) === null ? shown : shiftRight(shown, 3);
        const rc = recordCandidate({
          value: sealed,
          unit: u.unit,
          region: u.region,
        });
        expect(rc).toMatch(TWO_DECIMALS);
        expect(classifyCandidate(rc, shown)).toBe("near");
      }),
      { numRuns: 500 },
    );
  });

  for (const persona of PERSONAS) {
    for (const metric of persona.metrics) {
      it(`${persona.key} ${metric.metric_id}: no stored candidate is the Record_Candidate`, () => {
        const result = thenAndNow(
          metric.metric_id,
          persona.written_as_of,
          DEMO_FIGURES,
        );
        if (!result.then.found) throw new Error("no then figure");
        const record = recordCandidate(result.then.figure);
        const list = SAMPLE_CANDIDATES[persona.key][metric.metric_id];
        expect(list.filter((c) => c === record)).toHaveLength(0);
        expect(record).toMatch(TWO_DECIMALS);
      });
    }
  }
});

/** Move the decimal point `places` to the right, exactly, with no float. */
function shiftRight(text: string, places: number): string {
  const dot = text.indexOf(".");
  const whole = dot === -1 ? text : text.slice(0, dot);
  const frac = dot === -1 ? "" : text.slice(dot + 1);
  const padded = frac.padEnd(places, "0");
  const newWhole = whole + padded.slice(0, places);
  const newFrac = padded.slice(places);
  const stripped = newWhole.replace(/^0+(?=\d)/, "");
  return newFrac === "" ? stripped : `${stripped}.${newFrac}`;
}
