// Feature: 19-real-sealing-stepper (REAL_COPY tone check)
//
// Every REAL_COPY string passes the tone.md and neutrality.md checks.

import { describe, expect, it } from "vitest";

import { collectStrings, toneProblems } from "@/components/copy-tone";

import { REAL_COPY } from "./copy";

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
    expect(REAL_COPY.figuresNoneAvailable).not.toMatch(/\bright\b/i);
    expect(strings).toContain(REAL_COPY.passkeyDeleteNote);
    expect(strings).toContain(REAL_COPY.clockBody);
    expect(strings).toContain(REAL_COPY.busyBody);
  });

  it("passes the tone and neutrality checks", () => {
    for (const text of strings) {
      expect(toneProblems(text), text).toEqual([]);
    }
  });
});
