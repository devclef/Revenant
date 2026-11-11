import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  applyOccasion,
  DEFAULT_QUESTION,
  OCCASION_QUESTIONS_MAX,
  OCCASIONS,
  type OccasionDraft,
  type OccasionId,
} from "./occasions";

/**
 * Property 7: applying an Occasion never overwrites what was typed (L2.2, L2.10).
 * Property 8: Occasion text follows the copy rules, and the module stores
 * nothing (L2.3, L2.4, L2.5).
 */

const SEALING_DAY_ANCHOR =
  /\bwriting\b|when you wrote this|the day you sealed this/i;
const FORBIDDEN_PHRASES = /right now|\btoday\b|currently|this year/i;
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
      "Blank",
    ]);
  });

  it.each(OCCASIONS.map((o) => [o.label, o] as const))(
    "%s starts with the default question and has at most three questions",
    (_label, occasion) => {
      expect(occasion.questions[0]).toBe(DEFAULT_QUESTION);
      expect(occasion.questions.length).toBeGreaterThanOrEqual(1);
      expect(occasion.questions.length).toBeLessThanOrEqual(
        OCCASION_QUESTIONS_MAX,
      );
    },
  );

  it("gives every question 1 to 200 code points, a sealing-day anchor and no banned term", () => {
    for (const occasion of OCCASIONS) {
      for (const question of occasion.questions) {
        const length = codePoints(question);
        expect(length, question).toBeGreaterThanOrEqual(1);
        expect(length, question).toBeLessThanOrEqual(200);
        expect(question, question).toMatch(SEALING_DAY_ANCHOR);
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
              const typedFirst =
                first.trim() !== "" && first !== base.appliedQuestions[0];
              expect(
                firstRow === DEFAULT_QUESTION ||
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
  }, 60_000);

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
    const typed = "What did the boiler quote say when you wrote this?";
    const work = OCCASIONS.find((o) => o.id === "work");
    const draft = draftFrom("", [DEFAULT_QUESTION, typed, ""], "work");
    const family = applyOccasion(draft, "family");
    expect(family.questions).toContain(typed);
    expect(family.questions.length).toBeLessThanOrEqual(OCCASION_QUESTIONS_MAX);
    expect(family.questions[0]).toBe(DEFAULT_QUESTION);
    expect(work?.questions[0]).toBe(DEFAULT_QUESTION);
  });
});
