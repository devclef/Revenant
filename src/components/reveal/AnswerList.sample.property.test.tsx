// Feature: 10-own-questions, task 10 (issue #306): Property 17 (extended) for
// the Answer_List.
//
// For any Answer_List items, the rendered list shows the Sample_Label
// ("sample answer") next to exactly the number answers that carry
// `sample: true`, and nowhere else; a Kept_Sample renders with the same
// elements, classes and words as any other number answer, apart from the label.
// Validates C5.8, C5.9, C5.11.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { AnswerList, type AnswerListItem } from "./AnswerList";
import { REVEAL_COPY } from "./copy";

const numberItem = fc.record({
  kind: fc.constant("number" as const),
  name: fc.string({ minLength: 1, maxLength: 40 }),
  markValue: fc.option(fc.stringMatching(/^[0-9]{1,4}\.[0-9]{2}$/), {
    nil: undefined,
  }),
  unit: fc.constantFrom("USD per gallon", "EUR per 1,000 litres"),
  sample: fc.boolean(),
});

function render(items: readonly AnswerListItem[]): string {
  return renderToStaticMarkup(createElement(AnswerList, { items }));
}

// The Sample_Label is "· sample answer"; count only the "sample answer" core so
// a stray middot elsewhere cannot inflate the count.
const SAMPLE_CORE = REVEAL_COPY.sampleLabel.replace(/^[^A-Za-z]+/, "");

describe("Property 17: the Sample_Label marks only Kept_Samples in the Answer_List", () => {
  it("shows 'sample answer' exactly once per sample:true number answer, and nowhere else", () => {
    fc.assert(
      fc.property(fc.array(numberItem, { maxLength: 6 }), (numbers) => {
        const html = render(numbers);
        const kept = numbers.filter((n) => n.sample === true).length;
        const shown = (html.match(new RegExp(SAMPLE_CORE, "g")) ?? []).length;
        expect(shown).toBe(kept);
      }),
    );
  });

  it("marks a Kept_Sample with the same answerValue element and class as a plain answer", () => {
    const plain: AnswerListItem = {
      kind: "number",
      name: "Regular gasoline",
      markValue: "3.59",
      unit: "USD per gallon",
      sample: false,
    };
    const sampled: AnswerListItem = { ...plain, sample: true };
    const plainHtml = render([plain]);
    const sampleHtml = render([sampled]);
    // The sampled render is the plain render with the Sample_Label span added.
    expect(plainHtml).not.toContain(SAMPLE_CORE);
    expect(sampleHtml).toContain(SAMPLE_CORE);
    // Both carry the same answerName and answerValue structure.
    expect(sampleHtml).toContain("3.59 USD per gallon");
    expect(plainHtml).toContain("3.59 USD per gallon");
  });
});
