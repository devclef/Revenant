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
//   2. checkLetterText rejects a digit, each currency symbol ($ € £), each
//      currency word, and each election/party term at a word start, with a
//      problem message that names the persona key and (for term matches) the
//      matched term.
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
        expect(checkLetterText(persona.key, text)).toEqual([]);
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

describe("checkLetterText — valid text", () => {
  it("returns an empty list for clean text", () => {
    expect(checkLetterText(KEY, CLEAN_BASE)).toEqual([]);
  });

  it("names the persona key in every problem it reports", () => {
    // Any problem message is prefixed with `persona "<key>": letter_text`.
    const problems = checkLetterText(KEY, "cost 5 dollars");
    expect(problems.length).toBeGreaterThan(0);
    for (const problem of problems) {
      expect(problem).toContain(`persona "${KEY}": letter_text`);
    }
  });

  it("flags whitespace-only and empty text", () => {
    expect(checkLetterText(KEY, "   \n\t ").length).toBeGreaterThan(0);
    expect(checkLetterText(KEY, "").length).toBeGreaterThan(0);
  });
});

describe("checkLetterText — digits (R1.8)", () => {
  for (const digit of "0123456789") {
    it(`rejects the digit "${digit}"`, () => {
      const problems = checkLetterText(KEY, `The tank was ${digit} full.`);
      expect(problems).toContainEqual(
        `persona "${KEY}": letter_text: contains digit "${digit}"`,
      );
    });
  }
});

describe("checkLetterText — currency symbols (R1.8)", () => {
  for (const symbol of ["$", "€", "£"] as const) {
    it(`rejects the currency symbol "${symbol}"`, () => {
      const problems = checkLetterText(KEY, `It cost ${symbol} to fill up.`);
      expect(problems).toContainEqual(
        `persona "${KEY}": letter_text: contains currency symbol "${symbol}"`,
      );
    });
  }
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
      const problems = checkLetterText(KEY, `I paid in ${word} today.`);
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
      const problems = checkLetterText(KEY, `We talked about the ${term} today.`);
      expect(problems).toContainEqual(
        `persona "${KEY}": letter_text: contains political term "${term}"`,
      );
    });

    it(`rejects "${term}" in mixed case`, () => {
      const mixed = term.charAt(0).toUpperCase() + term.slice(1);
      const problems = checkLetterText(KEY, `A ${mixed} came up in passing.`);
      // The term is reported as written (here, capitalised).
      expect(problems).toContainEqual(
        `persona "${KEY}": letter_text: contains political term "${mixed}"`,
      );
    });
  }

  it("does not flag a term embedded inside another word", () => {
    // "devote" contains "vote" but not at a word start; "apolicy" contains
    // "policy" mid-word. Neither should match (R1.10 is word-start only).
    expect(checkLetterText(KEY, "I devote my evenings to reading.")).toEqual(
      [],
    );
    expect(checkLetterText(KEY, "An apolicy sort of day, nothing planned.")).toEqual(
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
