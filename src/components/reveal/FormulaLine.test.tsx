import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { displayChangeResult, rescaledChangeInputs } from "./change-display";
import { REVEAL_COPY } from "./copy";
import { FormulaLine } from "./FormulaLine";
import { CHANGE_FORMULA_ID, computeChange, type ChangeResult } from "@/lib/figures";
import type { FigureV1 } from "@/lib/seal-format";

/**
 * Markup tests for the formula line (R4.2, R5.4). FormulaLine draws the formula
 * and the check links outside the Source details, so these tests render it
 * alone. The formula is built from the result passed in, which is the same
 * display result ChangeLine prints.
 */

const SOURCE_URL = "https://www.eia.gov/series";

const THEN: Readonly<FigureV1> = {
  kind: "official",
  metric_id: "fuel",
  value: "3.000",
  unit: "USD per gallon",
  region: "U.S. city average",
  period: "2024-09",
  source: "U.S. EIA",
  series_id: "EMM_EPMR_PTE_NUS_DPG",
  retrieved_at: "2024-10-30T14:02:11Z",
  source_url: SOURCE_URL,
};

const NOW: Readonly<FigureV1> = {
  ...THEN,
  value: "3.600",
  period: "2026-09",
  retrieved_at: "2026-10-30T14:02:11Z",
};

function comparable(
  then: Readonly<FigureV1>,
  now: Readonly<FigureV1>,
): Extract<ChangeResult, { comparable: true }> {
  const result = computeChange(then, now);
  if (!result.comparable) throw new Error("test setup: must be comparable");
  return result;
}

function render(
  result: Extract<ChangeResult, { comparable: true }>,
  sourceUrls: ReadonlyArray<string | undefined> = [SOURCE_URL, SOURCE_URL],
  seriesId: string = THEN.series_id,
): string {
  return renderToStaticMarkup(
    createElement(FormulaLine, { result, seriesId, sourceUrls }),
  );
}

describe("FormulaLine formula text", () => {
  it("renders a readable formula with its inputs, not the formula id", () => {
    const html = render(comparable(THEN, NOW));
    expect(html).toContain(`${REVEAL_COPY.formulaLabel}: `);
    // THEN 3.000, NOW 3.600: (now - then) / then x 100.
    expect(html).toContain("(3.600 - 3.000) / 3.000 x 100");
    // The identifier is kept in a data attribute only, never in visible text.
    expect(html).toContain(`data-formula="${CHANGE_FORMULA_ID}"`);
    const visibleText = html.replace(/<[^>]*>/g, "");
    expect(visibleText).not.toContain(CHANGE_FORMULA_ID);
  });

  it("shows the plain difference when the then value is zero (no percent)", () => {
    const zeroThen: Readonly<FigureV1> = { ...THEN, value: "0.000" };
    const html = render(comparable(zeroThen, NOW));
    expect(html).toContain("3.600 - 0.000");
    expect(html).not.toContain(" / 0.000");
  });

  it("builds the formula from the rescaled inputs, not the sealed values", () => {
    const EU_THEN: Readonly<FigureV1> = {
      ...THEN,
      value: "1800.00",
      unit: "EUR per 1,000 litres",
      region: "European Union",
      period: "2024-05",
    };
    const EU_NOW: Readonly<FigureV1> = { ...EU_THEN, value: "1900.00", period: "2026-05" };
    const inputs = rescaledChangeInputs(
      EU_THEN.value,
      EU_NOW.value,
      { divisor: 1000, unit: "EUR per litre" },
      EU_THEN.unit,
    );
    const shown = displayChangeResult(comparable(EU_THEN, EU_NOW), inputs);
    const html = render(shown, [SOURCE_URL]);
    expect(html).toContain("(1.9 - 1.8) / 1.8 x 100");
    const visibleText = html.replace(/<[^>]*>/g, "");
    expect(visibleText).not.toContain("1800.00");
    expect(visibleText).not.toContain("1900.00");
  });

  it("marks the formula block with data-change so the stage 3 Steps can fade it", () => {
    const html = render(comparable(THEN, NOW));
    expect(html).toMatch(/<div class="[^"]*change[^"]*" data-change="">/);
  });
});

describe("FormulaLine check links (R4.2)", () => {
  const checkLabel = REVEAL_COPY.checkAtSource;

  it("draws one check link per distinct source_url", () => {
    const html = render(comparable(THEN, NOW));
    expect(html.split(checkLabel).length - 1).toBe(1);
    expect(html).toContain('href="https://www.eia.gov/series"');
  });

  it("draws a link for each of two different source_urls", () => {
    const html = render(comparable(THEN, NOW), [
      "https://www.eia.gov/series",
      "https://example.org/series",
    ]);
    expect(html.split(checkLabel).length - 1).toBe(2);
    expect(html).toContain('href="https://example.org/series"');
  });

  it("shows the series ID in place of a link when no source_url was sealed", () => {
    const html = render(comparable(THEN, NOW), [undefined, undefined]);
    expect(html).not.toContain(checkLabel);
    expect(html).toContain(`${REVEAL_COPY.seriesLabel}: EMM_EPMR_PTE_NUS_DPG`);
  });

  it("opens the link in a new tab without leaking the referrer", () => {
    const html = render(comparable(THEN, NOW));
    expect(html).toContain('rel="noreferrer noopener"');
    expect(html).toContain('target="_blank"');
  });
});
