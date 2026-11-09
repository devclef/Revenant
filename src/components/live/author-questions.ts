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
 * The index a Question_Starter fills: the first row that is empty after
 * trimming. When every row has text and fewer than 3 exist, the index is the
 * new row at the end. When 3 rows are full, the result is null and the starter
 * does nothing (C2.4).
 */
export function starterTargetIndex(rows: readonly string[]): number | null {
  const firstEmpty = rows.findIndex((row) => row.trim().length === 0);
  if (firstEmpty !== -1) return firstEmpty;
  return rows.length < AUTHOR_QUESTIONS_MAX ? rows.length : null;
}

/**
 * The rows after a Question_Starter is pressed. The text goes into the first
 * row that is empty after trimming, else a new row is added when fewer than 3
 * exist, else the rows are returned unchanged.
 */
export function applyStarter(rows: readonly string[], text: string): string[] {
  const target = starterTargetIndex(rows);
  if (target === null) return [...rows];
  if (target === rows.length) return [...rows, text];
  return rows.map((row, i) => (i === target ? text : row));
}
