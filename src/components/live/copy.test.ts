import { describe, expect, it } from "vitest";

import { firstPoliticalTerm } from "@/lib/personas/banned-terms";

import { LIVE_COPY } from "./copy";
import { DEFAULT_QUESTION, OCCASIONS } from "./occasions";

/**
 * Plain string checks on LIVE_COPY, following the rules in
 * src/components/demo/copy.test.ts: tone.md (no exclamation mark, no sentence
 * over 25 words, no cliché) and the copy test in design.md.
 */

/** Every string in LIVE_COPY, nested objects flattened as `key.sub`. */
const ENTRIES: ReadonlyArray<readonly [string, string]> = Object.entries(
  LIVE_COPY,
).flatMap(([key, value]): Array<readonly [string, string]> =>
  typeof value === "string"
    ? [[key, value]]
    : Object.entries(value as Record<string, string>).map(
        ([sub, text]): readonly [string, string] => [`${key}.${sub}`, text],
      ),
);

const CLICHES = ["boo", "spook", "skull", "mwahaha", "blood", "gore"] as const;

const splitSentences = (value: string): string[] =>
  value
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

describe("LIVE_COPY", () => {
  it("describes the demo letter as sealed in the browser, not as a real sealed letter", () => {
    expect(LIVE_COPY.intro).toBe(
      "This letter is sealed in your browser with your own passkey. It is locked for 30 seconds only because this is a demo.",
    );
    expect(LIVE_COPY.intro).not.toContain("real sealed letter");
  });

  it("has no exclamation mark in any string", () => {
    for (const [key, value] of ENTRIES) {
      expect(value, `${key} contains "!"`).not.toContain("!");
    }
  });

  it("has no sentence over 25 words", () => {
    for (const [key, value] of ENTRIES) {
      for (const sentence of splitSentences(value)) {
        const words = sentence.split(/\s+/).length;
        expect(words, `${key}: "${sentence}"`).toBeLessThanOrEqual(25);
      }
    }
  });

  it("contains no tone.md cliché", () => {
    for (const [key, value] of ENTRIES) {
      const lower = value.toLowerCase();
      for (const cliche of CLICHES) {
        expect(lower.includes(cliche), `${key} contains "${cliche}"`).toBe(false);
      }
    }
  });

  it("keeps the lost-passkey warning plain, with no softening", () => {
    expect(LIVE_COPY.warning).toContain("can never be opened");
    expect(LIVE_COPY.warningLabel).toContain("can never be opened");
  });

  it("states the figure maximum as {max} and fills it with the offered count", () => {
    for (const key of ["figuresHint", "figuresTooMany"] as const) {
      expect(LIVE_COPY[key], key).toContain("{max}");
      const filled = LIVE_COPY[key].replace("{max}", "4");
      expect(filled, key).toContain("4");
      expect(filled, key).not.toContain("6");
    }
  });

  it("has the PRF_Hint copy, which says a backup key card may be needed", () => {
    expect(LIVE_COPY.prfHint).toContain("backup key card");
  });

  it("has the unavailable string that the page needs", () => {
    expect(LIVE_COPY.unavailable.length).toBeGreaterThan(0);
  });
});

/**
 * Claim checks for the wording corrected in the copy audit (issue #200). Each
 * check pins a claim the code makes true, so the old, untrue wording cannot
 * come back unnoticed.
 */
describe("LIVE_COPY claims with code behind them", () => {
  it("does not say a letter opens only with its backup key (a both seal also shows this)", () => {
    expect(LIVE_COPY.keyReminder).not.toContain("only with your backup key");
    expect(LIVE_COPY.keyReminder).toContain("backup key opens this letter after the opening date");
  });

  it("says a lost passkey is survivable only with a backup key, as the seal form offers one", () => {
    expect(LIVE_COPY.warning).toContain("unless you also keep its backup key");
    expect(LIVE_COPY.warningLabel).toContain("unless I keep its backup key");
  });

  it("does not claim the page keeps nothing (the backup key lives in memory only, and the link is the way back)", () => {
    expect(LIVE_COPY.keepLink).not.toContain("keeps nothing");
    expect(LIVE_COPY.keepLink).toContain("does not keep your key");
  });

  it("does not quote a browser menu label that the app does not control", () => {
    expect(LIVE_COPY.cannotLockNext1).not.toContain('"');
    expect(LIVE_COPY.cannotLockNext1).toContain("use a phone or tablet");
  });

  it("says no letter text was sent when the passkey fails, not that nothing was stored (the prepare route writes a draft row)", () => {
    expect(LIVE_COPY.cannotLockBody).not.toContain("nothing was stored");
    expect(LIVE_COPY.cannotLockBody).toContain(
      "none of its text was sent to Revenant",
    );
  });
});

