// Feature: 12-submission-polish, Property 5: The Single_Figure_View shows the figure once and prints no change
//
// For any Same_Figure, with or without an answer, with or without a Kept_Sample
// label, the rendered single card shows the nothing-to-compare line once and the
// figure's value once at Display_Precision, and it contains none of "0.000",
// "0.0%", "unchanged", "rose", "fell", the formula element, a Number_Line or a
// Then and Now label pair. Validates Z2.1, Z2.2, Z2.3, Z2.4, Z2.5, Z2.10.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { ReceiptCard, type ReceiptCardProps } from "./ReceiptCard";
import { REVEAL_COPY } from "./copy";
import { displayPrecisionForUnit } from "./display-precision";
import { formatPeriod, formatValue } from "@/lib/figures";

const REGION = "U.S. city average";
const UNIT = "USD per gallon";

/** Thousandths as a decimal string, e.g. 3412 -> "3.412". */
function fmt(thousandths: number): string {
  return `${Math.floor(thousandths / 1000)}.${String(thousandths % 1000).padStart(3, "0")}`;
}

/**
 * Values whose fraction is not all zeros. A value such as "10.000" would
 * contain the forbidden "0.000" on its own, which is not what Property 5 tests.
 */
const valueArb = fc
  .integer({ min: 1000, max: 500000 })
  .map(fmt)
  .filter((v) => !v.includes("0.000"));
const answerArb = fc.option(valueArb, { nil: undefined });

function singleProps(
  value: string,
  markValue: string | undefined,
  sample: boolean,
): ReceiptCardProps {
  return {
    name: "Regular gasoline",
    region: REGION,
    markValue,
    sample,
    unit: UNIT,
    then: {
      value: formatValue(value, REGION, displayPrecisionForUnit(UNIT)),
      unit: UNIT,
      period: formatPeriod("2024-09", REGION),
      region: REGION,
      label: "historical record, retrieved 30 October 2024",
    },
    now: { message: null },
    source: {
      source: "U.S. EIA",
      seriesId: "EMM_EPMR_PTE_NUS_DPG",
      sourceUrl: "https://www.eia.gov/series",
      asPublished: `As published: ${value} ${UNIT}`,
    },
    single: true,
  };
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

const FORBIDDEN = ["0.000", "0.0%", "unchanged", "rose", "fell"] as const;

describe("ReceiptCard single, Property 5: the Single_Figure_View shows the figure once and prints no change", () => {
  it("shows the nothing-to-compare line once and the figure once, with no change words or label pair", () => {
    fc.assert(
      fc.property(
        valueArb,
        answerArb,
        fc.boolean(),
        (value, markValue, sample) => {
          const html = renderToStaticMarkup(
            createElement(ReceiptCard, singleProps(value, markValue, sample)),
          );

          expect(countOccurrences(html, REVEAL_COPY.nothingToCompare)).toBe(1);

          const displayed = formatValue(
            value,
            REGION,
            displayPrecisionForUnit(UNIT),
          );
          expect(countOccurrences(html, `>${displayed}<`)).toBe(1);

          for (const word of FORBIDDEN) {
            expect(html).not.toContain(word);
          }

          expect(html).not.toContain("data-number-line");
          expect(html).not.toContain('data-receipt-row="then"');
          expect(html).not.toContain('data-receipt-row="now"');
          expect(html).not.toContain(`${REVEAL_COPY.then}:`);
          expect(html).not.toContain(`${REVEAL_COPY.now}:`);
          expect(html).not.toContain("Formula");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("keeps the As_Published_Value in the source details", () => {
    const html = renderToStaticMarkup(
      createElement(ReceiptCard, singleProps("3.412", "3.90", false)),
    );
    expect(html).toContain("As published: 3.412 USD per gallon");
  });

  it("keeps the Your answer block once, with the judge's answer", () => {
    const html = renderToStaticMarkup(
      createElement(ReceiptCard, singleProps("3.412", "3.90", false)),
    );
    expect(countOccurrences(html, REVEAL_COPY.yourAnswer)).toBe(1);
    expect(html).toContain("3.90 USD per gallon");
  });

  it("shows 'No answer' when the judge did not answer", () => {
    const html = renderToStaticMarkup(
      createElement(ReceiptCard, singleProps("3.412", undefined, false)),
    );
    expect(html).toContain(REVEAL_COPY.noAnswer);
  });

  it("draws the heading and the figure's period and region", () => {
    const html = renderToStaticMarkup(
      createElement(ReceiptCard, singleProps("3.412", undefined, false)),
    );
    expect(html).toContain("Regular gasoline · U.S. city average");
    expect(html).toContain(formatPeriod("2024-09", REGION));
  });
});
