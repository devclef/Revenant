// Tests that today's persona texts meet the rules they already satisfy: the
// extended banned terms (spec 18 R8), no exclamation marks, the plain-text
// rules, two author questions, and two sealed answers and two recollections in
// order. Season-word and period-word assertions are left to task 11.2.
//
// The real letter files and answer files are read from disk, the same way
// answers.test.ts reads them. The checks under test are pure.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { firstBannedTerm } from "./banned-terms";
import { PERSONAS, checkLetterText, validatePersonaAnswers } from "./index";
import { checkAnswerText } from "./letter-checks";
import { expectedPrices } from "./price-lines";

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

  it("the recollections (answers.json) hold one answer per question, in order", () => {
    const raw = readJson("answers.json");
    expect(validatePersonaAnswers(raw, PERSONAS, "recollection")).toEqual([]);
    const answers = (raw as Record<string, string[]>)["us-priya"];
    expect(answers).toHaveLength(2);
    answers?.forEach((text, index) => {
      expect(checkAnswerText("us-priya", index, text)).toEqual([]);
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
    });
  });
});
