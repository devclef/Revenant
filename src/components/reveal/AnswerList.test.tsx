// Feature: 09-demo-polish, task 16 (issue #263): AnswerList example tests.
//
// Each answer shows the metric's name, then the Answer_Text and unit, or "No
// answer". No figure value, period or source appears next to an answer (spec 03
// R3.8). Rendered with renderToStaticMarkup, matching the reveal test style.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AnswerList, type AnswerListItem } from "./AnswerList";
import { REVEAL_COPY } from "./copy";

function render(items: readonly AnswerListItem[]): string {
  return renderToStaticMarkup(createElement(AnswerList, { items }));
}

describe("AnswerList", () => {
  it("renders one list item per answer, in the order given", () => {
    const html = render([
      { name: "Regular gasoline", markValue: "3.90", unit: "USD per gallon" },
      { name: "Eggs", markValue: "4", unit: "USD per dozen" },
      { name: "Rent", markValue: "1200", unit: "USD per month" },
    ]);
    expect(html.match(/<li /g)?.length).toBe(3);
    const gas = html.indexOf("Regular gasoline");
    const eggs = html.indexOf("Eggs");
    const rent = html.indexOf("Rent");
    expect(gas).toBeGreaterThanOrEqual(0);
    expect(eggs).toBeGreaterThan(gas);
    expect(rent).toBeGreaterThan(eggs);
  });

  it("shows the answer with its unit, as the Answer_Text", () => {
    const html = render([{ name: "Regular gasoline", markValue: "3.90", unit: "USD per gallon" }]);
    expect(html).toContain("3.90 USD per gallon");
  });

  it("groups the integer part of a large answer and keeps every digit", () => {
    const html = render([{ name: "Rent", markValue: "1585.70", unit: "USD per month" }]);
    expect(html).toContain("1,585.70 USD per month");
  });

  it("shows 'No answer' and no unit for an unanswered question", () => {
    const html = render([{ name: "Eggs", unit: "USD per dozen" }]);
    expect(html).toContain(REVEAL_COPY.noAnswer);
    expect(html).not.toContain("USD per dozen");
  });

  it("shows no figure value, period, source or series next to an answer", () => {
    const html = render([
      { name: "Regular gasoline", markValue: "3.90", unit: "USD per gallon" },
      { name: "Eggs", unit: "USD per dozen" },
    ]);
    expect(html).not.toContain(REVEAL_COPY.then);
    expect(html).not.toContain(REVEAL_COPY.now);
    expect(html).not.toContain(REVEAL_COPY.sourceSummary);
    expect(html).not.toContain(REVEAL_COPY.seriesLabel);
    expect(html).not.toContain(REVEAL_COPY.labelHistoricalRecord.split("{date}")[0] ?? "");
    expect(html).not.toContain("·");
  });

  it("renders an empty list when there are no answers", () => {
    const html = render([]);
    expect(html).toContain("<ul");
    expect(html).not.toContain("<li");
  });
});
