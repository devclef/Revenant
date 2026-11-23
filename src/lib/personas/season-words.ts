// Season, month and weekday word checks for persona texts (spec 18 R5.2,
// R6.1 to R6.3; design.md "5. Persona_Texts and their checks").
//
// The persona letters are written for one Sunday in November, so their text
// must not name the wrong season or month. Two scopes exist:
//
// - letterSeasonWord: the letter files. No month name from January to
//   September and no whole word spring, summer, springtime or summertime.
// - textSeasonWord: intro lines, Priya's questions, sealed answers and
//   recollections. No month other than November, no weekday other than
//   Sunday, and no season word other than autumn, fall or winter.
//
// "May" is checked only with a capital M, so the verb "may" passes and
// "Maybe" is not a whole-word match. Every other month and season word is
// matched in any case.
//
// Pure module: no I/O, no third-party dependencies.

/** English month names, January first. Index 0 is month 1. */
export const MONTH_NAMES: readonly string[] = Object.freeze([
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]);

/** English weekday names, Monday first. */
const WEEKDAY_NAMES: readonly string[] = Object.freeze([
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]);

/** Season words that no persona text may use. */
const BANNED_SEASON_WORDS: readonly string[] = Object.freeze([
  "spring",
  "springtime",
  "summer",
  "summertime",
]);

/** Season words allowed in intro lines, questions, answers and recollections. */
export const ALLOWED_SEASON_WORDS: readonly string[] = Object.freeze([
  "autumn",
  "fall",
  "winter",
]);

// Whole-word patterns. `\b` treats ASCII letters and digits as word characters,
// which matches the rest of the persona checks.
const MAY_RE = /\bMay\b/;

function wordRegex(words: readonly string[]): RegExp {
  return new RegExp(`\\b(?:${words.join("|")})\\b`, "i");
}

/**
 * The first match of any pattern, reported as written in the text, or null.
 * "Earliest in the text" wins, so the first offending word is the one reported.
 */
function firstMatch(text: string, patterns: readonly RegExp[]): string | null {
  let best: { index: number; word: string } | null = null;
  for (const pattern of patterns) {
    const m = pattern.exec(text);
    if (m && (best === null || m.index < best.index)) {
      best = { index: m.index, word: m[0] };
    }
  }
  return best === null ? null : best.word;
}

const LETTER_MONTHS = MONTH_NAMES.slice(0, 9).filter((name) => name !== "May");
const TEXT_MONTHS = MONTH_NAMES.filter(
  (name) => name !== "May" && name !== "November",
);
const TEXT_WEEKDAYS = WEEKDAY_NAMES.filter((name) => name !== "Sunday");

const LETTER_PATTERNS: readonly RegExp[] = Object.freeze([
  wordRegex(LETTER_MONTHS),
  MAY_RE,
  wordRegex(BANNED_SEASON_WORDS),
]);

const TEXT_PATTERNS: readonly RegExp[] = Object.freeze([
  wordRegex(TEXT_MONTHS),
  MAY_RE,
  wordRegex(TEXT_WEEKDAYS),
  wordRegex(BANNED_SEASON_WORDS),
]);

/**
 * The first month or season word in a letter file that breaks R5.2: a month
 * from January to September, or spring, summer, springtime or summertime.
 *
 * @returns the offending word as written, or null when the letter is clean
 */
export function letterSeasonWord(text: string): string | null {
  return firstMatch(text, LETTER_PATTERNS);
}

/**
 * The first month, weekday or season word in an intro line, question, sealed
 * answer or recollection that breaks R6.1 to R6.3: a month other than
 * November, a weekday other than Sunday, or spring, summer, springtime or
 * summertime.
 *
 * @returns the offending word as written, or null when the text is clean
 */
export function textSeasonWord(text: string): string | null {
  return firstMatch(text, TEXT_PATTERNS);
}
