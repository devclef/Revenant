import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { REVEAL_COPY } from "./copy";
import { FormulaLine } from "./FormulaLine";
import { ReceiptCard, type ReceiptCardProps } from "./ReceiptCard";
import { computeChange, formatChange } from "@/lib/figures";
import type { FigureV1 } from "@/lib/seal-format";
import { ChangeLine } from "./ChangeLine";
import { receiptFigureOf, receiptSourceOf } from "./FigureLine";

/**
 * Placement of the formula slot in ReceiptCard (R4.2). The formula and its
 * check links sit after the Source details, outside them, so they stay visible
 * while the details are closed. Without a formula, the check link stays inside
 * the Source details, so every figure keeps its link.
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

function props(withFormula: boolean): ReceiptCardProps {
  const change = computeChange(THEN, NOW);
  if (!change.comparable) throw new Error("test setup: must be comparable");
  return {
    name: "Regular gasoline",
    region: THEN.region,
    unit: THEN.unit,
    then: receiptFigureOf(THEN, "then", "persona"),
    now: receiptFigureOf(NOW, "now", "persona"),
    change: createElement(ChangeLine, {
      changeText: formatChange(change, THEN.region),
      then: THEN,
      now: NOW,
    }),
    formula: withFormula
      ? createElement(FormulaLine, {
          result: change,
          seriesId: THEN.series_id,
          sourceUrls: [SOURCE_URL],
        })
      : undefined,
    source: receiptSourceOf(THEN),
  };
}

describe("ReceiptCard formula slot (R4.2)", () => {
  it("draws the formula after the Source details, outside them", () => {
    const html = renderToStaticMarkup(createElement(ReceiptCard, props(true)));
    const detailsEnd = html.indexOf("</details>");
    const formulaAt = html.indexOf(`${REVEAL_COPY.formulaLabel}:`);
    expect(detailsEnd).toBeGreaterThan(-1);
    expect(formulaAt).toBeGreaterThan(detailsEnd);
    // The formula is not inside the details element.
    expect(html.slice(0, detailsEnd)).not.toContain(REVEAL_COPY.formulaLabel);
  });

  it("keeps the check link outside the Source details when a formula is drawn", () => {
    const html = renderToStaticMarkup(createElement(ReceiptCard, props(true)));
    const detailsEnd = html.indexOf("</details>");
    expect(html.split(REVEAL_COPY.checkAtSource).length - 1).toBe(1);
    expect(html.indexOf(REVEAL_COPY.checkAtSource)).toBeGreaterThan(detailsEnd);
  });

  it("keeps the check link inside the Source details when no formula is drawn", () => {
    const html = renderToStaticMarkup(createElement(ReceiptCard, props(false)));
    const detailsEnd = html.indexOf("</details>");
    expect(html.split(REVEAL_COPY.checkAtSource).length - 1).toBe(1);
    expect(html.indexOf(REVEAL_COPY.checkAtSource)).toBeLessThan(detailsEnd);
    expect(html).not.toContain(REVEAL_COPY.formulaLabel);
  });
});
