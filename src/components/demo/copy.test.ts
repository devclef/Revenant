import { describe, expect, it } from "vitest";

import { DEMO_COPY } from "./copy";

/**
 * Scans every user-facing string in copy.ts against the tone.md and
 * neutrality.md constraints the demo pages must satisfy. No DOM library:
 * these are plain string assertions.
 *
 * tone.md: no exclamation marks, short sentences, none of the documented
 * clichés or puns. data/empty states stay in voice but stay clear and name
 * what the reader can do (tone.md "Errors and empty states ... say what
 * happened and what the user can do").
 */

/** Every string a reader could see, paired with its key for readable failures. */
const ENTRIES = Object.entries(DEMO_COPY) as ReadonlyArray<
  readonly [keyof typeof DEMO_COPY, string]
>;

/** Error-or-empty-state strings that must name an action the reader can take. */
const ACTION_KEYS = ["indexEmpty", "notFoundBody"] as const;

/**
 * tone.md's banned clichés and puns. The spec names boo / spook / skull /
 * mwahaha / blood / gore and the documented pun list ("boo-tiful",
 * "spooktacular"). Matched case-insensitively as substrings, which also
 * catches the puns (they contain "boo" / "spook").
 */
const CLICHES = [
  "boo",
  "spook",
  "skull",
  "mwahaha",
  "blood",
  "gore",
  "boo-tiful",
  "bootiful",
  "spooktacular",
] as const;

/** A rough actionable-verb/instruction vocabulary for empty-state copy. */
const ACTION_WORDS = [
  "come back",
  "go back",
  "open",
  "choose",
  "try",
  "scan",
  "check",
  "return",
  "wait",
  "see",
  "read",
  "visit",
] as const;

const countWords = (sentence: string): number =>
  sentence
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

/** Split a string into sentences on ., ! or ? so each can be length-checked. */
const splitSentences = (text: string): string[] =>
  text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

describe("DEMO_COPY tone and neutrality", () => {
  it("has at least one string to scan", () => {
    expect(ENTRIES.length).toBeGreaterThan(0);
  });

  it("contains no exclamation mark", () => {
    for (const [key, value] of ENTRIES) {
      expect(value, `${key} must not contain "!"`).not.toContain("!");
    }
  });

  it("has no sentence longer than 25 words", () => {
    for (const [key, value] of ENTRIES) {
      for (const sentence of splitSentences(value)) {
        expect(
          countWords(sentence),
          `${key}: sentence over 25 words -> "${sentence}"`,
        ).toBeLessThanOrEqual(25);
      }
    }
  });

  it("contains none of tone.md's clichés or puns", () => {
    for (const [key, value] of ENTRIES) {
      const lower = value.toLowerCase();
      for (const cliche of CLICHES) {
        expect(
          lower.includes(cliche),
          `${key} contains banned cliché/pun "${cliche}"`,
        ).toBe(false);
      }
    }
  });

  it("names an action in every error-or-empty-state string", () => {
    for (const key of ACTION_KEYS) {
      const value = DEMO_COPY[key];
      const lower = value.toLowerCase();
      const namesAction = ACTION_WORDS.some((word) => lower.includes(word));
      expect(
        namesAction,
        `${key} must name an action the reader can take -> "${value}"`,
      ).toBe(true);
    }
  });
});
