// Property 14: Letter text checks catch digits, currency and political terms
// (design.md "Property 14", R1.6, R1.8, R1.10).
//
// For any text built from a vocabulary with no banned term, no digit and no
// currency symbol, `checkLetterText` passes when the text is 1-5,000 code
// points and not whitespace-only. Inserting any digit, currency symbol or whole
// currency word at a random position makes it fail, naming the persona key. So
// does inserting any election or party term, in random case and with an
// optional suffix, at the start of a word — and that failure also names the
// term. Inserting a term in the MIDDLE of a word ("devote", "apolicy") does not
// make it fail.
//
// Style follows the sibling property tests (schema.property.test.ts,
// figures/*.property.test.ts): fast-check generators, `fc.assert(fc.property)`
// with { numRuns: 100 }, no network and no I/O. checkLetterText is pure.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { checkLetterText } from "./letter-checks";
import { CURRENCY_WORDS, ELECTION_PARTY_TERMS } from "./banned-terms";

// --- A vocabulary that is clean by construction ------------------------------
//
// Words that contain no digit, no currency symbol, no currency word (whole
// word) and begin with no election/party term. They are ordinary lowercase
// letters only, so sentences built from them never trip any check. Chosen to
// avoid substrings that a MID-word injection test would later rely on — the
// clean text must stay clean on its own.
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
  "the",
  "faded",
  "light",
  "fell",
  "softly",
  "across",
  "worn",
  "paper",
  "while",
  "memories",
  "of",
  "that",
  "autumn",
  "returned",
  "slowly",
  "like",
  "ink",
  "drying",
] as const;

// A clean sentence: 3-40 words from CLEAN_WORDS joined by single spaces. By
// construction it has no digit, no currency symbol, no whole currency word and
// no election/party term at a word start, and it is well within 1-5,000 code
// points and never whitespace-only.
const cleanTextArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...CLEAN_WORDS), { minLength: 3, maxLength: 40 })
  .map((words) => words.join(" "))
  .filter((text) => {
    const n = [...text].length;
    return n >= 1 && n <= 5000 && checkLetterText("probe", text).length === 0;
  });

const KEY = "us-maya";

// --- The clean baseline passes -----------------------------------------------

