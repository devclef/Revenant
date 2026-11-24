// Feature: 19-real-sealing-stepper (REAL_COPY tone check)
//
// Every REAL_COPY string passes the tone.md and neutrality.md checks, except
// two owner-approved strings (design.md, "New copy for owner review") that
// use "right now". "right now" is a time phrase, but copy-tone.ts matches
// "right" as a whole word. Those two strings are exempt by name, and every
// other REAL_COPY string is still checked.

import { describe, expect, it } from "vitest";

import { collectStrings, toneProblems } from "@/components/copy-tone";

import { REAL_COPY } from "./copy";

/** Approved wording that contains "right now". Exempt by name only. */
const APPROVED_RIGHT_NOW: readonly string[] = [
  REAL_COPY.figuresNoneAvailable,
  REAL_COPY.busyBody,
];

describe("REAL_COPY tone and neutrality", () => {
  const strings = collectStrings({ REAL_COPY });

  it("has strings to check", () => {
    expect(strings.length).toBeGreaterThan(0);
  });

  it("includes the new Real_Mode strings", () => {
    expect(REAL_COPY.pressNeedsDate).toBe("Choose an opening date first.");
    expect(strings).toContain(REAL_COPY.stepOneHint);
    expect(strings).toContain(REAL_COPY.stepPasskeyMade);
    expect(strings).toContain(REAL_COPY.figuresNoneAvailable);
    expect(strings).toContain(REAL_COPY.passkeyDeleteNote);
    expect(strings).toContain(REAL_COPY.clockBody);
    expect(strings).toContain(REAL_COPY.busyBody);
  });

  it("exempts only the two approved 'right now' strings", () => {
    for (const text of APPROVED_RIGHT_NOW) {
      expect(text).toMatch(/\bright now\b/);
    }
    expect(strings.filter((text) => /\bright\b/i.test(text))).toEqual(
      APPROVED_RIGHT_NOW,
    );
  });

  it("passes the tone and neutrality checks", () => {
    for (const text of strings) {
      if (APPROVED_RIGHT_NOW.includes(text)) continue;
      expect(toneProblems(text), text).toEqual([]);
    }
  });
});
