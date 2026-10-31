// Persona letter-text checks (R1.6, R1.8, R1.10).
//
// `checkLetterText` returns a list of plain-language problem strings, empty
// when the letter is valid. Each problem names the persona key, and term
// matches name the matched term, e.g.
//   persona "us-maya": letter_text: contains political term "party"
//
// Pure module: no I/O, no third-party dependencies.

import { firstCurrencyWord, firstPoliticalTerm } from "./banned-terms";

// Currency symbols forbidden by R1.8.
const CURRENCY_SYMBOLS = ["$", "€", "£"] as const;

/**
 * Check a persona letter's text against R1.6 (length and non-empty), R1.8 (no
 * digits, currency symbols or currency words) and R1.10 (no election or party
 * term at the start of a word).
 *
 * @param key  the persona key, named in every problem message
 * @param text the raw letter text
 * @returns a list of problem strings; empty when the text is valid
 */
export function checkLetterText(key: string, text: string): string[] {
  const problems: string[] = [];
  const prefix = `persona "${key}": letter_text`;

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
  const digitMatch = /[0-9]/.exec(text);
  if (digitMatch) {
    problems.push(`${prefix}: contains digit "${digitMatch[0]}"`);
  }

  // R1.8: none of the currency symbols $ € £.
  for (const symbol of CURRENCY_SYMBOLS) {
    if (text.includes(symbol)) {
      problems.push(`${prefix}: contains currency symbol "${symbol}"`);
    }
  }

  // R1.8: no currency word (whole-word, case-insensitive).
  const currencyWord = firstCurrencyWord(text);
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
