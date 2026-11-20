// Copy rules for the Occasion suggestions and placeholders on the Write desk
// (spec 14, W8; spec 15, R8.1 to R8.3). Every suggestion is first person and
// present tense, stays inside the letter-question limit, never uses "you",
// "your", "when you wrote this" or "the day you sealed this", and never repeats
// an Occasion question.
//
// Validates: Requirements 8.2, 8.3, W8.1, W8.4, W2.5, neutrality.md, tone.md.

import { describe, expect, it } from "vitest";

import { DEFAULT_QUESTION, OCCASIONS, SHARED_SUGGESTIONS } from "../occasions";

/** A first-person word: "I", "me" or "my" (spec 15, R8.2). */
const FIRST_PERSON = /\b(I|me|my)\b/;
/** Second person and the sealing-day phrasing that R8.2 retires. */
const RETIRED_VOICE = /\b(you|your|when you wrote this|the day you sealed this)\b/i;
/** Words a question must never use (tone.md, Questions). */
const BANNED = /today|currently/i;
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

describe("Occasion suggestions (spec 14, W8; spec 15, R8.2)", () => {
  it.each(OCCASIONS.map((o) => [o.id, o] as const))(
    "%s offers at least two suggestions",
    (_id, occasion) => {
      expect(occasion.suggestions.length).toBeGreaterThanOrEqual(2);
    },
  );

  it.each(ALL_SUGGESTIONS.map((s) => [s.source, s.text] as const))(
    "%s suggestion is first person: %s",
    (_source, text) => {
      expect(text).toMatch(FIRST_PERSON);
    },
  );

  it.each(ALL_SUGGESTIONS.map((s) => [s.source, s.text] as const))(
    "%s suggestion uses no second person or sealing-day phrasing: %s",
    (_source, text) => {
      expect(text).not.toMatch(RETIRED_VOICE);
    },
  );

  it.each(ALL_SUGGESTIONS.map((s) => [s.source, s.text] as const))(
    "%s suggestion avoids the time words today and currently: %s",
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
