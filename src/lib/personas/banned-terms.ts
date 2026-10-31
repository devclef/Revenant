// Banned terms for persona letter-text checks.
//
// Two matchers used by letter-checks.ts to keep persona letters free of
// currency references (R1.8) and election or party language (R1.10).
//
// Pure module: no third-party dependencies, no I/O.

/**
 * Currency words, matched as WHOLE WORDS, case-insensitively, plurals included.
 *
 * Whole-word matching is a deliberate reading of R1.8 so that ordinary words
 * such as "recent", "Europe" and "centre" don't fail on a "cent"/"eur"/"kr"
 * substring. Each entry is a bare regex source fragment (no anchors).
 */
export const CURRENCY_WORDS: readonly string[] = Object.freeze([
  "dollars?",
  "cents?",
  "euros?",
  "krona",
  "kronor",
  "kr",
  "usd",
  "eur",
  "sek",
]);

/**
 * Election and party terms, matched at the START OF A WORD, case-insensitively,
 * so inflected forms match (R1.10): e.g. "voting", "candidates", "governors".
 *
 * The first block is the required R1.10 list; the final seven extend it.
 */
export const ELECTION_PARTY_TERMS: readonly string[] = Object.freeze([
  "election",
  "vote",
  "voting",
  "ballot",
  "campaign",
  "candidate",
  "party",
  "parties",
  "democrat",
  "republican",
  "president",
  "congress",
  "senate",
  "government",
  "policy",
  "policies",
  // The last seven extend the required list.
  "politic",
  "governor",
  "mayor",
  "senator",
  "minister",
  "parliament",
  "riksdag",
]);

// A "word character" for boundary purposes: ASCII letters, digits, underscore.
// \b in JS is defined against exactly this class, which is what we want here:
// letters are ASCII and we want apostrophes/hyphens to act as word breaks.
const CURRENCY_REGEX = new RegExp(
  `\\b(?:${CURRENCY_WORDS.join("|")})\\b`,
  "i",
);

// Word-START match: preceded by a non-word character or the string start, so
// inflected suffixes still match ("voting") but a term embedded inside another
// word does not ("devote", "apolicy").
const POLITICAL_REGEX = new RegExp(
  `(?:^|[^A-Za-z0-9_])(${ELECTION_PARTY_TERMS.join("|")})`,
  "i",
);

/**
 * Return the first currency word found in `text` (as written in the text),
 * or null when there is none. Matching is whole-word and case-insensitive.
 */
export function firstCurrencyWord(text: string): string | null {
  const match = CURRENCY_REGEX.exec(text);
  return match ? match[0] : null;
}

/**
 * Return the first election or party term found at the start of a word in
 * `text` (the matched term itself, without any surrounding character), or null
 * when there is none. Matching is case-insensitive.
 */
export function firstPoliticalTerm(text: string): string | null {
  const match = POLITICAL_REGEX.exec(text);
  return match ? match[1] : null;
}
