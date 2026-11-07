// Feature: 09-demo-polish, task 16 (issue #263): ReceiptCard, Property 9.
//
// For any Comparable pair and answer, the card's rows come in the C3.1 order,
// the Then and Now values share one type style, and a rise and its
// mirror-image fall render the same markup except for the text the change line
// prints (the direction word, the signed difference and the percent, and the
// digits of the figures), which is the R20.2 allowance. Validates C3.1, C3.2.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { ChangeLine } from "./ChangeLine";
import { ReceiptCard, type ReceiptCardProps, type ReceiptFigure } from "./ReceiptCard";
import { REVEAL_COPY } from "./copy";
import { computeChange, formatPeriod, formatValue } from "@/lib/figures";
import type { FigureV1 } from "@/lib/seal-format";

type Official = Extract<FigureV1, { kind: "official" }>;

const REGION = "U.S. city average";
const THEN_PERIOD = "2024-09";
const NOW_PERIOD = "2026-09";

const BASE: Official = {
  kind: "official",
  metric_id: "fuel",
  value: "0.000",
  unit: "USD per gallon",
  region: REGION,
  period: THEN_PERIOD,
  source: "U.S. EIA",
  series_id: "EMM_EPMR_PTE_NUS_DPG",
  retrieved_at: "2024-10-30T14:02:11Z",
  source_url: "https://www.eia.gov/series",
};

/** Thousandths as a decimal string with three fraction digits. */
function fmt(thousandths: number): string {
  return `${Math.floor(thousandths / 1000)}.${String(thousandths % 1000).padStart(3, "0")}`;
}

function figure(value: string, period: string): Official {
  return { ...BASE, value, period };
}

function receiptFigure(fig: Official, label: string): ReceiptFigure {
  return {
    value: formatValue(fig.value, fig.region),
    unit: fig.unit,
    period: formatPeriod(fig.period, fig.region),
    region: fig.region,
    label,
  };
}

function cardProps(then: Official, now: Official, markValue: string): ReceiptCardProps {
  const change = computeChange(then, now);
  if (!change.comparable) {
    throw new Error(`test setup: figures must be comparable (${change.reason})`);
  }
  return {
    name: "Regular gasoline",
    region: REGION,
    markValue,
    unit: then.unit,
    then: receiptFigure(then, "historical record, retrieved 30 October 2024"),
    now: receiptFigure(now, "retrieved 2 November 2026"),
    numberLine: createElement("div", { "data-number-line": "" }),
    change: createElement(ChangeLine, { result: change, region: REGION, then, now }),
    source: { source: then.source, seriesId: then.series_id, sourceUrl: then.source_url },
  };
}

function render(props: ReceiptCardProps): string {
  return renderToStaticMarkup(createElement(ReceiptCard, props));
}

/**
 * The direction-independent skeleton: tags, attributes and static copy. Any
 * text node that holds a digit, or is the direction word, is replaced with a
 * fixed token, because those are the parts R20.2 allows to differ.
 */
function skeleton(html: string): string {
  return html.replace(/>([^<]+)</g, (match, text: string) =>
    /[0-9]|\b(rose|fell)\b/.test(text) ? ">#<" : match,
  );
}

/** The attributes of the Then and Now value spans, without their text. */
function valueSpanAttributes(html: string, role: "then" | "now"): string {
  const match = new RegExp(`<span([^>]*)data-role="${role}"`).exec(html);
  if (match === null) {
    throw new Error(`no ${role} value span rendered`);
  }
  return match[1] ?? "";
}

const valueArb = fc.integer({ min: 1000, max: 500000 });
// A rise and its mirror fall share the then value; the fall is the rise
// reflected about it. The fall stays positive because the delta is below base.
const mirrorArb = fc
  .record({
    base: valueArb,
    delta: fc.integer({ min: 1, max: 999 }),
    answer: fc.integer({ min: 0, max: 999999999 }),
  })
  .map(({ base, delta, answer }) => ({
    then: figure(fmt(base), THEN_PERIOD),
    rise: figure(fmt(base + delta), NOW_PERIOD),
    fall: figure(fmt(base - delta), NOW_PERIOD),
    answer: fmt(answer),
  }));

describe("ReceiptCard, Property 9: order, weight and the mirror", () => {
  it("renders the C3.1 rows in order for any comparable pair and answer", () => {
    fc.assert(
      fc.property(mirrorArb, ({ then, rise, answer }) => {
        const html = render(cardProps(then, rise, answer));
        const order = [
          "<h3",
          "data-your-answer",
          'data-receipt-row="then"',
          'data-receipt-row="now"',
          "data-number-line",
          "data-change",
          "<summary",
        ].map((marker) => html.indexOf(marker));

        for (const index of order) {
          expect(index).toBeGreaterThanOrEqual(0);
        }
        expect([...order].sort((a, b) => a - b)).toEqual(order);
      }),
      { numRuns: 100 },
    );
  });

  it("gives Then and Now the same class list and the same inline size", () => {
    fc.assert(
      fc.property(mirrorArb, ({ then, rise, answer }) => {
        const html = render(cardProps(then, rise, answer));
        expect(valueSpanAttributes(html, "then")).toBe(valueSpanAttributes(html, "now"));
        expect(valueSpanAttributes(html, "now")).not.toMatch(/accent/i);
      }),
      { numRuns: 100 },
    );
  });

  it("renders a rise and its mirror-image fall with the same markup apart from R20.2 text", () => {
    fc.assert(
      fc.property(mirrorArb, ({ then, rise, fall, answer }) => {
        const riseHtml = render(cardProps(then, rise, answer));
        const fallHtml = render(cardProps(then, fall, answer));
        expect(skeleton(fallHtml)).toBe(skeleton(riseHtml));
      }),
      { numRuns: 100 },
    );
  });

  it("keeps the static copy of the rows in the skeleton", () => {
    const html = render(
      cardProps(figure("3.611", THEN_PERIOD), figure("3.105", NOW_PERIOD), "3.90"),
    );
    expect(skeleton(html)).toContain(`${REVEAL_COPY.then}:`);
    expect(skeleton(html)).toContain(`${REVEAL_COPY.now}:`);
    expect(skeleton(html)).toContain(REVEAL_COPY.sourceSummary);
  });
});
