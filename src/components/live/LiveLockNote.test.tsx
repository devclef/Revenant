import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LiveLockNote } from "./LiveLockNote";
import { LIVE_COPY } from "./copy";

/**
 * The lock note in the live Close (spec 06, R18.6; issue #384 X3): the once-only
 * lock sentence, the comparison line only with official figures, the persona
 * link to /demo, and copy that carries no exclamation mark and no judgement of
 * the testimony.
 */

function render(hasOfficialFigures = false): string {
  return renderToStaticMarkup(createElement(LiveLockNote, { hasOfficialFigures }));
}

function countOf(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("LiveLockNote: the lock sentence", () => {
  it("renders the sentence 'This letter was locked for 30 seconds.' exactly once", () => {
    expect(LIVE_COPY.lockNote).toBe("This letter was locked for 30 seconds.");
    for (const figures of [false, true]) {
      const html = render(figures);
      expect(countOf(html, "This letter was locked for 30 seconds.")).toBe(1);
    }
  });
});

describe("LiveLockNote: the comparison line", () => {
  it("renders LIVE_COPY.lockNoteComparison when the letter has official figures", () => {
    const html = render(true);
    expect(LIVE_COPY.lockNoteComparison).toBe("For a longer comparison, open a persona letter.");
    expect(countOf(html, LIVE_COPY.lockNoteComparison)).toBe(1);
  });

  it("omits the comparison line when the letter has no official figures", () => {
    expect(render(false)).not.toContain(LIVE_COPY.lockNoteComparison);
    expect(render()).not.toContain(LIVE_COPY.lockNoteComparison);
  });
});

describe("LiveLockNote: the persona link", () => {
  it("links to /demo as a plain anchor with the LIVE_COPY link text, with or without figures", () => {
    expect(LIVE_COPY.lockNoteLink).toBe("Open a persona letter");
    for (const figures of [false, true]) {
      const html = render(figures);
      expect(html).toMatch(/<a[^>]*href="\/demo"[^>]*>/);
      expect(countOf(html, "<a ")).toBe(1);
      expect(html).toContain(LIVE_COPY.lockNoteLink);
    }
  });
});

describe("LiveLockNote: copy rules", () => {
  it("carries no exclamation mark", () => {
    for (const figures of [false, true]) {
      expect(render(figures)).not.toContain("!");
    }
  });

  it("says nothing about whether any number changed or about the testimony", () => {
    const text = render(true).replace(/<[^>]+>/g, " ").toLowerCase();
    const judgementWords = [
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
      "right",
      "wrong",
      "accurate",
      "close",
      "misremember",
    ];
    for (const word of judgementWords) {
      expect(text, `judgement wording "${word}"`).not.toContain(word);
    }
  });
});
