// Tests that the persona texts meet the rules they must satisfy: the extended
// banned terms (spec 18 R8), no exclamation marks, the plain-text rules, the
// season and month words (spec 18 R5.2, R6.1 to R6.3), the period words of each
// price line (spec 18 R5.6), two author questions, and two sealed answers and
// two recollections in order.
//
// The real letter files and answer files are read from disk, the same way
// answers.test.ts reads them. The checks under test are pure.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { DEMO_FIGURES } from "@/lib/figures/demo";
import { thenAndNow } from "@/lib/figures/then-now";

import { firstBannedTerm } from "./banned-terms";
import { PERSONAS, checkLetterText, validatePersonaAnswers } from "./index";
import { checkAnswerText } from "./letter-checks";
import { PRICE_RE, expectedPrices, weekOfMonthWords } from "./price-lines";
import { letterSeasonWord, textSeasonWord } from "./season-words";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const LETTERS_DIR = resolve(repoRoot, "content", "personas", "letters");

function readLetters(file: string): string {
  return readFileSync(resolve(LETTERS_DIR, file), "utf8");
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(resolve(LETTERS_DIR, file), "utf8"));
}

// Problems from checkLetterText that are about banned terms, exclamation marks
// or plain text. Price-line and currency problems are left to letter-prices and
// letter-checks tests.
const RULE_PROBLEM = /political term|exclamation mark|HTML tag|Markdown|link/;

const LETTERS: readonly { key: string; file: string }[] = [
  { key: "us-maya", file: "us-maya.txt" },
  { key: "eu-tomas", file: "eu-tomas.txt" },
  { key: "us-priya", file: "us-priya.txt" },
];

/**
 * The sentence that holds the price phrase starting at `index`. Sentences end
 * at a line break or at ". ", so a decimal point inside a price does not end
 * one. Returns the sentence with the text around it.
 */
function sentenceAt(text: string, index: number): string {
  const before = text.slice(0, index);
  const start = Math.max(before.lastIndexOf("\n"), before.lastIndexOf(". "));
  const after = text.slice(index);
  const endNewline = after.indexOf("\n");
  const endSpace = after.indexOf(". ");
  const candidates = [endNewline, endSpace].filter((i) => i >= 0);
  const end =
    candidates.length === 0 ? text.length : index + Math.min(...candidates);
  return text.slice(start + 1, end);
}

describe("persona letter texts", () => {
  for (const { key, file } of LETTERS) {
    const text = readLetters(file);
    const persona = PERSONAS.find((p) => p.key === key);
    if (persona === undefined) {
      throw new Error(`test setup: ${key} is missing from PERSONAS`);
    }

    it(`${key} holds no election, party or public-event term`, () => {
      expect(firstBannedTerm(text)).toBeNull();
    });

    it(`${key} holds no exclamation mark`, () => {
      expect(text).not.toContain("!");
    });

    it(`${key} passes the plain-text rules`, () => {
      const problems = checkLetterText(key, text, expectedPrices(persona));
      expect(problems.filter((p) => RULE_PROBLEM.test(p))).toEqual([]);
    });

    it(`${key} names no month other than November and no season other than autumn, fall or winter`, () => {
      expect(letterSeasonWord(text)).toBeNull();
    });

    it(`${key} names each price's week in the sentence that states it`, () => {
      const matches = [...text.matchAll(PRICE_RE)];
      expect(matches).toHaveLength(persona.metrics.length);
      persona.metrics.forEach((metric, i) => {
        const { then } = thenAndNow(
          metric.metric_id,
          persona.written_as_of,
          DEMO_FIGURES,
        );
        if (!then.found) throw new Error("test expects a then-figure");
        const words = weekOfMonthWords(then.figure.period);
        const match = matches[i];
        expect(sentenceAt(text, match.index ?? 0)).toContain(words);
      });
    });
  }
});

describe("persona author questions and answers", () => {
  const priya = PERSONAS.find((p) => p.key === "us-priya");
  if (priya === undefined) {
    throw new Error("test setup: us-priya is missing from PERSONAS");
  }

  it("us-priya has two author questions", () => {
    expect(priya.author_questions).toHaveLength(2);
  });

  it("every intro line and author question names only November and autumn, fall or winter", () => {
    for (const persona of PERSONAS) {
      expect(textSeasonWord(persona.intro_line)).toBeNull();
    }
    for (const question of priya.author_questions ?? []) {
      expect(textSeasonWord(question)).toBeNull();
    }
  });

  it("the recollections (answers.json) hold one answer per question, in order", () => {
    const raw = readJson("answers.json");
    expect(validatePersonaAnswers(raw, PERSONAS, "recollection")).toEqual([]);
    const answers = (raw as Record<string, string[]>)["us-priya"];
    expect(answers).toHaveLength(2);
    answers?.forEach((text, index) => {
      expect(checkAnswerText("us-priya", index, text)).toEqual([]);
      expect(textSeasonWord(text)).toBeNull();
    });
  });

  it("the sealed answers (sealed-answers.json) hold one answer per question, in order", () => {
    const raw = readJson("sealed-answers.json");
    expect(validatePersonaAnswers(raw, PERSONAS, "sealed")).toEqual([]);
    const answers = (raw as Record<string, string[]>)["us-priya"];
    expect(answers).toHaveLength(2);
    answers?.forEach((text, index) => {
      expect(
        checkAnswerText("us-priya", index, text, { sealed: true }),
      ).toEqual([]);
      expect(textSeasonWord(text)).toBeNull();
    });
  });
});