/**
 * Occasion strings (spec 11, L2.1, L2.8). The exact copy, then every Occasion
 * string through the neutrality checks: no digit, no "!", no party, policy or
 * election term, and none of the time words the question rules forbid.
 */
describe("Occasion copy (spec 11, L2.1)", () => {
  it("has the exact legend and button labels", () => {
    expect(LIVE_COPY.occasionLegend).toBe("What is it about?");
    expect(LIVE_COPY.occasionLabels).toEqual({
      year: "The year ahead",
      work: "Work",
      family: "Family",
      decision: "A decision",
      blank: "Blank",
    });
  });

  it("keeps the answer-in-letter line and drops the retired starter keys", () => {
    expect(LIVE_COPY.answerInLetter).toBe(
      "Answer them in your letter too, in your own words.",
    );
    const retired = [
      "starterGroup",
      "questionStartersLabel",
    ] as const;
    for (const key of retired) {
      expect(LIVE_COPY, key).not.toHaveProperty(key);
    }
  });
});

const TIME_WORDS = ["right now", "today", "currently", "this year"] as const;

describe("Occasion_Table through firstPoliticalTerm (spec 11, L2.3, L2.4)", () => {
  const occasionTexts = OCCASIONS.flatMap((occasion) => [
    occasion.starter,
    ...occasion.questions,
  ]).filter((text) => text.length > 0);

  it("has the five Occasions in order", () => {
    expect(OCCASIONS.map((o) => o.label)).toEqual([
      "The year ahead",
      "Work",
      "Family",
      "A decision",
      "Blank",
    ]);
  });

  it("puts the default question first in every Occasion", () => {
    for (const occasion of OCCASIONS) {
      expect(occasion.questions[0], occasion.id).toBe(DEFAULT_QUESTION);
    }
  });

  for (const text of occasionTexts) {
    it(`"${text}" has no digit, no "!", no political term and no time word`, () => {
      expect(text, "digit").not.toMatch(/\d/);
      expect(text, "!").not.toContain("!");
      expect(firstPoliticalTerm(text)).toBeNull();
      for (const word of TIME_WORDS) {
        expect(text.toLowerCase(), word).not.toContain(word);
      }
    });
  }
});

describe("LIVE_COPY has no Question_Starter or Prompt_Starter text", () => {
  it("contains none of the retired starter sentences", () => {
    const retired = [
      "Right now, the thing on my mind is",
      "What was on your mind most days?",
      "What were you looking forward to?",
    ];
    const values = Object.values(LIVE_COPY).map((value) =>
      typeof value === "string" ? value : JSON.stringify(value),
    );
    for (const sentence of retired) {
      expect(values.some((value) => value.includes(sentence)), sentence).toBe(
        false,
      );
    }
  });
});

// Spec 11, L1.2 and L1.4: the block message and the disclosure copy, exactly.
describe("LIVE_COPY for the receipts and the block message (spec 11)", () => {
  it("has the exact nothing-to-testify block message", () => {
    expect(LIVE_COPY.nothingToTestify).toBe(
      "Add a question or a receipt, so there is something to answer when the letter opens.",
    );
  });

  it("has the receipts summary and the one-sentence explain line", () => {
    expect(LIVE_COPY.receiptsSummary).toBe("Add a receipt");
    expect(LIVE_COPY.receiptsExplain).toBe(
      "A receipt is a number sealed with its source and date, so you can compare it when the letter opens.",
    );
  });
});

describe("LIVE_COPY rehearsal line (spec 11, L4.1)", () => {
  it("reads exactly as the ticket says", () => {
    expect(LIVE_COPY.rehearsalLine).toBe(
      "This is a rehearsal. A real letter stays sealed for months. This one opens in 30 seconds.",
    );
  });

  it("carries no exclamation mark and no time word", () => {
    expect(LIVE_COPY.rehearsalLine).not.toContain("!");
    for (const word of TIME_WORDS) {
      expect(LIVE_COPY.rehearsalLine.toLowerCase()).not.toContain(word);
    }
  });
});
