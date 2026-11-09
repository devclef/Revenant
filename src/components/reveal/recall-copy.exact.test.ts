// Feature: 10-own-questions (C4, C7.2)
//
// Asserts each Testify and recall copy string exactly, so a reword is a
// deliberate change to this file and not a silent drift.

import { describe, expect, it } from "vitest";

import { REVEAL_COPY } from "./copy";

describe("recall and Testify copy, exact strings", () => {
  it("memoryLine (C4.2)", () => {
    expect(REVEAL_COPY.memoryLine).toBe(
      "You lived through {month} too. Answer from your own memory of it.",
    );
  });

  it("textCount (C4.5)", () => {
    expect(REVEAL_COPY.textCount).toBe("{count} of 1,000 characters");
  });

  it("textAnswerInvalid (C4.6)", () => {
    expect(REVEAL_COPY.textAnswerInvalid).toBe(
      "Write an answer of up to 1,000 characters, or choose No answer.",
    );
  });

  it("noAnswer (C7.2: the No answer control)", () => {
    expect(REVEAL_COPY.noAnswer).toBe("No answer");
  });
});
