// Shared tone and neutrality checks for user-facing copy modules (tone.md,
// neutrality.md). Used only by the *.copy-tone tests; not imported by the app.
//
// Plain string checks, no DOM. A string passes when it has no "!", no sentence
// longer than 25 words, no tone.md cliché, no word that grades testimony or
// scores a figure (neutrality.md, R24.6 scoring words), and no party, vote,
// election or policy term.

const CLICHES = [
  "boo",
  "spook",
  "skull",
  "mwahaha",
  "blood",
  "gore",
  "spooktacular",
  "bootiful",
] as const;

/** Judgement and grading words. Matched as whole words, case-insensitively. */
const JUDGEMENT_WORDS = [
  "right",
  "wrong",
  "close",
  "near",
  "accurate",
  "accuracy",
  "score",
  "scored",
  "scoring",
  "soar",
  "soared",
  "plunge",
  "plunged",
  "good",
  "bad",
  "better",
  "worse",
  "caught",
  "misremember",
  "misremembered",
  "cross-examine",
] as const;

/** Party, vote and policy terms. neutrality.md forbids them in product copy. */
const POLITICAL_WORDS = [
  "party",
  "parties",
  "vote",
  "voter",
  "voting",
  "election",
  "candidate",
  "policy",
  "government",
] as const;

const wholeWord = (word: string): RegExp =>
  new RegExp(`(^|[^a-z-])${word.replace(/[-]/g, "\\-")}($|[^a-z-])`, "i");

const countWords = (sentence: string): number =>
  sentence
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

/** Splits on ., ! or ? so each sentence can be length-checked. */
const splitSentences = (text: string): string[] =>
  text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

/** Every string inside a copy value, including nested arrays and objects. */
export function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value !== null && typeof value === "object") {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
}

/** Returns one message per tone or neutrality problem in the text. */
export function toneProblems(text: string): string[] {
  const problems: string[] = [];
  const lower = text.toLowerCase();

  if (text.includes("!")) problems.push(`contains "!": ${text}`);

  for (const sentence of splitSentences(text)) {
    if (countWords(sentence) > 25) {
      problems.push(`sentence over 25 words: "${sentence}"`);
    }
  }

  for (const cliche of CLICHES) {
    if (lower.includes(cliche)) problems.push(`contains "${cliche}": ${text}`);
  }

  for (const word of [...JUDGEMENT_WORDS, ...POLITICAL_WORDS]) {
    if (wholeWord(word).test(text)) {
      problems.push(`contains "${word}": ${text}`);
    }
  }

  return problems;
}
