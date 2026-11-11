import { describe, expect, it } from "vitest";

import { LIVE_COPY, promptStarters } from "./copy";

/**
 * Plain string checks on LIVE_COPY, following the rules in
 * src/components/demo/copy.test.ts: tone.md (no exclamation mark, no sentence
 * over 25 words, no cliché) and the copy test in design.md.
 */

const ENTRIES = Object.entries(LIVE_COPY) as ReadonlyArray<
  readonly [keyof typeof LIVE_COPY, string]
>;

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
 * promptStarters: the three opening sentences on the Write step. Checked for
 * shape only here; the neutrality copy test is done by reading the strings.
 */
describe("promptStarters", () => {
  it("has exactly three strings", () => {
    expect(promptStarters).toHaveLength(3);
  });

  it("has no digits in any string", () => {
    for (const starter of promptStarters) {
      expect(starter, `"${starter}" contains a digit`).not.toMatch(/\d/);
    }
  });

  it("has a non-empty string with no exclamation mark in each entry", () => {
    for (const starter of promptStarters) {
      expect(starter.trim().length, `"${starter}" is empty`).toBeGreaterThan(0);
      expect(starter, `"${starter}" contains "!"`).not.toContain("!");
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
