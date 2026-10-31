// Feature: 03-persona-demo, Task 7 (R15.2-R15.4)
import { describe, expect, it } from "vitest";

import { REVEAL_COPY } from "./copy";

/**
 * Scans every user-facing string in the reveal copy module against the
 * tone.md and neutrality.md constraints the opening flow must satisfy. No DOM
 * library: these are plain string assertions.
 *
 * The checks mirror the demo copy test (src/components/demo/copy.test.ts) so
 * both copy modules are held to the same bar:
 *
 *   R15.2  no exclamation mark anywhere.
 *   R15.3  no sentence over 25 words; none of tone.md's clichés/puns and none
 *          of neutrality.md's evaluative ("soared", "finally", "plunged")
 *          words.
 *   R15.4  every error- or empty-state string names an action the reader can
 *          take (tone.md: "say what happened and what the user can do").
 *
 * `{...}` placeholders are render-time values, not sentences, so they are
 * stripped before the sentence-length and word checks so a filled-in value can
 * never make a sentence falsely long. They carry no judgement by construction.
 */

/** Every string a reader could see, paired with its key for readable failures. */
const ENTRIES = Object.entries(REVEAL_COPY) as ReadonlyArray<
  readonly [keyof typeof REVEAL_COPY, string]
>;

/**
 * Error- or empty-state strings that must name an action the reader can take
 * (R15.4). These are the flow's failure and recoverable states; a plain
 * heading or confirmation statement is not required to name an action.
 */
const ACTION_KEYS = [
  "notPlaced",
  "unreachable",
  "verificationFailed",
  "wrongKey",
  "tampered",
  "unsupportedFormat",
  "invalidPayload",
  "invalidInput",
  "submitFailed",
] as const;

/**
 * tone.md's banned clichés and puns: boo / spook / skull / mwahaha / blood /
 * gore and the documented puns ("boo-tiful", "spooktacular"). Matched
 * case-insensitively as substrings, which also catches the puns.
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

/**
 * neutrality.md's evaluative words: copy must not describe a change as good or
 * bad ("rent soared" / "rent finally fell" are called out by name). Matched as
 * whole words, case-insensitively, so a neutral word that merely contains one
 * of these as a substring does not trip.
 */
const EVALUATIVE = [
  "soared",
  "soar",
  "plunged",
  "plunge",
  "plummeted",
  "skyrocketed",
  "crashed",
  "finally",
  "surged",
  "collapsed",
  "exploded",
  "booming",
] as const;

/** A rough actionable-verb/instruction vocabulary for error/empty-state copy. */
const ACTION_WORDS = [
  "go back",
  "try again",
  "try",
  "come back",
  "check",
  "choose",
  "return",
  "wait",
  "update",
  "ready",
] as const;

/** Drop `{...}` placeholders so a render-time value never skews a word count. */
const stripPlaceholders = (text: string): string =>
  text.replace(/\{[^}]*\}/g, " ");

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

describe("REVEAL_COPY tone and neutrality", () => {
  it("has at least one string to scan", () => {
    expect(ENTRIES.length).toBeGreaterThan(0);
  });

  it("contains no exclamation mark (R15.2)", () => {
    for (const [key, value] of ENTRIES) {
      expect(value, `${key} must not contain "!"`).not.toContain("!");
    }
  });

  it("has no sentence longer than 25 words (R15.3)", () => {
    for (const [key, value] of ENTRIES) {
      for (const sentence of splitSentences(stripPlaceholders(value))) {
        expect(
          countWords(sentence),
          `${key}: sentence over 25 words -> "${sentence}"`,
        ).toBeLessThanOrEqual(25);
      }
    }
  });

  it("contains none of tone.md's clichés or puns (R15.3)", () => {
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

  it("contains none of neutrality.md's evaluative words (R15.3)", () => {
    for (const [key, value] of ENTRIES) {
      for (const word of EVALUATIVE) {
        const whole = new RegExp(`\\b${word}\\b`, "i");
        expect(
          whole.test(value),
          `${key} contains evaluative word "${word}" -> "${value}"`,
        ).toBe(false);
      }
    }
  });

  it("names an action in every error- or empty-state string (R15.4)", () => {
    for (const key of ACTION_KEYS) {
      const value = REVEAL_COPY[key];
      const lower = value.toLowerCase();
      const namesAction = ACTION_WORDS.some((word) => lower.includes(word));
      expect(
        namesAction,
        `${key} must name an action the reader can take -> "${value}"`,
      ).toBe(true);
    }
  });
});
