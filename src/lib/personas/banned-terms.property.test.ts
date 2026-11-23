// Property 6: Banned terms match by their rule
// (.kiro/specs/18-persona-dates/design.md, Property 6; R8.2, R8.7).
//
// For any entry of ELECTION_PARTY_TERMS, any letter casing, any clean prefix
// and suffix, and (for phrase entries) any non-empty run of whitespace between
// the words, `findBannedTerms` finds the entry when it starts a word, with the
// matched text as written and its 1-based line. A prefix entry also matches an
// inflected form. `poll` and `polls` need a non-word character after them. A
// term that starts inside another word never matches.
//
// Style follows the sibling property tests: fast-check generators,
// `fc.assert(fc.property)` with { numRuns: 100 }, no network and no I/O.
// findBannedTerms is pure.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  ELECTION_PARTY_TERMS,
  TERM_RULES,
  findBannedTerms,
} from "./banned-terms";

// Words that contain no banned term at a word start, so a text built from them
// adds no match of its own.
const CLEAN_WORDS = [
  "the",
  "quiet",
  "evening",
  "settled",
  "over",
  "our",
  "small",
  "kitchen",
  "table",
  "where",
  "letters",
  "rested",
  "beside",
  "an",
  "open",
  "window",
  "and",
  "faded",
  "light",
  "fell",
  "softly",
] as const;

const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

// Inflections added to a prefix entry. None of them turns the entry into a
// longer entry ("party" + "ies" would read as "parties" and is left out).
const INFLECTIONS = [
  "",
  "s",
  "ed",
  "ing",
  "er",
  "al",
  "ic",
  "ial",
  "ism",
] as const;

// Whitespace that may separate the words of a phrase entry.
const WHITESPACE_RUNS = [" ", "  ", "\n", "\t", " \n ", "\r\n"] as const;

// The four written forms of "veterans day" that the matcher accepts.
const VETERAN_FORMS = [
  "veterans day",
  "veteran's day",
  "veteran’s day",
  "veterans' day",
] as const;

const cleanPhraseArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...CLEAN_WORDS), { minLength: 1, maxLength: 6 })
  .map((words) => words.join(" "));

// A clean prefix that ends with a non-word separator, so the term that follows
// starts a word. An empty prefix puts the term at the start of the text.
const prefixArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.array(cleanPhraseArb, { minLength: 0, maxLength: 3 }),
    fc.constantFrom(" ", "\n", "\n\n", "\t", "  "),
  )
  .map(([lines, sep]) => (lines.length === 0 ? "" : lines.join(sep) + sep));

// A clean suffix that starts with whitespace, so no word continues after the term.
const suffixArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.array(cleanPhraseArb, { minLength: 0, maxLength: 2 }),
    fc.constantFrom(" ", "\n", "\t"),
  )
  .map(([words, sep]) => (words.length === 0 ? "" : sep + words.join(" ")));

const termArb = fc.constantFrom(...ELECTION_PARTY_TERMS);
const variantArb = fc.constantFrom(...VETERAN_FORMS);
const maskArb = fc.array(fc.boolean(), { minLength: 0, maxLength: 24 });
const runArb = fc.constantFrom(...WHITESPACE_RUNS);

// The term as a writer would type it: "veterans day" uses one of its four
// forms, the letters take the random casing, and each space becomes the chosen
// whitespace run.
function writtenTerm(
  term: string,
  variant: string,
  mask: readonly boolean[],
  run: string,
): string {
  const base = term === "veterans day" ? variant : term;
  return [...base]
    .map((ch, i) => (mask[i] ? ch.toUpperCase() : ch.toLowerCase()))
    .join("")
    .split(" ")
    .join(run);
}

function newlinesIn(text: string): number {
  return text.split("\n").length;
}

describe("Property 6: banned terms match by their rule", () => {
  it("finds every entry at a word start, as written, with its line", () => {
    fc.assert(
      fc.property(
        prefixArb,
        termArb,
        variantArb,
        maskArb,
        runArb,
        suffixArb,
        fc.constantFrom(...INFLECTIONS),
        (prefix, term, variant, mask, run, suffix, inflection) => {
          // Only prefix entries take an inflection; the others are matched whole.
          const tail = TERM_RULES[term] === "prefix" ? inflection : "";

          const written = writtenTerm(term, variant, mask, run);
          const text = `${prefix}${written}${tail}${suffix}`;

          expect(findBannedTerms(text)).toEqual([
            {
              term: written,
              index: prefix.length,
              line: newlinesIn(prefix),
            },
          ]);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("does not match poll or polls when a letter or digit follows", () => {
    fc.assert(
      fc.property(
        prefixArb,
        fc.constantFrom("poll", "polls"),
        fc.constantFrom(..."0123456789".split("")),
        maskArb,
        (prefix, term, digit, mask) => {
          expect(TERM_RULES[term]).toBe("word");
          const cased = [...term]
            .map((ch, i) => (mask[i] ? ch.toUpperCase() : ch.toLowerCase()))
            .join("");
          expect(findBannedTerms(`${prefix}${cased}${digit}`)).toEqual([]);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("does not match a term that starts inside another word", () => {
    fc.assert(
      fc.property(
        termArb,
        variantArb,
        maskArb,
        runArb,
        fc.array(fc.constantFrom(...LETTERS), { minLength: 1, maxLength: 6 }),
        (term, variant, mask, run, glue) => {
          const glued = glue.join("");
          const written = writtenTerm(term, variant, mask, run);
          // A glued lowercase run with no separator, so the term is no longer
          // at a word start. The check looks at that position only.
          const found = findBannedTerms(`${glued}${written}`);
          expect(found.some((m) => m.index === glued.length)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
