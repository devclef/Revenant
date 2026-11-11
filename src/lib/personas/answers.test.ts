// Tests for the answer checks (letter-checks.ts checkAnswerText) and the shape
// and length rules for content/personas/letters/answers.json (answers.ts).
//
// The real answers.json is read from disk here, the same way letter-checks.test.ts
// reads letter files. The module under test (answers.ts) stays free of I/O.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { validatePersonaAnswers, PERSONAS } from "./index";
import { checkAnswerText } from "./letter-checks";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const ANSWERS_PATH = resolve(
  repoRoot,
  "content",
  "personas",
  "letters",
  "answers.json",
);

const realAnswers: unknown = JSON.parse(readFileSync(ANSWERS_PATH, "utf8"));

const priya = PERSONAS.find((p) => p.key === "us-priya");
if (priya === undefined) {
  throw new Error("test setup: us-priya is missing from PERSONAS");
}
const maya = PERSONAS.find((p) => p.key === "us-maya");
if (maya === undefined) {
  throw new Error("test setup: us-maya is missing from PERSONAS");
}

describe("answers.json", () => {
  it("passes validatePersonaAnswers against the real persona list", () => {
    expect(validatePersonaAnswers(realAnswers, PERSONAS)).toEqual([]);
  });

  it("holds one answer per author question for us-priya", () => {
    const entries = realAnswers as Record<string, string[]>;
    expect(entries["us-priya"]).toHaveLength(
      priya.author_questions?.length ?? 0,
    );
  });
});

describe("validatePersonaAnswers", () => {
  const valid = {
    "us-priya": [
      "I was looking forward to the trip to the coast.",
      "I was worried about the morning shift.",
    ],
  };

  it("accepts a valid answer set", () => {
    expect(validatePersonaAnswers(valid, PERSONAS)).toEqual([]);
  });

  it("rejects an answer count that does not match the question count", () => {
    const short = { "us-priya": ["Only one answer."] };
    const problems = validatePersonaAnswers(short, PERSONAS);
    expect(problems).toContain('persona "us-priya": 1 answers for 2 questions');
  });

  it("rejects a missing entry for a persona that has questions", () => {
    const problems = validatePersonaAnswers({}, PERSONAS);
    expect(problems).toContain(
      'persona "us-priya": answers must be a list with one answer per question',
    );
  });

  it("rejects an empty answer", () => {
    const problems = validatePersonaAnswers(
      { "us-priya": ["", "Fine."] },
      PERSONAS,
    );
    expect(
      problems.some((p) => p.includes("answer 1: must be 1-500 code points")),
    ).toBe(true);
  });

  it("rejects an answer over 500 code points", () => {
    const tooLong = { "us-priya": ["a".repeat(501), "Fine."] };
    const problems = validatePersonaAnswers(tooLong, PERSONAS);
    expect(
      problems.some((p) => p.includes("answer 1: must be 1-500 code points")),
    ).toBe(true);
  });

  it("counts an astral character once, so 500 of them are allowed", () => {
    // U+1F56F (candle) is one code point but two UTF-16 units.
    const exactly500 = { "us-priya": ["\u{1F56F}".repeat(500), "Fine."] };
    const problems = validatePersonaAnswers(exactly500, PERSONAS);
    expect(problems.some((p) => p.includes("code points"))).toBe(false);
  });

  it("rejects a whitespace-only answer", () => {
    const problems = validatePersonaAnswers(
      { "us-priya": ["   ", "Fine."] },
      PERSONAS,
    );
    expect(
      problems.some((p) => p.includes("answer 1: must not be whitespace-only")),
    ).toBe(true);
  });

  it("rejects a non-string answer", () => {
    const problems = validatePersonaAnswers(
      { "us-priya": [42, "Fine."] },
      PERSONAS,
    );
    expect(problems.some((p) => p.includes("answer 1: must be a string"))).toBe(
      true,
    );
  });

  it("rejects an entry for a persona with no questions", () => {
    const withMaya = { ...valid, "us-maya": ["Something."] };
    const problems = validatePersonaAnswers(withMaya, PERSONAS);
    expect(problems).toContain(
      'persona "us-maya": entry for a persona with no questions',
    );
    expect(maya.author_questions ?? []).toHaveLength(0);
  });

  it("rejects an entry for an unknown persona", () => {
    const problems = validatePersonaAnswers(
      { ...valid, "nobody-here": ["Hi."] },
      PERSONAS,
    );
    expect(problems).toContain(
      'persona "nobody-here": entry for an unknown persona',
    );
  });

  it("rejects a top-level value that is not an object", () => {
    expect(validatePersonaAnswers([], PERSONAS)).toEqual([
      "answers: must be an object keyed by persona key",
    ]);
    expect(validatePersonaAnswers(null, PERSONAS)).toEqual([
      "answers: must be an object keyed by persona key",
    ]);
  });

  it("runs checkAnswerText on each answer", () => {
    const problems = validatePersonaAnswers(
      { "us-priya": ["I paid 3 dollars.", "Fine."] },
      PERSONAS,
    );
    expect(problems.some((p) => p.includes("contains digit"))).toBe(true);
    expect(problems.some((p) => p.includes("currency word"))).toBe(true);
  });
});

