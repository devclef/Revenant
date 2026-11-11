// Persona letter-text checks (R1.6, R1.8, R1.10).
//
// `checkLetterText` returns a list of plain-language problem strings, empty
// when the letter is valid. Each problem names the persona key, and term
// matches name the matched term, e.g.
//   persona "us-maya": letter_text: contains political term "party"
//
// Pure module: no I/O, no third-party dependencies.

import { firstCurrencyWord, firstPoliticalTerm } from "./banned-terms";
import { PRICE_RE } from "./price-lines";

// Currency symbols forbidden by R1.8.
const CURRENCY_SYMBOLS = ["$", "€", "£"] as const;

// Verdict words a testimony answer may not hold, because they grade the
// answer (tone.md, neutrality.md). Whole words, case-insensitive.
const ANSWER_VERDICT_WORDS = [
  "right",
  "wrong",
  "close",
  "near",
  "off",
  "accurate",
  "changed",
  "mistaken",
] as const;
const ANSWER_VERDICT_REGEX = new RegExp(
  `\\b(${ANSWER_VERDICT_WORDS.join("|")})\\b`,
  "i",
);

// References to the letter or to memory, matched at the start of a word so that
// "letters", "remembered" and "forgetting" match.
const ANSWER_REFERENCE_REGEX = /(?:^|[^A-Za-z0-9_])(letter|remember|forget)/i;

// "changing her mind", "changed my mind", "change mind".
const ANSWER_MIND_REGEX =
  /\bchang(?:e|es|ed|ing)\s+(?:(?:her|his|my|their|your)\s+)?mind\b/i;

/**
 * Check a persona letter's text against R1.6 (length and non-empty), P1
 * (Letter_Price_Line phrases match the expected prices exactly; apart from
 * those phrases, no digits, currency symbols or currency words, which
 * replaces the spec 03 R1.8 rule) and R1.10 (no election or party term at the
 * start of a word).
 *
 * @param key    the persona key, named in every problem message
 * @param text   the raw letter text
 * @param prices the expected Letter_Price_Line numbers, from expectedPrices
 * @returns a list of problem strings; empty when the text is valid
 */
export function checkLetterText(
  key: string,
  text: string,
  prices: readonly string[],
): string[] {
  const problems: string[] = [];
  const prefix = `persona "${key}": letter_text`;

  // Letter_Price_Line phrases are the only digits and currency symbols a
  // letter may hold (P1.3, P1.4). The phrases found must equal the expected
  // prices exactly, in order, so each tracked figure appears once. The
  // phrases are then removed before the digit, symbol and currency-word scan.
  const found = [...text.matchAll(PRICE_RE)].map((m) => m[1]);
  if (
    found.length !== prices.length ||
    found.some((value, i) => value !== prices[i])
  ) {
    problems.push(
      `${prefix}: price lines ${JSON.stringify(found)} do not match expected ${JSON.stringify(prices)}`,
    );
  }
  const scanned = text.replace(PRICE_RE, " ");

  // R1.6: 1-5,000 code points, counted with [...text].length so that astral
  // characters count once, matching payloadV1Schema's rule.
  const length = [...text].length;
  if (length < 1 || length > 5000) {
    problems.push(`${prefix}: must be 1-5,000 code points`);
  }

  // R1.6: at least one non-whitespace character.
  if (text.trim().length === 0) {
    problems.push(`${prefix}: must not be whitespace-only`);
  }

  // R1.8: no digit 0-9.
  const digitMatch = /[0-9]/.exec(scanned);
  if (digitMatch) {
    problems.push(`${prefix}: contains digit "${digitMatch[0]}"`);
  }

  // R1.8: none of the currency symbols $ € £.
  for (const symbol of CURRENCY_SYMBOLS) {
    if (scanned.includes(symbol)) {
      problems.push(`${prefix}: contains currency symbol "${symbol}"`);
    }
  }

  // R1.8: no currency word (whole-word, case-insensitive).
  const currencyWord = firstCurrencyWord(scanned);
  if (currencyWord !== null) {
    problems.push(`${prefix}: contains currency word "${currencyWord}"`);
  }

  // R1.10: no election or party term at the start of a word (case-insensitive).
  const politicalTerm = firstPoliticalTerm(text);
  if (politicalTerm !== null) {
    problems.push(`${prefix}: contains political term "${politicalTerm}"`);
  }

  return problems;
}

/**
 * Check one pre-written answer for a persona's question against the answer
 * rules: no digit, currency symbol or currency word, no election or party term,
 * no verdict word, and no reference to the letter, to remembering or forgetting,
 * or to changing a mind. The length rule (1-500 code points) is checked by
 * validatePersonaAnswers, not here.
 *
 * @param key    the persona key, named in every problem message
 * @param index  the zero-based question index the answer belongs to
 * @param text   the answer text
 * @returns a list of problem strings; empty when the answer is valid
 */
export function checkAnswerText(
  key: string,
  index: number,
  text: string,
): string[] {
  const problems: string[] = [];
  const prefix = `persona "${key}": answer ${index + 1}`;

  const digitMatch = /[0-9]/.exec(text);
  if (digitMatch) {
    problems.push(`${prefix}: contains digit "${digitMatch[0]}"`);
  }

  for (const symbol of CURRENCY_SYMBOLS) {
    if (text.includes(symbol)) {
      problems.push(`${prefix}: contains currency symbol "${symbol}"`);
    }
  }

  const currencyWord = firstCurrencyWord(text);
  if (currencyWord !== null) {
    problems.push(`${prefix}: contains currency word "${currencyWord}"`);
  }

  const politicalTerm = firstPoliticalTerm(text);
  if (politicalTerm !== null) {
    problems.push(`${prefix}: contains political term "${politicalTerm}"`);
  }

  const verdictMatch = ANSWER_VERDICT_REGEX.exec(text);
  if (verdictMatch) {
    problems.push(`${prefix}: contains verdict word "${verdictMatch[1]}"`);
  }

  const referenceMatch = ANSWER_REFERENCE_REGEX.exec(text);
  if (referenceMatch) {
    problems.push(
      `${prefix}: refers to the letter or to memory with "${referenceMatch[1]}"`,
    );
  }

  const mindMatch = ANSWER_MIND_REGEX.exec(text);
  if (mindMatch) {
    problems.push(
      `${prefix}: refers to changing a mind with "${mindMatch[0]}"`,
    );
  }

  return problems;
}
