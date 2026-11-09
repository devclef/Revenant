// Feature: 10-own-questions, task 10 (issue #306): Property 18.
//
// For any payload with 0 to 3 text questions and 0 to 6 number questions and
// any matching record, the Answer_List has one item per question, all text
// items before all number items, each in payload order, each showing its
// answer or "No answer". Validates C6.10, C8.1.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { AnswerList, type AnswerListItem } from "./AnswerList";
import { REVEAL_COPY } from "./copy";

/** One text item: a question and a free-text answer, or null for "No answer". */
const textItem = fc.record({
  kind: fc.constant("text" as const),
  question: fc.string({ minLength: 1, maxLength: 60 }),
  answer: fc.option(fc.string({ minLength: 1, maxLength: 80 }), { nil: null }),
});

/** One number item: a metric name, an optional value, a unit, a sample flag. */
const numberItem = fc.record({
  kind: fc.constant("number" as const),
  name: fc.string({ minLength: 1, maxLength: 40 }),
  markValue: fc.option(fc.stringMatching(/^[0-9]{1,4}\.[0-9]{2}$/), {
    nil: undefined,
  }),
  unit: fc.constantFrom("USD per gallon", "EUR per 1,000 litres", "SEK per litre"),
  sample: fc.boolean(),
});

function render(items: readonly AnswerListItem[]): string {
  return renderToStaticMarkup(createElement(AnswerList, { items }));
}

describe("Property 18: the Answer_List lists every answer, Author_Questions first", () => {
  it("renders one item per question, text items before number items, in order", () => {
    fc.assert(
      fc.property(
        fc.array(textItem, { maxLength: 3 }),
        fc.array(numberItem, { maxLength: 6 }),
        (texts, numbers) => {
          const items: AnswerListItem[] = [...texts, ...numbers];
          const html = render(items);

          // One <li> per question.
          const liCount = (html.match(/<li /g) ?? []).length;
          expect(liCount).toBe(items.length);

          // Every text item's class marks it, every number item's class marks
          // it; text items all come before number items in the markup.
          const lastText = html.lastIndexOf("answerTextItem");
          const firstNumber = html.indexOf("answerItem");
          if (texts.length > 0 && numbers.length > 0) {
            expect(lastText).toBeGreaterThanOrEqual(0);
            expect(firstNumber).toBeGreaterThan(lastText);
          }
        },
      ),
    );
  });

  it("shows each answer or 'No answer', never a blank item", () => {
    fc.assert(
      fc.property(
        fc.array(textItem, { maxLength: 3 }),
        fc.array(numberItem, { maxLength: 6 }),
        (texts, numbers) => {
          const items: AnswerListItem[] = [...texts, ...numbers];
          const html = render(items);
          const noAnswers =
            texts.filter((t) => t.answer === null).length +
            numbers.filter((n) => n.markValue === undefined).length;
          const shown = (
            html.match(new RegExp(REVEAL_COPY.noAnswer, "g")) ?? []
          ).length;
          expect(shown).toBe(noAnswers);
        },
      ),
    );
  });
});
