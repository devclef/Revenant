// Feature: 09-demo-polish, task 16 (issue #263): AnswerList example tests.
//
// Each answer shows the metric's name, then the Answer_Text and unit, or "No
// answer". No figure value, period or source appears next to an answer (spec 03
// R3.8). Rendered with renderToStaticMarkup, matching the reveal test style.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { AnswerList, type AnswerListItem } from "./AnswerList";
import { REVEAL_COPY } from "./copy";

function render(items: readonly AnswerListItem[]): string {
  return renderToStaticMarkup(createElement(AnswerList, { items }));
}

describe("AnswerList", () => {
  it("renders one list item per answer, in the order given", () => {
    const html = render([
      { kind: "number", name: "Regular gasoline", markValue: "3.90", unit: "USD per gallon" },
      { kind: "number", name: "Eggs", markValue: "4", unit: "USD per dozen" },
      { kind: "number", name: "Rent", markValue: "1200", unit: "USD per month" },
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
    const html = render([{ kind: "number", name: "Regular gasoline", markValue: "3.90", unit: "USD per gallon" }]);
    expect(html).toContain("3.90 USD per gallon");
  });

  it("groups the integer part of a large answer and keeps every digit", () => {
    const html = render([{ kind: "number", name: "Rent", markValue: "1585.70", unit: "USD per month" }]);
    expect(html).toContain("1,585.70 USD per month");
  });

  it("shows 'No answer' and no unit for an unanswered question", () => {
    const html = render([{ kind: "number", name: "Eggs", unit: "USD per dozen" }]);
    expect(html).toContain(REVEAL_COPY.noAnswer);
    expect(html).not.toContain("USD per dozen");
  });

  it("shows no figure value, period, source or series next to an answer", () => {
    const html = render([
      { kind: "number", name: "Regular gasoline", markValue: "3.90", unit: "USD per gallon" },
      { kind: "number", name: "Eggs", unit: "USD per dozen" },
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

  it("renders a text item's question and its answer", () => {
    const html = render([
      {
        kind: "text",
        question: "What did the street smell like?",
        answer: "Bread from the corner bakery.",
      },
    ]);
    expect(html).toContain('data-user-content="">What did the street smell like?<');
    expect(html).toContain('data-user-content="">Bread from the corner bakery.<');
    expect(html).not.toContain(REVEAL_COPY.noAnswer);
  });

  it("shows 'No answer' under a text item's question when the answer is null", () => {
    const html = render([
      { kind: "text", question: "Anything else to add?", answer: null },
    ]);
    expect(html).toContain("Anything else to add?");
    expect(html).toContain(REVEAL_COPY.noAnswer);
  });

  it("lists text items before number items when both are passed in that order", () => {
    const html = render([
      { kind: "text", question: "What did the street smell like?", answer: "Bread." },
      { kind: "number", name: "Eggs", markValue: "4", unit: "USD per dozen" },
    ]);
    const text = html.indexOf("What did the street smell like?");
    const eggs = html.indexOf("Eggs");
    expect(text).toBeGreaterThanOrEqual(0);
    expect(eggs).toBeGreaterThan(text);
    expect(html.match(/<li /g)?.length).toBe(2);
  });
});

// Feature: 11-any-letter, task 1 (issue #349, P4.2): the two-line clamp.
describe("AnswerList clamps each text answer to two lines with a show-full control", () => {
  const longAnswer =
    "We walked to the corner bakery before the rain started, and the bread was still warm when we got back to the flat. " +
    "I remember the smell more than the conversation, which I had meant to keep for later and never wrote down properly.";

  const cssPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "reveal.module.css",
  );
  const css = readFileSync(cssPath, "utf8");

  it("clamps the answer to ANSWER_CLAMP_LINES_LETTER (2) lines through the CSS class", () => {
    const html = render([{ kind: "text", question: "Q", answer: longAnswer }]);
    expect(html).toContain("answerClamped");
    expect(css).toMatch(/\.answerClamped\s*\{[^}]*-webkit-line-clamp:\s*2;/);
    expect(css).toMatch(/\.answerClamped\s*\{[^}]*line-clamp:\s*2;/);
  });

  it("keeps the full answer text in the markup while it is clamped", () => {
    const html = render([{ kind: "text", question: "Q", answer: longAnswer }]);
    expect(html).toContain(longAnswer);
    expect(html).toContain('aria-expanded="false"');
  });

  it("shows a show-full control, labelled in the copy, that is a plain button", () => {
    const html = render([{ kind: "text", question: "Q", answer: longAnswer }]);
    expect(html).toContain(`>${REVEAL_COPY.answerShowFull}</button>`);
    expect(html).toMatch(/<button type="button"[^>]*data-answer-toggle=""/);
  });

  it("does not add the control or the clamp to a question with no answer", () => {
    const html = render([{ kind: "text", question: "Anything else?", answer: null }]);
    expect(html).not.toContain("<button");
    expect(html).not.toContain("answerClamped");
    expect(html).toContain(REVEAL_COPY.noAnswer);
  });

  it("leaves focus where it is: no autofocus on the control or the answer", () => {
    const html = render([{ kind: "text", question: "Q", answer: longAnswer }]);
    expect(html).not.toContain("autofocus");
    expect(html).not.toContain("tabindex");
  });
});
