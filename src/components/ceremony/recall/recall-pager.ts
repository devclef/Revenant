/**
 * Pure paging rules for the Recall_Pager (design.md "Recall_Pager", R11).
 *
 * The pager's only state is a view-local index into the payload's recall
 * questions. These functions decide every index change and every submit
 * action, so the rules are testable without a DOM. The component calls them
 * and renders the result; it adds no rule of its own.
 */

/** What a submit of the form does at the given index (R11.3, R11.4, R11.11). */
export type SubmitAction = "advance" | "submit" | "ignore";

/**
 * The index a Next control or Enter on a question that is not the last moves
 * to. The last question stays last (R11.3).
 */
export function nextIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(index + 1, total - 1);
}

/** The index the Previous control moves to. The first question stays first. */
export function previousIndex(index: number): number {
  return Math.max(index - 1, 0);
}

/** True when `index` is the last question. A single question is both first and last. */
export function isLastIndex(index: number, total: number): boolean {
  return index >= total - 1;
}

/**
 * What a form submit does (Enter in a field or the submit control).
 * - While a post is in flight, nothing happens (R11.11).
 * - On a question that is not the last, the pager advances and sends nothing (R11.3).
 * - On the last question, the existing submit handler runs (R11.4).
 */
export function submitAction(
  index: number,
  total: number,
  submitting: boolean,
): SubmitAction {
  if (submitting) return "ignore";
  return isLastIndex(index, total) ? "submit" : "advance";
}

/**
 * The index of the first question in payload order whose ID is in `invalid`,
 * or -1 when none is (R11.10). `ids` is the payload's question IDs in order.
 */
export function firstInvalidIndex(
  ids: readonly string[],
  invalid: readonly string[],
): number {
  const invalidSet = new Set(invalid);
  return ids.findIndex((id) => invalidSet.has(id));
}

/**
 * The number the scale marks for a draft's text, or null when the text is not a
 * plain decimal (the same shape `numberAnswer` accepts, after trimming). A
 * half-typed or invalid entry leaves the Mark off the scale.
 */
export function draftNumber(text: string): number | null {
  const trimmed = text.trim();
  if (!/^[0-9]+(\.[0-9]+)?$/.test(trimmed)) return null;
  return Number(trimmed);
}
