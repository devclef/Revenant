// Letter-text checks, letter-file existence, and the recall-subject no-leak
// check (design.md "Persona_List", R1.6, R1.8, R1.10, R2.4).
//
// Three groups of tests:
//
//   1. Every persona's letter file exists at content/personas/<letter_path>,
//      resolved from the repository root, and passes checkLetterText (returns
//      the empty list). This is the ONLY persona module allowed to use node:fs
//      and to read the .txt letter files — the loader (index.ts) and schema
//      stay pure so the web bundle never touches the filesystem.
//
//   2. checkLetterText accepts a Letter_Price_Line phrase only when it matches
//      the expected prices exactly (P1), and rejects a digit, currency symbol
//      or currency word outside those phrases, plus each election/party term
//      at a word start, with a problem message that names the persona key and
//      (for term matches) the matched term.
//
//   3. No persona recall_subject leaks a DEMO_FIGURES string: for every series
//      in DEMO_FIGURES we gather each figure's value and period and the series'
//      source and series_id, then assert none of those strings appears in any
//      recall_subject (R2.4, so a question can never hint at the sealed answer).

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { DEMO_FIGURES } from "@/lib/figures/demo";

import { PERSONAS } from "./index";
import { checkLetterText } from "./letter-checks";
import { expectedPrices } from "./price-lines";
import { CURRENCY_WORDS, ELECTION_PARTY_TERMS } from "./banned-terms";

// This test file lives at src/lib/personas/, so the repository root is four
// directories up. Letter paths are resolved from content/personas/ there,
// exactly as design.md requires ("resolves content/personas/${letter_path}
// from the repo root"), independent of the working directory.
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");

function readLetter(letterPath: string): string {
  const full = resolve(repoRoot, "content", "personas", letterPath);
  return readFileSync(full, "utf8");
}

// --- 1. Letter files exist and pass checkLetterText --------------------------

describe("persona letter files", () => {
  it("has at least one persona to check", () => {
    expect(PERSONAS.length).toBeGreaterThanOrEqual(1);
  });

  for (const persona of PERSONAS) {
    describe(`persona "${persona.key}"`, () => {
      const full = resolve(
        repoRoot,
        "content",
        "personas",
        persona.letter_path,
      );

      it(`has a letter file at content/personas/${persona.letter_path}`, () => {
        expect(existsSync(full)).toBe(true);
      });

      it("passes checkLetterText with no problems", () => {
        const text = readLetter(persona.letter_path);
        expect(
          checkLetterText(persona.key, text, expectedPrices(persona)),
        ).toEqual([]);
      });
    });
  }
});

// --- 2. checkLetterText rejects banned content -------------------------------

// A clean base sentence: no digit, no currency symbol or word, and no election
// or party term at a word start. Banned content is injected into a copy of it
// so each case fails on exactly the thing it injects.
const CLEAN_BASE =
  "It is a quiet evening and the windows are open for the first time.";

const KEY = "us-maya";
const NO_PRICES: readonly string[] = [];

describe("checkLetterText — valid text", () => {
  it("returns an empty list for clean text", () => {
    expect(checkLetterText(KEY, CLEAN_BASE, NO_PRICES)).toEqual([]);
  });

  it("names the persona key in every problem it reports", () => {
    // Any problem message is prefixed with `persona "<key>": letter_text`.
    const problems = checkLetterText(KEY, "cost 5 dollars", NO_PRICES);
    expect(problems.length).toBeGreaterThan(0);
    for (const problem of problems) {
      expect(problem).toContain(`persona "${KEY}": letter_text`);
    }
  });

  it("flags whitespace-only and empty text", () => {
    expect(checkLetterText(KEY, "   \n\t ", NO_PRICES).length).toBeGreaterThan(0);
    expect(checkLetterText(KEY, "", NO_PRICES).length).toBeGreaterThan(0);
  });
});

// The spec 03 R1.8 digit and currency-symbol cases are retired and replaced by
// P1 (Property 21). A digit or currency symbol is now allowed only inside a
// Letter_Price_Line, so those cases are tested through the price phrases here.

