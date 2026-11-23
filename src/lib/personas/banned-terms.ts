// Banned terms for persona letter-text checks.
//
// Matchers used by letter-checks.ts, answers.ts and schema.ts to keep persona
// texts free of currency references (R1.8), election, party and public-event
// language (R1.10, spec 18 R8).
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
 * Election, party and public-event terms, readable form. Each entry has one
 * matching rule in {@link TERM_RULES}.
 *
 * The first block is the R1.10 list, the second extends it (spec 18, R8.1),
 * and the last two are the public-event additions from spec 18 design item 4.
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
  "politic",
  "governor",
  "mayor",
  "senator",
  "minister",
  "parliament",
  "riksdag",
  "electoral",
  "inaugurat",
  "poll",
  "polls",
  "referendum",
  "midterm",
  "primaries",
  "caucus",
  "swing state",
  "thanksgiving",
  "veterans day",
  "armistice",
  "remembrance",
  "black friday",
  "holiday",
  "christmas",
  "new year",
]);

/**
 * How an entry matches, after the word-start anchor `(?:^|[^A-Za-z0-9_])`.
 *
 * - `prefix`: the entry starts a word, so inflected forms match
 *   ("voting", "inaugurated", "caucuses").
 * - `word`: the entry is a whole word ("poll", "polls").
 * - `phrase`: the words of the entry may be separated by any whitespace,
 *   including a line break.
 */
export type TermRule = "prefix" | "word" | "phrase";

export const TERM_RULES: Readonly<Record<string, TermRule>> = Object.freeze({
  election: "prefix",
  vote: "prefix",
  voting: "prefix",
  ballot: "prefix",
  campaign: "prefix",
  candidate: "prefix",
  party: "prefix",
  parties: "prefix",
  democrat: "prefix",
  republican: "prefix",
  president: "prefix",
  congress: "prefix",
  senate: "prefix",
  government: "prefix",
  policy: "prefix",
  policies: "prefix",
  politic: "prefix",
  governor: "prefix",
  mayor: "prefix",
  senator: "prefix",
  minister: "prefix",
  parliament: "prefix",
  riksdag: "prefix",
  electoral: "prefix",
  inaugurat: "prefix",
  poll: "word",
  polls: "word",
  referendum: "prefix",
  midterm: "prefix",
  primaries: "prefix",
  caucus: "prefix",
  "swing state": "phrase",
  thanksgiving: "prefix",
  "veterans day": "phrase",
  armistice: "prefix",
  remembrance: "prefix",
  "black friday": "phrase",
  holiday: "prefix",
  christmas: "prefix",
  "new year": "phrase",
});

/**
 * Regex source for each entry. Built from the entry and its rule, with two
 * exceptions: the `veterans day` phrase also accepts an apostrophe in the
 * possessive form ("veteran's day", "veterans' day").
 */
function patternFor(term: string, rule: TermRule): string {
  if (term === "veterans day") {
    return "veteran(?:s['’]?|['’]s)\\s+day";
  }
  if (rule === "word") {
    return `${term}(?![A-Za-z0-9_])`;
  }
  if (rule === "phrase") {
    return term.split(" ").join("\\s+");
  }
  return term;
}

const TERM_ALTERNATION = ELECTION_PARTY_TERMS.map((term) => {
  const rule = TERM_RULES[term];
  if (rule === undefined) {
    throw new Error(`banned-terms: no rule for entry "${term}"`);
  }
  return `(?:${patternFor(term, rule)})`;
}).join("|");

// Word-START match: preceded by a non-word character or the string start, so
// inflected suffixes still match ("voting") but a term embedded inside another
// word does not ("devote", "apolicy"). The global flag finds every match.
const BANNED_REGEX = new RegExp(
  `(?:^|[^A-Za-z0-9_])(${TERM_ALTERNATION})`,
  "gi",
);

// A "word character" for boundary purposes: ASCII letters, digits, underscore.
// \b in JS is defined against exactly this class, which is what we want here:
// letters are ASCII and we want apostrophes/hyphens to act as word breaks.
const CURRENCY_REGEX = new RegExp(`\\b(?:${CURRENCY_WORDS.join("|")})\\b`, "i");

/** One banned-term match in a text. */
export type BannedMatch = {
  /** The matched text, as written in the text. */
  term: string;
  /** Index of the first character of the match in the text. */
  index: number;
  /** 1-based line number of the match. */
  line: number;
};

/**
 * Every election, party or public-event term found in `text`, in order of
 * position. Matching is case-insensitive and anchored at a word start.
 */
export function findBannedTerms(text: string): BannedMatch[] {
  const matches: BannedMatch[] = [];
  for (const match of text.matchAll(BANNED_REGEX)) {
    const term = match[1];
    if (term === undefined) continue;
    // The captured term is the last part of the full match, after the one
    // optional character that precedes it.
    const index = match.index + match[0].length - term.length;
    const line = text.slice(0, index).split("\n").length;
    matches.push({ term, index, line });
  }
  return matches;
}

/**
 * Return the first currency word found in `text` (as written in the text),
 * or null when there is none. Matching is whole-word and case-insensitive.
 */
export function firstCurrencyWord(text: string): string | null {
  const match = CURRENCY_REGEX.exec(text);
  return match ? match[0] : null;
}

/**
 * The first election, party or public-event term in `text`, as written, or
 * null when there is none.
 */
export function firstBannedTerm(text: string): string | null {
  const first = findBannedTerms(text)[0];
  return first ? first.term : null;
}

/**
 * @deprecated Name kept for existing callers. Same as {@link firstBannedTerm}.
 */
export const firstPoliticalTerm: typeof firstBannedTerm = firstBannedTerm;
