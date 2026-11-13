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
import { displayPrecisionForUnit } from "./display-precision";
import { receiptFigureOf, receiptSourceOf } from "./FigureLine";
import { SHORT_NAME_TABLE, shortNameFor } from "./short-names";
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
    value: formatValue(fig.value, fig.region, displayPrecisionForUnit(fig.unit)),
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

/** Thousandths rounded half away from zero to cents, as "d.dd" (integer maths). */
function centsOf(thousandths: number): string {
  const cents = Math.floor((thousandths + 5) / 10);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/** The thousandths of a "d.ddd" value string produced by fmt. */
function thousandthsOf(value: string): number {
  return Number(value.replace(".", ""));
}

/** The ReceiptCard props built the way FiguresThenNow builds them (P5.1 to P5.4). */
function receiptPropsFor(then: Official, now: Official, markValue?: string): ReceiptCardProps {
  const change = computeChange(then, now);
  if (!change.comparable) {
    throw new Error(`test setup: figures must be comparable (${change.reason})`);
  }
  return {
    name: shortNameFor(then.metric_id, "Regular gasoline"),
    region: REGION,
    markValue,
    unit: then.unit,
    then: receiptFigureOf(then, "then", "persona"),
    now: receiptFigureOf(now, "now", "persona"),
    change: createElement(ChangeLine, { result: change, region: REGION, then, now }),
    source: receiptSourceOf(then, "Regular gasoline"),
  };
}

// The renderer puts a comment between adjacent text nodes; strip them so a
// sentence such as "Formula: (…)" is compared as the reader reads it.
const plainHtml = (html: string): string => html.replace(/<!-- -->/g, "");

describe("ReceiptCard, Property 17: receipt values use display precision and the source keeps the published value", () => {
  it("shows fuel values at two decimals, the source shows the published value, and the formula shows the published values", () => {
    fc.assert(
      fc.property(pairArb, answerArb, ({ then, now }, markValue) => {
        const html = plainHtml(
          renderToStaticMarkup(createElement(ReceiptCard, receiptPropsFor(then, now, markValue))),
        );
        const thenValue = thousandthsOf(then.value);
        const nowValue = thousandthsOf(now.value);
        expect(html).toContain(`data-role="then">${centsOf(thenValue)}<`);
        expect(html).toContain(`data-role="now">${centsOf(nowValue)}<`);
        expect(html).toContain(`As published: ${then.value} USD per gallon`);
        expect(html).toContain(`Formula: (${now.value} - ${then.value}) / ${then.value} x 100`);
        expect(html).toContain(REVEAL_COPY.roundedNote);
      }),
      { numRuns: 100 },
    );
  });

  it("keeps the published precision for a unit without a display precision, and draws no rounding line", () => {
    fc.assert(
      fc.property(valueArb, valueArb, (thenValue, nowValue) => {
        const unit = "index points";
        const then: Official = { ...figure(thenValue, THEN_PERIOD), unit };
        const now: Official = { ...figure(nowValue, NOW_PERIOD), unit };
        const html = plainHtml(
          renderToStaticMarkup(createElement(ReceiptCard, receiptPropsFor(then, now))),
        );
        expect(html).toContain(`data-role="then">${thenValue}<`);
        expect(html).not.toContain("data-rounded-note");
        expect(html).not.toContain(REVEAL_COPY.roundedNote);
      }),
      { numRuns: 100 },
    );
  });
});

describe("ReceiptCard, Property 18: the Short_Name falls back to the sealed name", () => {
  const knownIds = [...SHORT_NAME_TABLE.keys()];
  const idArb = fc.oneof(
    fc.constantFrom(...knownIds),
    fc.stringMatching(/^[a-z][a-z0-9-]{0,30}$/),
  );
  const nameArb = fc.stringMatching(/^[A-Za-z][A-Za-z ]{0,30}[A-Za-z]$/);

  it("heads the card with the lookup entry or the sealed display_name, and shows the series name under Source", () => {
    fc.assert(
      fc.property(idArb, nameArb, (metricId, displayName) => {
        const heading = shortNameFor(metricId, displayName);
        expect(heading).toBe(SHORT_NAME_TABLE.get(metricId) ?? displayName);

        const html = renderToStaticMarkup(
          createElement(ReceiptCard, {
            name: heading,
            region: REGION,
            unit: "USD per gallon",
            then: receiptFigure(figure("3.611", THEN_PERIOD), THEN_LABEL),
            now: { message: null },
            source: { seriesName: displayName, source: "U.S. EIA", seriesId: "SERIES" },
          }),
        );
        expect(html).toContain(`>${heading} · ${REGION}</h3>`);
        expect(html).toContain(`<p>${displayName}</p>`);
      }),
      { numRuns: 100 },
    );
  });

  it("renders a metric_id that is not in the lookup with the sealed display_name (P5.7)", () => {
    const html = renderToStaticMarkup(
      createElement(ReceiptCard, {
        name: shortNameFor("fixture-unlisted-series", "Sealed series name"),
        region: REGION,
        unit: "USD per gallon",
        then: receiptFigure(figure("3.611", THEN_PERIOD), THEN_LABEL),
        now: { message: null },
        source: { seriesName: "Sealed series name", source: "U.S. EIA", seriesId: "SERIES" },
      }),
    );
    expect(html).toContain(`>Sealed series name · ${REGION}</h3>`);
    expect(html).toContain("<p>Sealed series name</p>");
  });
});
