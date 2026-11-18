// Feature: 14-write-desk, Property 7: The checklist states exactly what is in the envelope
//
// envelopeChecklist counts the letter words, the non-blank question rows, the
// distinct figures and the one complete own number, and says so in the plain
// forms the envelope card and the phone line use.
//
// Validates: Requirements W9.5, W9.6, W9.7, W9.8, Q2.2.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { SelfReportedRow } from "../write-draft";

import { envelopeChecklist, type ChecklistInput } from "./checklist";

const TEXT_PARTS = ["", " ", "\t", "\n", "a", "Dear", "me", "é", "word", "."];

const textArb = fc
  .array(fc.constantFrom(...TEXT_PARTS), { maxLength: 30 })
  .map((parts) => parts.join(" "));

const questionArb = fc.oneof(
  fc.constant(""),
  fc.constant("   "),
  fc.string({ maxLength: 40 }),
);

const ROW_PART = ["", "  ", "Rent", "1250", "USD per month", "U.S.", "2026-11"];
const partArb = fc.constantFrom(...ROW_PART);

const rowArb: fc.Arbitrary<SelfReportedRow> = fc.record({
  name: partArb,
  value: partArb,
  unit: partArb,
  region: partArb,
  period: partArb,
});

const inputArb: fc.Arbitrary<ChecklistInput> = fc.record({
  text: textArb,
  questions: fc.array(questionArb, { maxLength: 5 }),
  metricIds: fc.array(
    fc.constantFrom("us-gasoline-regular", "eu-diesel", "se-milk"),
    {
      maxLength: 6,
    },
  ),
  ownNumber: fc.oneof(fc.constant(null), rowArb),
});

/** Words are runs of non-whitespace characters, counted independently of wordCount. */
function wordsOf(text: string): number {
  return (text.match(/\S+/gu) ?? []).length;
}

/** The own number counts only when all four labelled fields are filled in. */
function ownNumberCounts(row: SelfReportedRow | null): boolean {
  if (row === null) return false;
  return [row.name, row.value, row.unit, row.region].every(
    (field) => field.trim() !== "",
  );
}

/** The receipt text built from the counts alone (W9.5, W9.6). */
function expectedReceipt(figures: number, own: boolean): string {
  const parts: string[] = [];
  if (figures === 1) parts.push("1 price");
  else if (figures > 1) parts.push(`${figures} prices`);
  if (own) parts.push("1 own number");
  return parts.length === 0 ? "none yet" : parts.join(" · ");
}

describe("Property 7: the checklist states exactly what is in the envelope", () => {
  it("counts the words, the filled question rows, the distinct figures and the own number", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const list = envelopeChecklist(input);
        const words = wordsOf(input.text);
        const questions = input.questions.filter((q) => q.trim() !== "").length;
        const figures = new Set(input.metricIds).size;
        const own = ownNumberCounts(input.ownNumber) ? 1 : 0;

        // Letter (W9.5, W9.7): the word count in the plain form.
        const letter =
          words === 0
            ? "not written yet"
            : words === 1
              ? "1 word"
              : `${words} words`;
        expect(list.letter).toBe(letter);
        expect(list.present.letter).toBe(words > 0);

        // Questions (W9.5, Q2.2): blank rows never count.
        expect(list.questions).toBe(`${questions} of 3`);
        expect(list.present.questions).toBe(questions > 0);

        // Receipt (W9.5, W9.6): each distinct figure and the own number.
        expect(list.receipt).toBe(expectedReceipt(figures, own === 1));
        expect(list.present.receipt).toBe(figures > 0 || own === 1);
      }),
    );
  });

  it("states the phone line from the same counts (W9.8)", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const list = envelopeChecklist(input);
        const words = wordsOf(input.text);
        const questions = input.questions.filter((q) => q.trim() !== "").length;
        const figures = new Set(input.metricIds).size;
        const own = ownNumberCounts(input.ownNumber);

        const letterPart = words === 0 ? "No letter yet" : "Letter";
        const questionsPart =
          questions === 0
            ? "no questions"
            : questions === 1
              ? "1 question"
              : `${questions} questions`;
        const receiptPart =
          figures === 0 && !own ? "no receipt" : expectedReceipt(figures, own);

        expect(list.phoneLine).toBe(
          [letterPart, questionsPart, receiptPart].join(" · "),
        );
      }),
    );
  });
});
