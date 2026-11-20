import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "./copy";
import {
  applyOccasion,
  DEFAULT_QUESTION,
  OCCASION_QUESTIONS_MAX,
  OCCASIONS,
  occasionPlaceholder,
  type OccasionDraft,
  type OccasionId,
} from "./occasions";

/**
 * Property 7: applying an Occasion never overwrites what was typed (L2.2, L2.10).
 * Property 8: Occasion text follows the copy rules, and the module stores
 * nothing (L2.3, L2.4, L2.5).
 */

/** A first-person word: "I", "me" or "my" (spec 15, R8.2). */
const FIRST_PERSON = /\b(I|me|my)\b/;
/** Second person and the sealing-day phrasing that R8.2 retires. */
const RETIRED_VOICE = /\b(you|your|when you wrote this|the day you sealed this)\b/i;
const FORBIDDEN_PHRASES = /\btoday\b|currently/i;
// Party, policy and election terms the copy must never use (neutrality.md).
const POLITICAL_TERMS =
  /\b(part(y|ies)|polic(y|ies)|election|elections|vote|voting|votes|candidate|candidates|ballot|government|parliament|minister|president|senate|congress|politic\w*|democrat\w*|republican\w*|conservative\w*|labour|labor|liberal\w*|socialist\w*)\b/i;
const DIGIT = /\d/;

function codePoints(text: string): number {
  return [...text].length;
}

function sentenceCount(text: string): number {
  return text.split(/[.!?](?:\s|$)/).filter((part) => part.trim() !== "")
    .length;
}

function draftFrom(
  text: string,
  questions: string[],
  applied: OccasionId,
): OccasionDraft {
  const occasion = OCCASIONS.find((o) => o.id === applied);
  if (!occasion) throw new Error(`no occasion ${applied}`);
  return {
    text,
    questions,
    occasion: applied,
    appliedStarter: occasion.starter,
    appliedQuestions: [...occasion.questions],
  };
}

describe("OCCASIONS table (Property 8, copy rules)", () => {
  it("lists the five Occasions in the order of L2.1", () => {
    expect(OCCASIONS.map((o) => o.label)).toEqual([
      "The year ahead",
      "Work",
      "Family",
      "A decision",
      "A blank page",
    ]);
  });

  it("labels the blank Occasion 'A blank page' on the pill too (spec 14, X1.4)", () => {
    expect(LIVE_COPY.occasionLabels.blank).toBe("A blank page");
    expect(OCCASIONS.find((o) => o.id === "blank")?.label).toBe(
      LIVE_COPY.occasionLabels.blank,
    );
  });

  it.each(OCCASIONS.map((o) => [o.label, o] as const))(
    "%s has one default question in the author's voice (spec 15, R8.1)",
    (_label, occasion) => {
      expect(occasion.questions).toHaveLength(1);
      expect(occasion.questions[0]).toMatch(FIRST_PERSON);
    },
  );

  it("starts a blank draft with DEFAULT_QUESTION, the blank page's own question", () => {
    expect(OCCASIONS.find((o) => o.id === "blank")?.questions).toEqual([
      DEFAULT_QUESTION,
    ]);
    expect(OCCASION_QUESTIONS_MAX).toBe(3);
  });

  it("gives every question 1 to 200 code points, first person and no banned term", () => {
    for (const occasion of OCCASIONS) {
      for (const question of occasion.questions) {
        const length = codePoints(question);
        expect(length, question).toBeGreaterThanOrEqual(1);
        expect(length, question).toBeLessThanOrEqual(200);
        expect(question, question).toMatch(FIRST_PERSON);
        expect(question, question).not.toMatch(RETIRED_VOICE);
        expect(question, question).not.toMatch(DIGIT);
        expect(question, question).not.toMatch(POLITICAL_TERMS);
        expect(question, question).not.toMatch(FORBIDDEN_PHRASES);
      }
    }
  });

  it("gives every starter one or two sentences and no digit, and leaves Blank empty", () => {
    for (const occasion of OCCASIONS) {
      if (occasion.id === "blank") {
        expect(occasion.starter).toBe("");
        continue;
      }
      expect(occasion.starter, occasion.label).not.toMatch(DIGIT);
      expect(occasion.starter, occasion.label).not.toMatch(POLITICAL_TERMS);
      expect(occasion.starter, occasion.label).not.toMatch(FORBIDDEN_PHRASES);
      const sentences = sentenceCount(occasion.starter);
      expect(sentences, occasion.label).toBeGreaterThanOrEqual(1);
      expect(sentences, occasion.label).toBeLessThanOrEqual(2);
    }
  });

  it("keeps the module free of storage, cookie, URL and network calls (L2.5)", () => {
    const source = readFileSync(resolve(__dirname, "occasions.ts"), "utf8");
    const forbidden = [
      "localStorage",
      "sessionStorage",
      "document.cookie",
      "indexedDB",
      "history.",
      "location",
      "URLSearchParams",
      "fetch(",
      "XMLHttpRequest",
    ];
    for (const token of forbidden) {
      expect(source, token).not.toContain(token);
    }
  });
});

