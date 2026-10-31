/**
 * R2.4 banned direction words for recall question subjects.
 *
 * A recall subject must not hint at which way a figure moved, so these
 * direction words are rejected. The list is fixed: it is exactly the R2.4
 * list and must not be reordered or extended without a spec change.
 *
 * All entries are lowercase; matching is case-insensitive and whole-word.
 * No dependencies beyond the standard library.
 */
export const BANNED_DIRECTION_WORDS: readonly string[] = [
  "more",
  "less",
  "higher",
  "lower",
  "rise",
  "rose",
  "risen",
  "fall",
  "fell",
  "fallen",
  "increase",
  "increased",
  "decrease",
  "decreased",
  "up",
  "down",
  "cheaper",
  "dearer",
  "soar",
  "soared",
  "drop",
  "dropped",
] as const;

/**
 * Whole-word, case-insensitive matcher compiled once from
 * {@link BANNED_DIRECTION_WORDS}.
 *
 * `\b` word boundaries mean a banned word only matches when it stands on its
 * own, so "upland" and "dropout" do not match "up" or "drop". The `i` flag
 * makes matching case-insensitive.
 */
const BANNED_WORD_RE = new RegExp(
  `\\b(?:${BANNED_DIRECTION_WORDS.join("|")})\\b`,
  "i",
);

/**
 * Return the first banned direction word found in `subject` as a whole word
 * (case-insensitive), or `null` if none is present.
 *
 * The returned word is normalised to lowercase so callers get a stable value
 * regardless of how it was written in the subject.
 */
export function containsBannedWord(subject: string): string | null {
  const match = BANNED_WORD_RE.exec(subject);
  return match ? match[0].toLowerCase() : null;
}
