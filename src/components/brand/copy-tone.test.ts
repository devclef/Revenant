// Feature: 09-demo-polish (Brand_Copy tone check)
//
// Every string in brand/copy.ts passes the tone.md and neutrality.md checks.

import { describe, expect, it } from "vitest";

import { collectStrings, toneProblems } from "@/components/copy-tone";

import { BRAND_COPY } from "./copy";

describe("BRAND_COPY tone and neutrality", () => {
  const strings = collectStrings(BRAND_COPY);

  it("has strings to check", () => {
    expect(strings.length).toBeGreaterThan(0);
  });

  it("passes the tone and neutrality checks", () => {
    for (const text of strings) {
      expect(toneProblems(text), text).toEqual([]);
    }
  });
});
