// Feature: 09-demo-polish (landing hero, B1.2 to B1.4)
//
// Asserts each landing/copy.ts string exactly, as design.md "Copy" gives it.

import { describe, expect, it } from "vitest";

import { LANDING_COPY } from "./copy";

describe("LANDING_COPY", () => {
  it("has the primary call to action for one persona and for two or more", () => {
    expect(LANDING_COPY.primaryCtaOne).toBe("Open the demo letter");
    expect(LANDING_COPY.primaryCtaMany).toBe("Open the demo letters");
  });

  it("has the cost line with a minutes placeholder", () => {
    expect(LANDING_COPY.primaryCost).toBe(
      "About {minutes} minutes · no sign-up, no passkey",
    );
  });

  it("has the secondary call to action to the live demo", () => {
    expect(LANDING_COPY.secondaryCta).toBe(
      "Seal your own. It opens 30 seconds after you seal it.",
    );
  });

  it("has no exclamation mark", () => {
    for (const text of Object.values(LANDING_COPY)) {
      expect(text).not.toContain("!");
    }
  });
});

describe("LANDING_COPY scoring words (R24.6, R24.7)", () => {
  // Scoring_Words_Always and Scoring_Words_Scene, as scene/copy.test.ts checks them.
  const banned = ["accuracy", "score", "off by", "close", "right", "wrong"];

  it("holds no scoring word in any landing string", () => {
    for (const text of Object.values(LANDING_COPY)) {
      for (const word of banned) {
        expect(text.toLowerCase()).not.toContain(word);
      }
    }
  });
});
