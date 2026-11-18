// Copy rules for the Occasion suggestions and placeholders on the Write desk
// (spec 14, W8). Every suggestion names the sealing day, stays inside the
// letter-question limit, avoids words that anchor a question to the present,
// and never repeats an Occasion question.
//
// Validates: Requirements W8.1, W8.4, W2.5, neutrality.md, tone.md.

import { describe, expect, it } from "vitest";

import { DEFAULT_QUESTION, OCCASIONS, SHARED_SUGGESTIONS } from "../occasions";

/** Sealing-day anchor: a question names the day it was written (tone.md). */
const SEALING_DAY_ANCHOR = /\b(when you wrote this|the day you sealed this)\b/i;
/** Words a question must never use (tone.md, Questions). */
const BANNED = /right now|today|currently/i;
const QUESTION_MAX_CHARS = 200;
const PLACEHOLDER_MAX_WORDS = 12;

const OCCASION_QUESTIONS: readonly string[] = OCCASIONS.flatMap(
  (o) => o.questions,
);

const ALL_SUGGESTIONS: readonly { source: string; text: string }[] = [
  ...OCCASIONS.flatMap((o) =>
    o.suggestions.map((text) => ({ source: o.id, text })),
  ),
  ...SHARED_SUGGESTIONS.map((text) => ({ source: "shared", text })),
];

describe("Occasion suggestions (spec 14, W8)", () => {
  it.each(OCCASIONS.map((o) => [o.id, o] as const))(
    "%s offers at least two suggestions",
    (_id, occasion) => {
      expect(occasion.suggestions.length).toBeGreaterThanOrEqual(2);
    },
  );

  it.each(ALL_SUGGESTIONS.map((s) => [s.source, s.text] as const))(
    "%s suggestion names the sealing day: %s",
    (_source, text) => {
      expect(text).toMatch(SEALING_DAY_ANCHOR);
    },
  );

  it.each(ALL_SUGGESTIONS.map((s) => [s.source, s.text] as const))(
    "%s suggestion avoids present-tense words: %s",
    (_source, text) => {
      expect(text).not.toMatch(BANNED);
    },
  );

  it.each(ALL_SUGGESTIONS.map((s) => [s.source, s.text] as const))(
    "%s suggestion fits the 200-character limit",
    (_source, text) => {
      expect(text.length).toBeLessThanOrEqual(QUESTION_MAX_CHARS);
    },
  );

  it.each(ALL_SUGGESTIONS.map((s) => [s.source, s.text] as const))(
    "%s suggestion is not an Occasion question",
    (_source, text) => {
      expect(OCCASION_QUESTIONS).not.toContain(text);
    },
  );

  it("never repeats the default question as a suggestion", () => {
    const texts = ALL_SUGGESTIONS.map((s) => s.text);
    expect(texts).not.toContain(DEFAULT_QUESTION);
  });
});

describe("Occasion placeholders (spec 14, W2)", () => {
  it.each(OCCASIONS.map((o) => [o.id, o.placeholder] as const))(
    "%s placeholder is at most 12 words",
    (_id, placeholder) => {
      const words = placeholder.trim().split(/\s+/).filter(Boolean);
      expect(words.length).toBeLessThanOrEqual(PLACEHOLDER_MAX_WORDS);
    },
  );
});
