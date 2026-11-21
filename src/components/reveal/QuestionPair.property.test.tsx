// Feature: 15-the-flow, Property 5: Receipts pair text without changing it
//
// For any question, testimony and sealed answer, the rendered pair contains each
// string unchanged, in the order question, testimony, sealed answer, and no
// other text derived from them. The labels are fixed copy passed in by the
// caller, so the only text nodes are those six strings.
//
// Validates requirements 12.3 (no comment, highlight or rewrite of either text).

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import fc from "fast-check";

import { QuestionPair } from "./QuestionPair";

/**
 * Strings that survive HTML escaping unchanged, so the text nodes in the markup
 * are exactly the strings passed in. Characters that React would escape are
 * left out on purpose: the escaped form is not the same text.
 */
const textArb = fc
  .string({ minLength: 1, maxLength: 60 })
  .filter((s) => !/[<>&"'\u0000-\u001f]/.test(s) && s.trim() === s);

const LABELS = {
  questionLabel: "Your question, as you wrote it",
  testimonyLabel: "What you remember now",
  sealedLabel: "What you wrote on 19 November 2026",
  noSealedAnswer: "No answer was sealed with this question.",
} as const;

/** The text nodes of a static render, in document order. */
function textNodes(markup: string): string[] {
  return [...markup.matchAll(/>([^<>]+)</g)].map((match) => match[1] ?? "");
}

describe("Property 5: receipts pair text without changing it", () => {
  it("renders question, testimony and sealed answer unchanged, in that order, and nothing else", () => {
    fc.assert(
      fc.property(textArb, textArb, textArb, (question, testimony, sealed) => {
        const markup = renderToStaticMarkup(
          <QuestionPair
            question={question}
            testimony={testimony}
            sealedAnswer={sealed}
            {...LABELS}
            userContent={false}
          />,
        );
        expect(textNodes(markup)).toEqual([
          LABELS.questionLabel,
          question,
          LABELS.testimonyLabel,
          testimony,
          LABELS.sealedLabel,
          sealed,
        ]);
      }),
      { numRuns: 200 },
    );
  });

  it("shows the no-answer line in place of a sealed answer, and changes no other text", () => {
    fc.assert(
      fc.property(textArb, textArb, (question, testimony) => {
        const markup = renderToStaticMarkup(
          <QuestionPair
            question={question}
            testimony={testimony}
            sealedAnswer={undefined}
            {...LABELS}
          />,
        );
        expect(textNodes(markup)).toEqual([
          LABELS.questionLabel,
          question,
          LABELS.testimonyLabel,
          testimony,
          LABELS.sealedLabel,
          LABELS.noSealedAnswer,
        ]);
      }),
      { numRuns: 200 },
    );
  });
});
