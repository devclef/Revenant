// Feature: 10-own-questions, C5.5 and C5.8 (exact copy for the sample answers).
//
// The Sample_Note and the Sample_Label are checked word for word. Neither may
// call an answer right, close, near, wrong, off or accurate (C5.9).

import { describe, expect, it } from "vitest";

import { REVEAL_COPY } from "./copy";

describe("sample answer copy (C5.5, C5.8, C5.9)", () => {
  it("uses the exact Sample_Note wording", () => {
    expect(REVEAL_COPY.sampleNote).toBe(
      "A sample answer is filled in. Change it if you remember differently.",
    );
  });

  it("uses the exact Sample_Label text, with its leading dot", () => {
    expect(REVEAL_COPY.sampleLabel).toBe("· sample answer");
  });

  it.each(["sampleNote", "sampleLabel"] as const)(
    "%s never grades an answer and has no exclamation mark",
    (key) => {
      const text = REVEAL_COPY[key].toLowerCase();
      expect(text).not.toContain("!");
      for (const word of [
        "right",
        "close",
        "near",
        "wrong",
        "off",
        "accurate",
      ]) {
        expect(text.split(/[^a-z]+/)).not.toContain(word);
      }
    },
  );
});
