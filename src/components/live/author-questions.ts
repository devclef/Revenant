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

/** The one reason a row can block sealing. */
export type QuestionRowProblem = "question_too_long";

/** Counts code points, so an astral character counts as one. */
function codePointLength(text: string): number {
  return [...text].length;
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
 * The row that takes focus after removing the row at `removedIndex` from a list
 * of `countBefore` rows. It is the row now at `removedIndex`. When the last row
 * was removed, it is the row before it. When no rows remain, it is Add.
 */
export function focusAfterRemove(
  countBefore: number,
  removedIndex: number,
): FocusAfterRemove {
  const countAfter = Math.max(0, countBefore - 1);
  if (countAfter === 0) return { kind: "add" };
  if (removedIndex < countAfter) return { kind: "row", index: removedIndex };
  return { kind: "row", index: countAfter - 1 };
}
