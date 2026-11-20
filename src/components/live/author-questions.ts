/**
 * Pure rules for the Author_Question rows on the Write step (spec 10, C2).
 *
 * An Author_Question is a question the author writes for their future self.
 * Rows are plain strings here. The rules are:
 * - at most 3 rows (C2.1);
 * - a row that is empty after trimming is dropped at sealing and never blocks
 *   it (C2.3);
 * - only a row over 200 code points after trimming blocks sealing (C2.2).
 *
 * No React and no DOM, so the rules run in the browser and in tests.
 */

export const AUTHOR_QUESTIONS_MAX = 3;
export const AUTHOR_QUESTION_MAX_CODE_POINTS = 200;
export const AUTHOR_ANSWER_MAX_CODE_POINTS = 1000;

/** The one reason a row can block sealing. */
export type QuestionRowProblem = "question_too_long";

/** The one reason an answer can block sealing (spec 15, R7.3). */
export type AnswerProblem = "answer_too_long";

/** Counts code points, so an astral character counts as one. */
function codePointLength(text: string): number {
  return [...text].length;
}

/**
 * Returns `"answer_too_long"` when the answer is over 1,000 code points after
 * trimming. An empty answer has no problem here; the fold check handles it.
 */
export function answerProblem(text: string): AnswerProblem | null {
  return codePointLength(text.trim()) > AUTHOR_ANSWER_MAX_CODE_POINTS
    ? "answer_too_long"
    : null;
}

/**
 * Returns `"question_too_long"` when the row is over 200 code points after
 * trimming. Any other row, including an empty one, has no problem.
 */
export function questionRowProblem(text: string): QuestionRowProblem | null {
  return codePointLength(text.trim()) > AUTHOR_QUESTION_MAX_CODE_POINTS
    ? "question_too_long"
    : null;
}

/**
 * The rows that are sealed: each trimmed, empty ones dropped, order kept. A row
 * that is empty after trimming never reaches the payload.
 */
export function questionsForSeal(rows: readonly string[]): string[] {
  return rows.map((row) => row.trim()).filter((row) => row.length > 0);
}

/**
 * Where focus goes after a row is removed (spec 10, C2). `row` is the index in
 * the list after removal. `add` means no rows remain, so focus goes to the
 * Add a question control.
 */
export type FocusAfterRemove = { kind: "row"; index: number } | { kind: "add" };

/**
 * The control that takes focus after removing the row at `removedIndex` from a
 * list of `countBefore` rows. It is the next row, which is now at
 * `removedIndex`. When the removed row was the last one, no row follows, so
 * focus goes to Add a question.
 */
export function focusAfterRemove(
  countBefore: number,
  removedIndex: number,
): FocusAfterRemove {
  const countAfter = Math.max(0, countBefore - 1);
  if (removedIndex < countAfter) return { kind: "row", index: removedIndex };
  return { kind: "add" };
}
