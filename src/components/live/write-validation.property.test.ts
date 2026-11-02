// Property 13: write validation matches the rules (design.md, Correctness
// Properties; R12.3, R12.4, R13.2, R15.11).
//
// Each rule is checked against an independent oracle written from the rule
// itself, not from form.ts. One case is defined explicitly: a letter that is
// blank (only whitespace) reports `letter_empty` and never `letter_too_long`,
// even when it is longer than 5000 code points, because the form asks for text
// first. For every other letter, `letter_too_long` holds exactly when the
// letter has more than 5000 code points.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { MAX_FIGURES, MAX_LETTER_CODE_POINTS } from "./constants";
import { validateWrite, type WriteProblem } from "./form";

const WHITESPACE_CHARS = [" ", "\n", "\t", "\r", "\u00a0", "\u2003"];

// Letters of every length around the limit, in code points, plus some with
// astral characters (two UTF-16 units each) and combining marks.
// A code point from anywhere in Unicode except surrogates, which cannot stand alone.
const codePointArb = fc.integer({ min: 0, max: 0x10ffff }).filter((n) => n < 0xd800 || n > 0xdfff);

const letterArb: fc.Arbitrary<string> = fc.oneof(
  fc
    .array(codePointArb, { maxLength: MAX_LETTER_CODE_POINTS + 10 })
    .map((codePoints) => String.fromCodePoint(...codePoints)),
  fc
    .array(fc.constantFrom(...WHITESPACE_CHARS), { maxLength: 12 })
    .map((chars) => chars.join("")),
  fc
    .integer({ min: MAX_LETTER_CODE_POINTS - 5, max: MAX_LETTER_CODE_POINTS + 5 })
    .map((n) => "a".repeat(n)),
  fc
    .integer({ min: MAX_LETTER_CODE_POINTS - 5, max: MAX_LETTER_CODE_POINTS + 5 })
    .map((n) => "\u{1F600}".repeat(n)),
  fc
    .integer({ min: 0, max: MAX_LETTER_CODE_POINTS + 5 })
    .map((n) => "e\u0301".repeat(n)),
);

const metricIdsArb: fc.Arbitrary<string[]> = fc.array(fc.string({ maxLength: 12 }), {
  maxLength: MAX_FIGURES + 3,
});

describe("Property 13: validateWrite matches the write rules", () => {
  it("reports each problem exactly when its rule holds, in the fixed order", () => {
    fc.assert(
      fc.property(letterArb, metricIdsArb, fc.boolean(), (text, metricIds, warningTicked) => {
        const problems = validateWrite({ text, metricIds, warningTicked });

        const codePoints = [...text].length;
        const blank = text.trim().length === 0;

        const expectLetterEmpty = blank;
        const expectLetterTooLong = !blank && codePoints > MAX_LETTER_CODE_POINTS;
        const expectFiguresNone = metricIds.length === 0;
        const expectFiguresTooMany = metricIds.length > MAX_FIGURES;
        const expectWarningUnticked = !warningTicked;

        expect(problems.includes("letter_empty")).toBe(expectLetterEmpty);
        expect(problems.includes("letter_too_long")).toBe(expectLetterTooLong);
        expect(problems.includes("figures_none")).toBe(expectFiguresNone);
        expect(problems.includes("figures_too_many")).toBe(expectFiguresTooMany);
        expect(problems.includes("warning_unticked")).toBe(expectWarningUnticked);

        const expected: WriteProblem[] = [];
        if (expectLetterEmpty) expected.push("letter_empty");
        if (expectLetterTooLong) expected.push("letter_too_long");
        if (expectFiguresNone) expected.push("figures_none");
        if (expectFiguresTooMany) expected.push("figures_too_many");
        if (expectWarningUnticked) expected.push("warning_unticked");
        expect(problems).toEqual(expected);
      }),
      { numRuns: 100 },
    );
  });

  it("accepts a letter of exactly 5000 code points and rejects 5001", () => {
    const ok = "a".repeat(MAX_LETTER_CODE_POINTS);
    const tooLong = "a".repeat(MAX_LETTER_CODE_POINTS + 1);
    const picks = ["us-gasoline-regular"];

    expect(validateWrite({ text: ok, metricIds: picks, warningTicked: true })).toEqual([]);
    expect(validateWrite({ text: tooLong, metricIds: picks, warningTicked: true })).toEqual([
      "letter_too_long",
    ]);
  });
});
