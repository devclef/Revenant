// Feature: 08-judge-polish (How_Page tone check)
//
// Every string in how/copy.ts passes the tone.md and neutrality.md checks.

import { describe, expect, it } from "vitest";

import { collectStrings, toneProblems } from "@/components/copy-tone";

import { HOW_COPY } from "./copy";

describe("HOW_COPY tone and neutrality", () => {
  const strings = collectStrings(HOW_COPY);

  it("has strings to check", () => {
    expect(strings.length).toBeGreaterThan(0);
  });

  it("passes the tone and neutrality checks", () => {
    for (const text of strings) {
      expect(toneProblems(text), text).toEqual([]);
    }
  });
});
