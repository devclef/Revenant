import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LiveLockNote } from "./LiveLockNote";
import { LIVE_COPY } from "./copy";

/**
 * The lock note after stage 3 of a live reveal (spec 06, R18.6): its text, its
 * link target, the comparison line only with official figures, and the absence
 * of any wording about whether numbers changed.
 */

function render(hasOfficialFigures = false): string {
  return renderToStaticMarkup(createElement(LiveLockNote, { hasOfficialFigures }));
}

describe("LiveLockNote (R18.6)", () => {
  it("shows the lock note text from LIVE_COPY", () => {
    const html = render();
    expect(html).toContain(LIVE_COPY.lockNote);
    expect(LIVE_COPY.lockNote).toBe("This letter was locked for 30 seconds.");
  });

  it("shows the comparison line only when the letter holds official figures", () => {
    expect(render(false)).not.toContain(LIVE_COPY.lockNoteComparison);
    expect(render(true)).toContain(LIVE_COPY.lockNoteComparison);
    expect(LIVE_COPY.lockNoteComparison).toBe(
      "For a longer comparison, open a persona letter.",
    );
  });

  it("links to /demo with the link text from LIVE_COPY, with or without figures", () => {
    for (const figures of [false, true]) {
      const html = render(figures);
      expect(html).toMatch(/<a[^>]*href="\/demo"[^>]*>/);
      expect(html).toContain(LIVE_COPY.lockNoteLink);
    }
    expect(LIVE_COPY.lockNoteLink).toBe("Open a persona letter");
  });

  it("says nothing about whether any number changed", () => {
    const text = render().replace(/<[^>]+>/g, " ").toLowerCase();
    const changeWords = [
      "chang",
      "rose",
      "rise",
      "fell",
      "fall",
      "drop",
      "increase",
      "decrease",
      "went up",
      "went down",
      "same",
      "different",
      "higher",
      "lower",
    ];
    for (const word of changeWords) {
      expect(text, `change wording "${word}"`).not.toContain(word);
    }
  });

  it("carries no exclamation mark", () => {
    expect(render()).not.toContain("!");
  });
});
