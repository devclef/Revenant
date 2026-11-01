// Feature: 05-reveal-ceremony, Task 8 (R15.2-R15.3)
import { describe, expect, it } from "vitest";

import { CEREMONY_COPY } from "./copy";
import type { Stage } from "./stages";

/**
 * Scans every user-facing string in the ceremony copy module against the
 * tone.md and neutrality.md constraints the reveal ceremony must satisfy. No
 * DOM library: these are plain string assertions, mirroring
 * reveal/copy.test.ts and demo/copy.test.ts so all three copy modules are held
 * to the same bar:
 *
 *   R15.2  no exclamation mark anywhere.
 *   R15.3  no sentence over 25 words; none of tone.md's clichés/puns and none
 *          of neutrality.md's evaluative ("soared", "finally", "plunged")
 *          words.
 *
 * `{...}` placeholders are render-time values, not sentences, so they are
 * stripped before the sentence-length and word checks so a filled-in value can
 * never make a sentence falsely long. They carry no judgement by construction.
 *
 * The flattener walks the `stageLive` sub-object so its one line per Stage is
 * held to the same bar, keyed `stageLive.<stage>` for a readable failure.
 */
const flattenStrings = (
  obj: Record<string, unknown>,
  prefix = "",
): Array<readonly [string, string]> => {
  const out: Array<readonly [string, string]> = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      out.push([path, value]);
    } else if (value && typeof value === "object") {
      out.push(...flattenStrings(value as Record<string, unknown>, path));
    }
  }
  return out;
};

const ENTRIES: ReadonlyArray<readonly [string, string]> = flattenStrings(
  CEREMONY_COPY as unknown as Record<string, unknown>,
);

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

/**
 * Every `Stage` value from stages.ts. Kept in sync with the `Stage` union by
 * the exhaustive `satisfies` check below: adding a Stage without listing it
 * here (or vice versa) is a compile error, so this list cannot silently drift
 * from the union the live region must cover.
 */
const ALL_STAGES = [
  "desk",
  "envelope",
  "intact",
  "recall",
  "marks",
  "seal",
  "letter",
  "then",
  "passage",
  "now",
  "close",
  "error",
] as const satisfies ReadonlyArray<Stage>;

// Compile-time guard: every Stage appears in ALL_STAGES (no missing member).
type _AllStagesCovered = Exclude<Stage, (typeof ALL_STAGES)[number]> extends never
  ? true
  : never;
const _allStagesCovered: _AllStagesCovered = true;
void _allStagesCovered;

describe("CEREMONY_COPY tone and neutrality", () => {
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

  it("has a stageLive entry for every Stage (none missing)", () => {
    const liveKeys = Object.keys(CEREMONY_COPY.stageLive).sort();
    expect(liveKeys).toEqual([...ALL_STAGES].sort());

    for (const stage of ALL_STAGES) {
      const line = (CEREMONY_COPY.stageLive as Record<string, string>)[stage];
      expect(line, `stageLive.${stage} must be a non-empty string`).toBeTypeOf(
        "string",
      );
      expect(
        line.trim().length,
        `stageLive.${stage} must not be empty`,
      ).toBeGreaterThan(0);
    }
  });
});