describe("checkLetterText — price lines (P1)", () => {
  it("accepts a dollar price phrase that matches the expected price", () => {
    expect(
      checkLetterText(KEY, "The radio said about $3.64 a gallon.", ["3.64"]),
    ).toEqual([]);
  });

  it("accepts a euro price phrase that matches the expected price", () => {
    expect(
      checkLetterText("eu-tomas", "Petrol was about €1.79 a litre.", ["1.79"]),
    ).toEqual([]);
  });

  it("accepts a letter with no tracked figures and no digits", () => {
    expect(checkLetterText(KEY, CLEAN_BASE, [])).toEqual([]);
  });

  it("names the found and expected prices when a phrase differs", () => {
    const problems = checkLetterText(KEY, "about $3.65 a gallon", ["3.64"]);
    expect(problems).toContainEqual(
      `persona "${KEY}": letter_text: price lines ["3.65"] do not match expected ["3.64"]`,
    );
  });

  it("rejects a tracked figure that has no price phrase", () => {
    const problems = checkLetterText(KEY, "No prices today.", ["3.64"]);
    expect(problems).toContainEqual(
      `persona "${KEY}": letter_text: price lines [] do not match expected ["3.64"]`,
    );
  });

  it("rejects a tracked figure stated twice", () => {
    const problems = checkLetterText(
      KEY,
      "about $3.64 here and about $3.64 again",
      ["3.64"],
    );
    expect(problems).toContainEqual(
      `persona "${KEY}": letter_text: price lines ["3.64","3.64"] do not match expected ["3.64"]`,
    );
  });

  it("rejects a digit outside a price phrase", () => {
    const problems = checkLetterText(
      KEY,
      "about $3.64 a gallon, and 5 cars",
      ["3.64"],
    );
    expect(problems).toContainEqual(
      `persona "${KEY}": letter_text: contains digit "5"`,
    );
  });

  it("rejects a price with a third decimal, which is not a phrase", () => {
    const problems = checkLetterText(KEY, "about $3.641 a gallon", ["3.64"]);
    expect(problems).toContainEqual(
      `persona "${KEY}": letter_text: contains digit "3"`,
    );
  });

  it("rejects a dollar sign outside a price phrase", () => {
    const problems = checkLetterText(KEY, "It cost $ today, about $3.64", [
      "3.64",
    ]);
    expect(problems).toContainEqual(
      `persona "${KEY}": letter_text: contains currency symbol "$"`,
    );
  });

  it("rejects a pound sign, which no price phrase may hold", () => {
    const problems = checkLetterText(KEY, "about £3.64 a gallon", ["3.64"]);
    expect(problems).toContainEqual(
      `persona "${KEY}": letter_text: contains currency symbol "£"`,
    );
  });

  it("rejects a currency word outside a price phrase", () => {
    const problems = checkLetterText(
      KEY,
      "about $3.64 a gallon, and two dollars more",
      ["3.64"],
    );
    expect(problems).toContainEqual(
      `persona "${KEY}": letter_text: contains currency word "dollars"`,
    );
  });
});

describe("checkLetterText — currency words (R1.8)", () => {
  // One concrete, whole-word instance per CURRENCY_WORDS source fragment. Each
  // fragment is a bare regex alternation; these literals all match it and are
  // real words a letter might contain.
  const examples: Record<string, string> = {
    "dollars?": "dollars",
    "cents?": "cents",
    "euros?": "euros",
    krona: "krona",
    kronor: "kronor",
    kr: "kr",
    usd: "USD",
    eur: "EUR",
    sek: "SEK",
  };

  it("has an example for every currency-word fragment", () => {
    expect(Object.keys(examples).sort()).toEqual([...CURRENCY_WORDS].sort());
  });

  for (const [fragment, word] of Object.entries(examples)) {
    it(`rejects the currency word "${word}" (fragment ${fragment})`, () => {
      const problems = checkLetterText(KEY, `I paid in ${word} today.`, NO_PRICES);
      // The matched word is reported as written in the text.
      expect(problems).toContainEqual(
        `persona "${KEY}": letter_text: contains currency word "${word}"`,
      );
    });
  }
});

describe("checkLetterText — election and party terms at a word start (R1.10)", () => {
  for (const term of ELECTION_PARTY_TERMS) {
    it(`rejects "${term}" at the start of a word and names it`, () => {
      // Place the term at a word boundary so it matches as a word start.
      const problems = checkLetterText(KEY, `We talked about the ${term} today.`, NO_PRICES);
      expect(problems).toContainEqual(
        `persona "${KEY}": letter_text: contains political term "${term}"`,
      );
    });

    it(`rejects "${term}" in mixed case`, () => {
      const mixed = term.charAt(0).toUpperCase() + term.slice(1);
      const problems = checkLetterText(KEY, `A ${mixed} came up in passing.`, NO_PRICES);
      // The term is reported as written (here, capitalised).
      expect(problems).toContainEqual(
        `persona "${KEY}": letter_text: contains political term "${mixed}"`,
      );
    });
  }

  it("does not flag a term embedded inside another word", () => {
    // "devote" contains "vote" but not at a word start; "apolicy" contains
    // "policy" mid-word. Neither should match (R1.10 is word-start only).
    expect(checkLetterText(KEY, "I devote my evenings to reading.", NO_PRICES)).toEqual(
      [],
    );
    expect(checkLetterText(KEY, "An apolicy sort of day, nothing planned.", NO_PRICES)).toEqual(
      [],
    );
  });
});

// --- 3. recall_subject leaks no DEMO_FIGURES string (R2.4) -------------------

describe("recall_subject contains no DEMO_FIGURES string", () => {
  // Gather every value, period, source and series_id string from DEMO_FIGURES.
  const forbidden = new Set<string>();
  for (const [, series] of DEMO_FIGURES.series) {
    forbidden.add(series.metric.source);
    forbidden.add(series.metric.series_id);
    for (const figure of series.figures) {
      forbidden.add(figure.value);
      forbidden.add(figure.period);
    }
  }

  it("gathered a non-empty set of strings to check against", () => {
    expect(forbidden.size).toBeGreaterThan(0);
  });

  for (const persona of PERSONAS) {
    for (let i = 0; i < persona.metrics.length; i++) {
      const metric = persona.metrics[i];
      it(`persona "${persona.key}" metrics[${i}] subject leaks nothing`, () => {
        const subject = metric.recall_subject.toLowerCase();
        for (const needle of forbidden) {
          expect(
            subject.includes(needle.toLowerCase()),
            `recall_subject "${metric.recall_subject}" contains DEMO_FIGURES string "${needle}"`,
          ).toBe(false);
        }
      });
    }
  }
});
