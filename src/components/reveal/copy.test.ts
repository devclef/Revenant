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

/**
 * Every string a reader could see, paired with its key for readable failures.
 * REVEAL_COPY is mostly flat, but the stage-3 `reason` sub-object nests one
 * "not comparable" sentence per NotComparableReason. The scanner walks one
 * level of nesting so those sentences are held to the same bar, keyed as
 * `reason.<name>` for a readable failure message.
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

const ENTRIES: ReadonlyArray<readonly [string, string]> =
  flattenStrings(REVEAL_COPY as unknown as Record<string, unknown>);

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

describe("REVEAL_COPY claims with code behind them", () => {
  it("asks the reader to compare the fingerprint with the card, without claiming a match the app never checks", () => {
    expect(REVEAL_COPY.fingerprintPassedCard).toContain("Compare it with the fingerprint");
    expect(REVEAL_COPY.fingerprintPassedCard).not.toMatch(/matches/i);
  });
});

describe("spec 09 ritual copy (C2, F4, design.md Copy)", () => {
  it("names the reveal stages and the recall intro with the ritual words", () => {
    expect(REVEAL_COPY.stage1Title).toBe("Your testimony");
    expect(REVEAL_COPY.stage2Next).toBe("See the receipts");
    expect(REVEAL_COPY.stage3Title).toBe("The receipts");
    expect(REVEAL_COPY.recallIntro).toBe(
      "This letter was written as of {date}. Before you read it, testify: say what you remember about that time.",
    );
  });

  it("keeps the retired ritual names out of the reveal copy", () => {
    const all = JSON.stringify(REVEAL_COPY);
    expect(all).not.toContain("What you remembered");
    expect(all).not.toContain("See the numbers");
    expect(all).not.toContain("The numbers, then and now");
    expect(all).not.toContain("tell us how you remember");
  });
});

// Feature: 09-demo-polish, task 17 (C6.1-C6.4, C4.2): exact text of the
// persona disclosure, seal verdict and Fingerprint strings.
describe("spec 09 persona disclosure, verdict and Fingerprint copy (C6, C4.2)", () => {
  it("gives the persona disclosure line its exact text (C6.1)", () => {
    expect(REVEAL_COPY.letterDisclosure).toBe(
      "{name} is fictional. This letter was written as of {writtenAsOf}.",
    );
  });

  it("gives the seal line its exact text (C6.3)", () => {
    expect(REVEAL_COPY.sealedForThisDemo).toBe("Sealed for this demo on {sealedAt}");
  });

  it("gives the seal verdict and the closed Fingerprint strings their exact text (C6.4)", () => {
    expect(REVEAL_COPY.sealVerdict).toBe("The seal is intact. This is exactly the text that was sealed.");
    expect(REVEAL_COPY.letterDisclosureSummary).toBe("Read the letter again");
    expect(REVEAL_COPY.fingerprintShow).toBe("Show the fingerprint");
    expect(REVEAL_COPY.fingerprintHowLink).toBe("How the seal is checked");
  });

  it("keeps the new disclosure and verdict strings free of judgement and scoring words", () => {
    const strings = [
      REVEAL_COPY.letterDisclosure,
      REVEAL_COPY.sealedForThisDemo,
      REVEAL_COPY.sealVerdict,
      REVEAL_COPY.fingerprintShow,
      REVEAL_COPY.fingerprintHowLink,
    ];
    for (const s of strings) {
      expect(s).not.toContain("!");
      expect(s).not.toMatch(/\b(accuracy|score|off by|close|right|wrong|better|worse|rose|fell|up|down)\b/i);
    }
  });
});

// Feature: 09-demo-polish, issue #339 (X3). The reveal shows one honest now
// line for a failed figures request. "Check your connection" retires, because
// the request failure is not the reader's connection to fix: Revenant could
// not reach a newer figure. The line says so, and it never claims the series
// is gone (only nowRetired may say "no longer publish").
describe("nowRequestFailed copy (issue #339, X3)", () => {
  it("gives the failed-request line its exact text", () => {
    expect(REVEAL_COPY.nowRequestFailed).toBe(
      "No newer figure could be reached for this series.",
    );
  });

  it("no longer carries the retired 'Check your connection and reload' line", () => {
    const all = JSON.stringify(REVEAL_COPY);
    expect(all).not.toContain("Check your connection and reload the page");
    expect("nowUnavailableFetch" in REVEAL_COPY).toBe(false);
  });

  it("does not say the series is gone", () => {
    expect(REVEAL_COPY.nowRequestFailed).not.toMatch(/no longer publish/i);
  });
});

// Receipt copy for the display precision and the as-published line (P5.2, P5.3).
describe("receipt precision copy (P5.2, P5.3)", () => {
  it("names the sealed value and unit in the As published line", () => {
    expect(REVEAL_COPY.asPublished).toContain("{value}");
    expect(REVEAL_COPY.asPublished).toContain("{unit}");
  });

  it("says in one line that the card's values are rounded for display", () => {
    expect(REVEAL_COPY.roundedNote).not.toContain("\n");
    expect(REVEAL_COPY.roundedNote).toMatch(/rounded for display/);
  });
});