describe("checkAnswerText", () => {
  it("accepts an ordinary first-person answer", () => {
    expect(
      checkAnswerText(
        "us-priya",
        0,
        "I was looking forward to the trip to the coast with my sister.",
      ),
    ).toEqual([]);
  });

  it("names the persona and the answer number in each problem", () => {
    const problems = checkAnswerText("us-priya", 1, "Three of them.3");
    expect(problems[0]).toBe(
      'persona "us-priya": answer 2: contains digit "3"',
    );
  });

  it("rejects digits", () => {
    expect(checkAnswerText("us-priya", 0, "There were 4 of us.")).toContain(
      'persona "us-priya": answer 1: contains digit "4"',
    );
  });

  it("rejects currency symbols", () => {
    for (const symbol of ["$", "€", "£"]) {
      const problems = checkAnswerText("us-priya", 0, `It cost ${symbol}`);
      expect(
        problems.some((p) => p.includes(`currency symbol "${symbol}"`)),
      ).toBe(true);
    }
  });

  it("rejects currency words, whole word and case-insensitive", () => {
    const problems = checkAnswerText("us-priya", 0, "It cost Dollars.");
    expect(problems.some((p) => p.includes('currency word "Dollars"'))).toBe(
      true,
    );
  });

  it("rejects an election or party term", () => {
    const problems = checkAnswerText("us-priya", 0, "Talk of the election.");
    expect(problems.some((p) => p.includes('political term "election"'))).toBe(
      true,
    );
  });

  it("rejects a party term inside an inflected word", () => {
    const problems = checkAnswerText("us-priya", 0, "Some parties met.");
    expect(problems.some((p) => p.includes('political term "parties"'))).toBe(
      true,
    );
  });

  it("rejects each verdict word", () => {
    for (const word of [
      "right",
      "wrong",
      "close",
      "near",
      "off",
      "accurate",
      "changed",
      "mistaken",
    ]) {
      const problems = checkAnswerText("us-priya", 0, `That was ${word}.`);
      expect(
        problems.some((p) => p.includes(`verdict word "${word}"`)),
        `expected "${word}" to be rejected`,
      ).toBe(true);
    }
  });

  it("does not reject a verdict word that is only part of another word", () => {
    expect(
      checkAnswerText("us-priya", 0, "The office was offered to me."),
    ).toEqual([]);
  });

  it("rejects a reference to the letter", () => {
    const problems = checkAnswerText(
      "us-priya",
      0,
      "This is what the letter asked me to say.",
    );
    expect(problems.some((p) => p.includes('with "letter"'))).toBe(true);
  });

  it("rejects remembering and forgetting, including inflected forms", () => {
    expect(
      checkAnswerText("us-priya", 0, "I remembered the coast."),
    ).toContainEqual(expect.stringContaining('with "remember"'));
    expect(
      checkAnswerText("us-priya", 0, "I was forgetting the bag."),
    ).toContainEqual(expect.stringContaining('with "forget"'));
  });

  it("rejects a reference to changing a mind", () => {
    const problems = checkAnswerText(
      "us-priya",
      0,
      "I keep changing her mind about it.",
    );
    expect(problems.some((p) => p.includes("refers to changing a mind"))).toBe(
      true,
    );
  });

  it("returns an empty list for an answer with no forbidden content", () => {
    expect(
      checkAnswerText(
        "us-priya",
        1,
        "I was worried about the morning shift and whether I would find time to read.",
      ),
    ).toEqual([]);
  });
});
