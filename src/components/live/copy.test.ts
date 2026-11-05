import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "./copy";

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
