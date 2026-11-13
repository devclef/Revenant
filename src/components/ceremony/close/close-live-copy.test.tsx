// Feature: 11-any-letter, issue #384 (X3): the live Close is honest and legible.
//
// Copy evidence for the live Close as a reader sees it. The tests render the
// real `Close` (kind "live") with and without an official figure and check
// the rendered text, not only the string constants.
//
// Copy files this change touched, named so the tone check is traceable:
// - src/components/live/copy.ts: LIVE_COPY.lockNote, lockNoteComparison and
//   lockNoteLink, the three strings the live Close renders.
// - src/components/reveal/copy.ts: REVEAL_COPY.lockNote and lockNoteLink were
//   removed; the live Close no longer reads them.
// The rule sources are .kiro/specs/11-any-letter/design.md (Copy) and
// src/test/retired-phrases.test.ts (RETIRED_PHRASES). This file repeats that
// phrase list because the list is not exported.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { REVEAL_COPY } from "@/components/reveal/copy";
import { LIVE_COPY } from "@/components/live/copy";

import { Close } from "./Close";

const LOCK_SENTENCE = "This letter was locked for 30 seconds.";

/** The visible text of the markup: every tag removed. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function renderLive(hasFigures?: boolean): string {
  return renderToStaticMarkup(
    createElement(
      Close,
      hasFigures === undefined
        ? { kind: "live" }
        : { kind: "live", hasFigures },
    ),
  );
}

function countOf(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/** Retired phrases from src/test/retired-phrases.test.ts that can reach this Close. */
const RETIRED_PHRASES: readonly string[] = [
  "your past self returns with the receipts",
  "rose-tinted",
  "pick up the letter",
  "check your connection and reload the page",
  "press and hold the seal to break it, or use the button below.",
  "seal the figures",
  "fuel prices from the us or the eu",
  "what's on your mind right now?",
];

const SCORING_WORDS_ALWAYS = ["accuracy", "score", "off by"];
const SCORING_WORDS_SCENE = ["close", "right", "wrong", "near"];
const MAX_SENTENCE_WORDS = 25;

describe("live Close: the once-only lock sentence", () => {
  it("shows 'This letter was locked for 30 seconds.' exactly once without figures", () => {
    expect(LIVE_COPY.lockNote).toBe(LOCK_SENTENCE);
    const text = textOf(renderLive(false));
    expect(countOf(text, LOCK_SENTENCE)).toBe(1);
  });

  it("shows 'This letter was locked for 30 seconds.' exactly once with figures", () => {
    const text = textOf(renderLive(true));
    expect(countOf(text, LOCK_SENTENCE)).toBe(1);
  });

  it("shows the comparison line only when the letter has official figures", () => {
    expect(textOf(renderLive(true))).toContain(LIVE_COPY.lockNoteComparison);
    expect(
      countOf(textOf(renderLive(true)), LIVE_COPY.lockNoteComparison),
    ).toBe(1);
    expect(textOf(renderLive(false))).not.toContain(
      LIVE_COPY.lockNoteComparison,
    );
    expect(textOf(renderLive())).not.toContain(LIVE_COPY.lockNoteComparison);
  });

  it("keeps the persona link to /demo with the same text in both cases", () => {
    for (const hasFigures of [false, true]) {
      const html = renderLive(hasFigures);
      expect(html).toMatch(/<a[^>]*href="\/demo"[^>]*>/);
      expect(textOf(html)).toContain(LIVE_COPY.lockNoteLink);
    }
  });
});

describe("live Close: the retired reveal keys are gone", () => {
  it("removes lockNote and lockNoteLink from REVEAL_COPY (src/components/reveal/copy.ts)", () => {
    expect("lockNote" in REVEAL_COPY).toBe(false);
    expect("lockNoteLink" in REVEAL_COPY).toBe(false);
  });
});

describe("live Close: copy rules (tone.md, neutrality.md)", () => {
  const cases: Array<[string, boolean | undefined]> = [
    ["without figures", false],
    ["with figures", true],
  ];

  for (const [label, hasFigures] of cases) {
    it(`has no exclamation mark ${label}`, () => {
      expect(renderLive(hasFigures)).not.toContain("!");
      expect(textOf(renderLive(hasFigures))).not.toContain("!");
    });

    it(`has no retired phrase ${label}`, () => {
      const text = textOf(renderLive(hasFigures)).toLowerCase();
      for (const phrase of RETIRED_PHRASES) {
        expect(text, `retired phrase "${phrase}"`).not.toContain(phrase);
      }
    });

    it(`has no scoring word ${label}`, () => {
      const text = textOf(renderLive(hasFigures));
      for (const word of [...SCORING_WORDS_ALWAYS, ...SCORING_WORDS_SCENE]) {
        const pattern = new RegExp(`\\b${word}\\b`, "i");
        expect(pattern.test(text), `scoring word "${word}"`).toBe(false);
      }
    });

    it(`has no sentence over ${MAX_SENTENCE_WORDS} words ${label}`, () => {
      const text = textOf(renderLive(hasFigures));
      for (const sentence of text.split(/[.?]\s*/)) {
        const words = sentence
          .trim()
          .split(/\s+/)
          .filter((w) => w.length > 0);
        expect(words.length, `"${sentence}"`).toBeLessThanOrEqual(
          MAX_SENTENCE_WORDS,
        );
      }
    });
  }

  it("names no change and grades no testimony in the figures case", () => {
    const text = textOf(renderLive(true)).toLowerCase();
    for (const word of [
      "changed",
      "rose",
      "fell",
      "higher",
      "lower",
      "accurate",
      "misremember",
    ]) {
      expect(text, `judgement wording "${word}"`).not.toContain(word);
    }
  });
});
