// Property 12: the Date_Guard scan reports exactly the Date_Forms present
// (spec 18, Requirement 12).
//
// For any text built from lines of plain words, some of which carry one
// Persona_Dates Date_Form, scanText reports each form present at its 1-based
// line, in order, and nothing else. Text with no form reports nothing.
//
// Every form is surrounded by words with no digits, so a form never sits next
// to a number that the month-form rule would read as a day prefix.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import rawPersonaList from "../../content/personas/personas.json";

import {
  dateFormsOf,
  personaDatesFrom,
  scanText,
  type DateForm,
} from "./persona-dates-guard.test";

const PATH = "src/example.ts";

// The Date_Forms of every Persona_Dates value, one entry per distinct text.
const FORMS: DateForm[] = (() => {
  const seen = new Map<string, DateForm>();
  for (const value of personaDatesFrom(rawPersonaList)) {
    for (const form of dateFormsOf(value)) {
      if (!seen.has(form.text)) seen.set(form.text, form);
    }
  }
  return [...seen.values()];
})();

const WORDS = ["alpha", "beta", "gamma", "the", "letter", "we", "said", "hope", "on", "at"];

const wordArb = fc.constantFrom(...WORDS);
const formArb = fc.constantFrom(...FORMS);

// One item is a word, then either a form or nothing.
const itemArb = fc.tuple(wordArb, fc.option(formArb, { nil: null }));
const lineArb = fc.array(itemArb, { minLength: 1, maxLength: 4 });

function renderLine(items: readonly (readonly [string, DateForm | null])[]): string {
  return items
    .map(([word, form]) => (form ? `${word} ${form.text} ` : `${word} `))
    .join("")
    .trimEnd();
}

describe("Property 12: Date_Guard reports exactly the Date_Forms present", () => {
  it("reports each planted form at its line, in order, and nothing else", () => {
    fc.assert(
      fc.property(fc.array(lineArb, { minLength: 1, maxLength: 8 }), (lines) => {
        const text = lines.map(renderLine).join("\n");
        const expected = lines.flatMap((items, index) =>
          items.flatMap(([, form]) =>
            form ? [{ path: PATH, line: index + 1, form: form.text }] : [],
          ),
        );
        expect(scanText(PATH, text, FORMS)).toEqual(expected);
      }),
      { numRuns: 100 },
    );
  });

  it("reports nothing for text that holds no Date_Form", () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(wordArb, { minLength: 1, maxLength: 6 }), {
          minLength: 1,
          maxLength: 8,
        }),
        (lines) => {
          const text = lines.map((words) => words.join(" ")).join("\n");
          expect(scanText(PATH, text, FORMS)).toEqual([]);
        },
      ),
      { numRuns: 100 },
    );
  });
});
