// Feature: 09-demo-polish, task 16 (issue #263): FigureEntry, as Receipt_Card.
//
// Two properties over random figure pairs, rendered with renderToStaticMarkup:
//
// - Property 2 (distance independence, R14.3, R12.2): the Then and Now rows are
//   the same markup whatever the answer is. The answer changes only the
//   "Your answer" row and the Mark, never a figure.
// - Property 15 (order and periods, C3.1, R14.11): the card's parts come in the
//   C3.1 order, and each figure row carries its own period.
//
// These replace the spec 07 properties 2 and 15 for the old Figure_Entry
// markup. Validates C3.1, C3.3, R14.11, R12.2.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { FigureEntry, type FigureEntryProps } from "./FigureEntry";
import { REVEAL_COPY } from "./copy";
import { computeChange, formatPeriod } from "@/lib/figures";
import type { FigureV1 } from "@/lib/seal-format";

const REGION = "U.S. city average";

function official(thousandths: number, period: string): Readonly<FigureV1> {
  const value = `${Math.floor(thousandths / 1000)}.${String(thousandths % 1000).padStart(3, "0")}`;
  return {
    kind: "official",
    metric_id: "fuel",
    value,
    unit: "USD per gallon",
    region: REGION,
    period,
    source: "U.S. EIA",
    series_id: "EMM_EPMR_PTE_NUS_DPG",
    retrieved_at: "2026-10-30T14:02:11Z",
    source_url: "https://www.eia.gov/series",
  };
}

const THEN_PERIOD = "2024-09";
const NOW_PERIOD = "2026-09";

// A comparable pair: the now value differs from the then value, so the change
// line exists. Values are thousandths, so 1000 to 9000 gives 1.000 to 9.000.
const pairArb = fc
  .tuple(fc.integer({ min: 1000, max: 9000 }), fc.integer({ min: 1000, max: 9000 }))
  .filter(([a, b]) => a !== b);

const answerArb = fc.option(
  fc.integer({ min: 0, max: 9999 }).map((n) => `${Math.floor(n / 100)}.${String(n % 100).padStart(2, "0")}`),
  { nil: undefined },
);

function render(props: FigureEntryProps): string {
  return renderToStaticMarkup(createElement(FigureEntry, props));
}

function entryProps(
  [thenThousandths, nowThousandths]: readonly [number, number],
  markValue: string | undefined,
): FigureEntryProps {
  const then = official(thenThousandths, THEN_PERIOD);
  const now = official(nowThousandths, NOW_PERIOD);
  const change = computeChange(then, now);
  if (!change.comparable) throw new Error("test setup: pair must be comparable");
  return { name: "Regular gasoline", then, now, change, markValue };
}

/** The markup of one figure row: from its data attribute to the row's close. */
function rowOf(html: string, role: "then" | "now"): string {
  const start = html.indexOf(`data-receipt-row="${role}"`);
  if (start < 0) throw new Error(`no ${role} row`);
  return html.slice(start, html.indexOf("</p>", start));
}

describe("Property 2: the figure rows do not depend on the answer (R14.3, R12.2)", () => {
  it("the Then and Now rows are identical with and without an answer, for any pair", () => {
    fc.assert(
      fc.property(pairArb, answerArb, (pair, answer) => {
        const without = render(entryProps(pair, undefined));
        const withAnswer = render(entryProps(pair, answer));
        expect(rowOf(withAnswer, "then")).toBe(rowOf(without, "then"));
        expect(rowOf(withAnswer, "now")).toBe(rowOf(without, "now"));
      }),
      { numRuns: 60 },
    );
  });
});

describe("Property 15: the card keeps its order, and each figure shows its period (C3.1, R14.11)", () => {
  it("the parts come in C3.1 order and each figure row carries its own period", () => {
    fc.assert(
      fc.property(pairArb, answerArb, (pair, answer) => {
        const html = render(entryProps(pair, answer));
        const at = (needle: string): number => html.indexOf(needle);
        const positions = [
          at("Regular gasoline · U.S. city average"),
          at(`>${REVEAL_COPY.yourAnswer}</span>`),
          at(`data-receipt-row="then"`),
          at(`data-receipt-row="now"`),
          at(`data-line-label="answer"`),
          at(`${REVEAL_COPY.formulaLabel}:`),
          at(`<summary>${REVEAL_COPY.sourceSummary}</summary>`),
        ];
        for (const position of positions) expect(position).toBeGreaterThan(-1);
        expect([...positions].sort((a, b) => a - b)).toEqual(positions);

        expect(rowOf(html, "then")).toContain(formatPeriod(THEN_PERIOD, REGION));
        expect(rowOf(html, "now")).toContain(formatPeriod(NOW_PERIOD, REGION));
      }),
      { numRuns: 60 },
    );
  });
});
