// Feature: 09-demo-polish (landing copy tone check)
//
// Every string in landing/copy.ts passes the tone.md and neutrality.md checks.
// The ritual and seal rows come from Brand_Copy and are checked there too.

import { describe, expect, it } from "vitest";

import { collectStrings, toneProblems } from "@/components/copy-tone";

import { LANDING_COPY, LANDING_SECTION_COPY } from "./copy";

describe("landing copy tone and neutrality", () => {
  const strings = collectStrings({ LANDING_COPY, LANDING_SECTION_COPY });

  it("has strings to check", () => {
    expect(strings.length).toBeGreaterThan(0);
  });

  it("passes the tone and neutrality checks", () => {
    for (const text of strings) {
      expect(toneProblems(text), text).toEqual([]);
    }
  });
});