describe("Property 14: checkLetterText passes clean text", () => {
  it("accepts clean generated text within 1-5,000 code points", () => {
    fc.assert(
      fc.property(cleanTextArb, (text) => {
        expect(checkLetterText(KEY, text)).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });
});

// --- Helper: insert a fragment at a code-point boundary ----------------------
//
// Splits `text` at a code-point index (0..length) so astral characters are not
// torn, then inserts `fragment` there.
function insertAt(text: string, fragment: string, at: number): string {
  const cps = [...text];
  const index = Math.max(0, Math.min(at, cps.length));
  return cps.slice(0, index).join("") + fragment + cps.slice(index).join("");
}

// --- Digits (R1.8) -----------------------------------------------------------

describe("Property 14: inserting a digit fails and names the persona key", () => {
  it("any digit at any position is caught", () => {
    fc.assert(
      fc.property(
        cleanTextArb,
        fc.constantFrom(..."0123456789".split("")),
        fc.integer({ min: 0, max: 10000 }),
        (text, digit, rawPos) => {
          const corrupted = insertAt(text, digit, rawPos);
          const problems = checkLetterText(KEY, corrupted);
          expect(problems.length).toBeGreaterThan(0);
          expect(problems).toContainEqual(
            `persona "${KEY}": letter_text: contains digit "${digit}"`,
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Currency symbols (R1.8) -------------------------------------------------

describe("Property 14: inserting a currency symbol fails and names the key", () => {
  it("any of $ € £ at any position is caught", () => {
    fc.assert(
      fc.property(
        cleanTextArb,
        fc.constantFrom("$", "€", "£"),
        fc.integer({ min: 0, max: 10000 }),
        (text, symbol, rawPos) => {
          const corrupted = insertAt(text, symbol, rawPos);
          const problems = checkLetterText(KEY, corrupted);
          expect(problems.length).toBeGreaterThan(0);
          expect(problems).toContainEqual(
            `persona "${KEY}": letter_text: contains currency symbol "${symbol}"`,
          );
          for (const problem of problems) {
            expect(problem).toContain(`persona "${KEY}": letter_text`);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Currency words (R1.8) ---------------------------------------------------
//
// CURRENCY_WORDS are bare regex source fragments; these literals realise each
// one as a concrete whole word a letter might contain. Inserted surrounded by
// spaces so the match is whole-word regardless of the neighbouring text.
const CURRENCY_WORD_EXAMPLES: Record<string, string> = {
  "dollars?": "dollars",
  "cents?": "cents",
  "euros?": "euros",
  krona: "krona",
  kronor: "kronor",
  kr: "kr",
  usd: "usd",
  eur: "eur",
  sek: "sek",
};

describe("Property 14: inserting a currency word fails and names the key", () => {
  it("covers every CURRENCY_WORDS fragment", () => {
    expect(Object.keys(CURRENCY_WORD_EXAMPLES).sort()).toEqual(
      [...CURRENCY_WORDS].sort(),
    );
  });

  it("any whole currency word at any position is caught", () => {
    fc.assert(
      fc.property(
        cleanTextArb,
        fc.constantFrom(...Object.values(CURRENCY_WORD_EXAMPLES)),
        fc.integer({ min: 0, max: 10000 }),
        (text, word, rawPos) => {
          // Surround with spaces so the inserted token is a whole word and the
          // clean text (which is all lowercase letters) cannot fuse with it.
          const corrupted = insertAt(text, ` ${word} `, rawPos);
          const problems = checkLetterText(KEY, corrupted);
          expect(problems.length).toBeGreaterThan(0);
          expect(problems).toContainEqual(
            `persona "${KEY}": letter_text: contains currency word "${word}"`,
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Election and party terms at a word start (R1.10) ------------------------
//
// Each term is inserted in random case, with an optional lowercase-letter
// suffix, at the START of a word (preceded by a space so it is a word start).
// The failure must name the matched term exactly as written in the text.

// Apply a per-character case mask to produce random casing of `term`.
function recase(term: string, mask: readonly boolean[]): string {
  return [...term]
    .map((ch, i) => (mask[i] ? ch.toUpperCase() : ch.toLowerCase()))
    .join("");
}

const SUFFIX_LETTERS = "abcdefghijklmnopqrstuvwxyz";

describe("Property 14: inserting an election/party term fails and names it", () => {
  it("any term, random case, optional suffix, at a word start is caught", () => {
    fc.assert(
      fc.property(
        cleanTextArb,
        fc.constantFrom(...ELECTION_PARTY_TERMS),
        fc.array(fc.boolean(), { minLength: 0, maxLength: 20 }),
        fc.array(fc.constantFrom(...SUFFIX_LETTERS.split("")), {
          minLength: 0,
          maxLength: 6,
        }),
        fc.integer({ min: 0, max: 10000 }),
        (text, term, caseMask, suffix, rawPos) => {
          const cased = recase(term, caseMask);
          const written = cased + suffix.join("");
          // A leading space makes the inserted token a word start; a trailing
          // space keeps any following clean word separate.
          const corrupted = insertAt(text, ` ${written} `, rawPos);
          const problems = checkLetterText(KEY, corrupted);

          // The term is at a word start, so it must be flagged.
          expect(problems.length).toBeGreaterThan(0);

          // `checkLetterText` reports the MATCHED term as written in the text
          // (the capture group), which is a listed term — not the optional
          // suffix. Because the term list is a regex alternation, a shorter
          // listed term that prefixes the written token can win (e.g. "vote"
          // for "voting..."), so the reported term is some listed term that is
          // a case-insensitive prefix of the written token. The failure names
          // both the persona key and that matched term.
          const politicalProblems = problems.filter((p) =>
            p.startsWith(
              `persona "${KEY}": letter_text: contains political term "`,
            ),
          );
          expect(politicalProblems.length).toBeGreaterThan(0);

          const writtenLower = written.toLowerCase();
          for (const problem of politicalProblems) {
            const match = /contains political term "([^"]*)"$/.exec(problem);
            expect(match).not.toBeNull();
            const named = match![1];
            // A listed term…
            expect(
              ELECTION_PARTY_TERMS.some(
                (t) => t.toLowerCase() === named.toLowerCase(),
              ),
            ).toBe(true);
            // …that is a case-insensitive prefix of the token we inserted…
            expect(writtenLower.startsWith(named.toLowerCase())).toBe(true);
            // …reported with the exact casing it had in the text.
            expect(written.startsWith(named)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- A term in the MIDDLE of a word does not fail (R1.10) --------------------
//
// Embedding a term after a letter means it is no longer a word start, so it
// must not match. "devote" (vote) and "apolicy" (policy) are the design.md
// examples; here the embedding is generated: a clean word prefix fused onto the
// term with no separator, then a trailing space.

describe("Property 14: a term in the middle of a word does not fail", () => {
  it("prefixing a term with letters prevents the word-start match", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ELECTION_PARTY_TERMS),
        // 1-6 lowercase letters glued before the term, so the term starts
        // mid-word rather than at a word boundary.
        fc.array(fc.constantFrom(...SUFFIX_LETTERS.split("")), {
          minLength: 1,
          maxLength: 6,
        }),
        (term, prefixLetters) => {
          const prefix = prefixLetters.join("");
          // Only keep prefixes that are themselves clean at a word start: a
          // prefix that begins with a term (e.g. "vote") would make the
          // combined token start with that term and match legitimately, which
          // is not the case this property is about. `checkLetterText` on the
          // bare prefix is non-empty exactly when the prefix itself starts a
          // term, so skip those.
          fc.pre(checkLetterText("probe", prefix).length === 0);

          const embedded = `${prefix}${term}`;
          // The term now sits mid-word, preceded by a letter, so R1.10's
          // word-start rule must not flag it. The token is lowercase letters
          // only: no digit, no currency symbol or word either.
          const problems = checkLetterText(KEY, embedded);
          expect(problems).toEqual([]);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("the design.md examples devote and apolicy pass", () => {
    expect(checkLetterText(KEY, "I devote my evenings to reading.")).toEqual([]);
    expect(
      checkLetterText(KEY, "An apolicy sort of day, nothing planned."),
    ).toEqual([]);
  });
});
