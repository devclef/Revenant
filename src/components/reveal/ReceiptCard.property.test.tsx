// Feature: 09-demo-polish, task 16 (issue #263): ReceiptCard, Property 4.
//
// "Your answer" appears exactly once in every card, for any figure pair, any
// answer (or none) and every ReceiptCard branch: Comparable, Comparable with a
// fallback note, and the message branch that replaces the now row (A3). The
// Number_Line is stubbed here, because its own label is changed by task 17 and
// is not what this property checks. Rendered with renderToStaticMarkup, no DOM
// library, matching the reveal test style. Validates A7.1, C3.3.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { ChangeLine } from "./ChangeLine";
import { ReceiptCard, type ReceiptCardProps, type ReceiptFigure } from "./ReceiptCard";
import { REVEAL_COPY } from "./copy";
import {
  computeChange,
  formatPeriod,
  formatValue,
} from "@/lib/figures";
import type { FigureV1 } from "@/lib/seal-format";

type Official = Extract<FigureV1, { kind: "official" }>;

const REGION = "U.S. city average";

const BASE: Official = {
  kind: "official",
  metric_id: "fuel",
  value: "0.000",
  unit: "USD per gallon",
  region: REGION,
  period: "2024-09",
  source: "U.S. EIA",
  series_id: "EMM_EPMR_PTE_NUS_DPG",
  retrieved_at: "2024-10-30T14:02:11Z",
  source_url: "https://www.eia.gov/series",
};

const THEN_PERIOD = "2024-09";
const NOW_PERIOD = "2026-09";
const THEN_LABEL = "historical record, retrieved 30 October 2024";
const NOW_LABEL = "retrieved 2 November 2026";
const MESSAGE = "The now figure is not yet published for this series.";

/** Thousandths as a decimal string with three fraction digits, e.g. 3412 -> "3.412". */
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

type Branch = "comparable" | "fallback" | "message";

/** Builds the ReceiptCard props for one branch, with the change line when there is one. */
function propsFor(
  branch: Branch,
  then: Official,
  now: Official,
  markValue: string | undefined,
): ReceiptCardProps {
  const shared = {
    name: "Regular gasoline",
    region: REGION,
    markValue,
    unit: then.unit,
    then: receiptFigure(then, THEN_LABEL),
    source: {
      source: then.source,
      seriesId: then.series_id,
      sourceUrl: then.source_url,
    },
  };

  if (branch === "message") {
    return { ...shared, now: { message: MESSAGE } };
  }

  const change = computeChange(then, now);
  if (!change.comparable) {
    throw new Error(`test setup: figures must be comparable (${change.reason})`);
  }

  return {
    ...shared,
    now: receiptFigure(now, NOW_LABEL),
    nowNote: branch === "fallback" ? "Bundled fallback figure for this series." : undefined,
    numberLine: createElement("div", { "data-number-line": "" }),
    change: createElement(ChangeLine, { result: change, region: REGION, then, now }),
  };
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

const valueArb = fc.integer({ min: 1000, max: 500000 }).map(fmt);
const pairArb = fc.record({ then: valueArb, now: valueArb }).map(({ then, now }) => ({
  then: figure(then, THEN_PERIOD),
  now: figure(now, NOW_PERIOD),
}));
const answerArb = fc.option(fc.integer({ min: 0, max: 999999999 }).map(fmt), {
  nil: undefined,
});
const branchArb = fc.constantFrom<Branch>("comparable", "fallback", "message");

describe("ReceiptCard, Property 4: 'Your answer' appears once in every card", () => {
  it("renders the visible text 'Your answer' exactly once for any pair, answer and branch", () => {
    fc.assert(
      fc.property(pairArb, answerArb, branchArb, ({ then, now }, markValue, branch) => {
        const html = renderToStaticMarkup(
          createElement(ReceiptCard, propsFor(branch, then, now, markValue)),
        );
        expect(countOccurrences(html, REVEAL_COPY.yourAnswer)).toBe(1);
      }),
      { numRuns: 100 },
    );
  });

  it("shows the answer once in the row when the judge answered", () => {
    const html = renderToStaticMarkup(
      createElement(
        ReceiptCard,
        propsFor("comparable", figure("3.611", THEN_PERIOD), figure("3.105", NOW_PERIOD), "3.90"),
      ),
    );
    expect(countOccurrences(html, REVEAL_COPY.yourAnswer)).toBe(1);
    expect(html).toContain("3.90 USD per gallon");
  });

  it("shows 'No answer' in the row when the judge did not answer", () => {
    const html = renderToStaticMarkup(
      createElement(
        ReceiptCard,
        propsFor("message", figure("3.611", THEN_PERIOD), figure("3.105", NOW_PERIOD), undefined),
      ),
    );
    expect(countOccurrences(html, REVEAL_COPY.yourAnswer)).toBe(1);
    expect(html).toContain(REVEAL_COPY.noAnswer);
  });
});
