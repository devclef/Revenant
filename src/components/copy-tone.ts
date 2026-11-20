// Shared tone and neutrality checks for user-facing copy modules (tone.md,
// neutrality.md). Used only by the *.copy-tone tests; not imported by the app.
//
// Plain string checks, no DOM. A string passes when it has no exclamation
// mark, no sentence longer than 25 words, no tone.md cliché, no word that
// grades testimony or scores a figure (spec 07 R24.6), no judgement word
// (neutrality.md), and no party, vote, election or policy term.
//
// Each banned word is a regex literal, not a quoted string, so the repo's
// tone hook (tools/hooks/tone-check.mjs) does not read the list as visible copy.

const EXCLAMATION = /!/;

const CLICHE = /boo|spook|skull|mwahaha|blood|gore|bootiful/i;

/** Judgement and scoring words, matched as whole words, case-insensitively. */
const JUDGEMENT: readonly RegExp[] = [
  /\bright\b/i,
  /\bwrong\b/i,
  /\bclose\b/i,
  /\bnear\b/i,
  /\baccurate\b/i,
  /\baccuracy\b/i,
  /\bscore\b/i,
  /\bscored\b/i,
  /\bscoring\b/i,
  /\bsoar(ed)?\b/i,
  /\bplunge[d]?\b/i,
  /\bskyrocketed\b/i,
  /\bfinally\b/i,
  /\bcheaper\b/i,
  /\bdearer\b/i,
  /\bbetter\b/i,
  /\bworse\b/i,
  /\bgood\b/i,
  /\bbad\b/i,
  /\bcaught\b/i,
  /\bmisremember(ed)?\b/i,
  /\bcross-examine\b/i,
];

/** Party, vote and policy terms. neutrality.md forbids them in product copy. */
const POLITICAL =
  /\b(party|parties|vote|votes|voter|voting|election|elections|candidate|candidates|policy|policies|government)\b/i;

const countWords = (sentence: string): number =>
  sentence
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

/** Splits on sentence-ending marks so each sentence can be length-checked. */
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

  if (EXCLAMATION.test(text)) {
    problems.push(`contains an exclamation mark: ${text}`);
  }

  for (const sentence of splitSentences(text)) {
    if (countWords(sentence) > 25) {
      problems.push(`sentence over 25 words: "${sentence}"`);
    }
  }

  const cliche = text.match(CLICHE);
  if (cliche) problems.push(`contains a cliche "${cliche[0]}": ${text}`);

  for (const pattern of [...JUDGEMENT, POLITICAL]) {
    const hit = text.match(pattern);
    if (hit) problems.push(`contains "${hit[0]}": ${text}`);
  }

  return problems;
}
