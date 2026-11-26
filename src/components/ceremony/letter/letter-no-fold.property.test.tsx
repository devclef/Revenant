// Property 6: the letter is never folded
//
// For any props the letter stage can receive, the rendered LetterBlock holds
// no disclosure: no details element, no summary and no data-letter-disclosure
// attribute. The paper and its Letter_Text paragraph are always in the
// document, so the letter is never hidden behind a control.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { LetterBlock, type LetterBlockProps } from "./LetterBlock";
import { MotionProvider } from "../motion";
import type { Opened } from "@/components/reveal/opening-machine";
import type { LetterKind } from "@/components/reveal/FigureLine";
import type { PayloadV1 } from "@/lib/seal-format";

function openedWith(letterText: string, writtenAsOf: string | undefined): Opened {
  const payload: PayloadV1 = {
    format_version: 1,
    letter_text: letterText,
    ...(writtenAsOf === undefined ? {} : { written_as_of: writtenAsOf }),
    metrics: [],
    figures: [],
    recall_questions: [],
  };
  return {
    letterId: "letter-no-fold",
    header: {
      sealedAt: "2024-10-01T00:00:00.000Z",
      opensAt: "2024-11-05T00:00:00.000Z",
    },
    openingKey: {} as unknown as CryptoKey,
    envelopeHash:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    payload,
  };
}

const propsArb = fc.record({
  letterText: fc.string({ maxLength: 300 }),
  writtenAsOf: fc.option(fc.constant("2024-10-15"), { nil: undefined }),
  variant: fc.option(fc.constantFrom("persona" as const, "live" as const), {
    nil: undefined,
  }),
  letterId: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  letterKind: fc.option(
    fc.constantFrom<LetterKind>("persona", "live", "real"),
    { nil: undefined },
  ),
  still: fc.boolean(),
  hasCaption: fc.boolean(),
  // A prop that no longer exists. Passing it must not bring a disclosure back.
  collapsible: fc.boolean(),
});

describe("Property 6: the letter is never folded", () => {
  it("renders no disclosure for any props", () => {
    fc.assert(
      fc.property(propsArb, (p) => {
        const props = {
          opened: openedWith(p.letterText, p.writtenAsOf),
          personaName: "Maya",
          variant: p.variant,
          letterId: p.letterId,
          letterKind: p.letterKind,
          still: p.still,
          caption: p.hasCaption
            ? createElement("span", { "data-caption-slot": "" }, "verdict")
            : undefined,
          collapsible: p.collapsible,
        };
        const html = renderToStaticMarkup(
          createElement(
            MotionProvider,
            null,
            createElement(LetterBlock, props as LetterBlockProps),
          ),
        );
        expect(html).not.toMatch(/<details/);
        expect(html).not.toContain("<summary");
        expect(html).not.toContain("data-letter-disclosure");
        expect(html).toContain("data-letter-text");
      }),
      { numRuns: 100 },
    );
  });
});