describe("applyOccasion (Property 7, typed text is never overwritten)", () => {
  const typedTexts = [
    "",
    "   ",
    "My own words.",
    ...OCCASIONS.map((o) => o.starter),
  ];
  const typedRowPool = [
    "A row I typed myself.",
    "",
    "   ",
    DEFAULT_QUESTION,
    ...OCCASIONS.flatMap((o) => o.questions),
  ];
  const occasionIds = OCCASIONS.map((o) => o.id);

  it("keeps typed text, keeps typed rows, and keeps 1 to 3 rows with a default or typed first row", () => {
    let checked = 0;
    for (const text of typedTexts) {
      for (const first of typedRowPool) {
        for (const second of typedRowPool) {
          for (const previous of occasionIds) {
            const base = draftFrom(text, [first, second], previous);
            for (const next of occasionIds) {
              const result = applyOccasion(base, next);
              checked += 1;

              const starterUnedited =
                base.text.trim() === "" || base.text === base.appliedStarter;
              if (!starterUnedited) {
                expect(result.text).toBe(base.text);
              }

              expect(result.questions.length).toBeGreaterThanOrEqual(1);
              expect(result.questions.length).toBeLessThanOrEqual(
                OCCASION_QUESTIONS_MAX,
              );

              for (const [index, row] of base.questions.entries()) {
                const unedited =
                  row.trim() === "" || row === base.appliedQuestions[index];
                if (!unedited) {
                  expect(result.questions).toContain(row);
                }
              }

              const firstRow = result.questions[0];
              const nextDefault = OCCASIONS.find((o) => o.id === next)?.questions[0];
              const typedFirst =
                first.trim() !== "" && first !== base.appliedQuestions[0];
              expect(
                firstRow === nextDefault ||
                  (typedFirst && firstRow === first),
              ).toBe(true);

              expect(result.appliedStarter).toBe(
                OCCASIONS.find((o) => o.id === next)?.starter,
              );
              expect(result.appliedQuestions).toEqual(
                OCCASIONS.find((o) => o.id === next)?.questions,
              );
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  }, 60_000); // exhaustive loop; the default 5 s limit is hit under full-suite load

  it("replaces an untouched starter and untouched questions with the chosen Occasion", () => {
    const start = applyOccasion(
      {
        text: "",
        questions: [],
        occasion: "blank",
        appliedStarter: "",
        appliedQuestions: [],
      },
      "work",
    );
    const work = OCCASIONS.find((o) => o.id === "work");
    expect(start.text).toBe(work?.starter);
    expect(start.questions).toEqual(work?.questions);
  });

  it("does not replace a starter the visitor edited", () => {
    const work = OCCASIONS.find((o) => o.id === "work");
    const edited = draftFrom(
      `${work?.starter} And more.`,
      [DEFAULT_QUESTION],
      "work",
    );
    expect(applyOccasion(edited, "family").text).toBe(edited.text);
  });

  it("drops unedited rows that the chosen Occasion does not have (Blank keeps one question)", () => {
    const work = OCCASIONS.find((o) => o.id === "work");
    const draft = draftFrom("", [...(work?.questions ?? [])], "work");
    const blank = applyOccasion(draft, "blank");
    expect(blank.questions).toEqual([DEFAULT_QUESTION]);
    expect(blank.text).toBe("");
  });

  it("keeps a typed row and compacts the rest, never returning an empty list", () => {
    const typed = "What did the boiler quote say when I wrote this?";
    const work = OCCASIONS.find((o) => o.id === "work");
    const draft = draftFrom("", [DEFAULT_QUESTION, typed, ""], "work");
    const family = applyOccasion(draft, "family");
    expect(family.questions).toContain(typed);
    expect(family.questions.length).toBeLessThanOrEqual(OCCASION_QUESTIONS_MAX);
    expect(family.questions[0]).toBe(DEFAULT_QUESTION);
    expect(work?.questions[0]).toBe("What is on my mind about work right now?");
  });
});

/**
 * Spec 12, W2: one placeholder line per Occasion, at most 12 words, in the
 * tone and neutrality rules. A placeholder is display only.
 */
describe("Occasion placeholders (spec 12, W2)", () => {
  it("gives every Occasion a non-empty placeholder of at most 12 words", () => {
    for (const occasion of OCCASIONS) {
      const words = occasion.placeholder.trim().split(/\s+/);
      expect(occasion.placeholder, occasion.label).not.toBe("");
      expect(words.length, occasion.label).toBeLessThanOrEqual(12);
    }
  });

  // Placeholders are display text in the author's voice, not questions, so the
  // "today" rule for questions does not apply to them (spec 14, Decisions).
  const PLACEHOLDER_FORBIDDEN = /right now|\bcurrently\b/i;

  it("keeps each placeholder free of digits, banned terms and '!'", () => {
    for (const occasion of OCCASIONS) {
      expect(occasion.placeholder, occasion.label).not.toMatch(DIGIT);
      expect(occasion.placeholder, occasion.label).not.toMatch(POLITICAL_TERMS);
      expect(occasion.placeholder, occasion.label).not.toMatch(
        PLACEHOLDER_FORBIDDEN,
      );
      expect(occasion.placeholder, occasion.label).not.toContain("!");
    }
  });

  it("uses the placeholder lines from the spec 14 Decisions, word for word", () => {
    const decided: Record<OccasionId, string> = {
      year: "This is where my year stands as I write this…",
      work: "This is what my work looks like as I write this…",
      family: "This is how things are with the people closest to me…",
      decision: "This is the decision in front of me, and where I lean…",
      blank: "Write whatever you want to remember, in your own words…",
    };
    for (const occasion of OCCASIONS) {
      expect(occasion.placeholder, occasion.label).toBe(decided[occasion.id]);
    }
  });

  it("returns the placeholder of the chosen Occasion", () => {
    expect(occasionPlaceholder("work")).toBe(
      "This is what my work looks like as I write this…",
    );
    expect(occasionPlaceholder("family")).toBe(
      "This is how things are with the people closest to me…",
    );
    for (const occasion of OCCASIONS) {
      expect(occasionPlaceholder(occasion.id)).toBe(occasion.placeholder);
    }
  });

  it("leaves the starter and questions unchanged by the placeholder", () => {
    const work = OCCASIONS.find((o) => o.id === "work");
    expect(work?.starter).toBe(
      "This is what my work looks like as I write this, and what I am still working out.",
    );
    expect(work?.questions[0]).toBe("What is on my mind about work right now?");
  });
});
