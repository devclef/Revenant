import { describe, expect, it } from "vitest";

import { REVEAL_COPY } from "./copy";

/**
 * Copy test for the Now_Figure (issue #202). A Now_Figure is the latest figure
 * from the Figures_API response, and its wording must not claim to be "today",
 * "current", "latest" or "live". The figure is the newest one revenant holds,
 * not a live reading, so these words would overstate it.
 *
 * Every Reveal string that is about a Now_Figure is listed here. A new string
 * about a Now_Figure must be added to this list.
 */

const NOW_FIGURE_KEYS = [
  "nowLoading",
  "nowUnavailableMissing",
  "nowRequestFailed",
  "labelRetrieved",
] as const;

const BANNED = ["today", "current", "latest", "live"] as const;

describe("Now_Figure copy (issue #202)", () => {
  for (const key of NOW_FIGURE_KEYS) {
    it(`${key} avoids today, current, latest and live`, () => {
      const value = REVEAL_COPY[key].toLowerCase();
      for (const word of BANNED) {
        expect(
          new RegExp(`\\b${word}\\b`).test(value),
          `${key} must not contain "${word}" -> "${REVEAL_COPY[key]}"`,
        ).toBe(false);
      }
    });
  }

  it("the Now_Figure meta line is period, region and retrieved date", () => {
    expect(REVEAL_COPY.labelRetrieved).toBe("retrieved {date}");
  });
});
