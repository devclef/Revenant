/**
 * The decisions behind the Receipts_Disclosure's openRequest counter (spec 11,
 * L1.4). Kept apart from the component so the node test environment can check
 * them: the component only reads the DOM and calls these.
 */

/** What a control inside the disclosure is, for choosing the focus target. */
export type ReceiptsControlKind = "summary" | "checkbox" | "control";

/** The counter after one more Add a receipt press. */
export function nextOpenRequest(count: number): number {
  return count + 1;
}

/**
 * Whether a counter value is a press the disclosure has not handled yet. Zero
 * is the value before any press, so it never opens the disclosure.
 */
export function isNewOpenRequest(
  openRequest: number,
  handled: number,
): boolean {
  return openRequest !== 0 && openRequest !== handled;
}

/**
 * The index of the control to focus when the disclosure opens, or -1 when there
 * is none. With figures ready it is the first figure checkbox. Otherwise, or
 * when no checkbox exists, it is the first control after the summary.
 */
export function focusIndex(
  kinds: readonly ReceiptsControlKind[],
  figuresReady: boolean,
): number {
  if (figuresReady) {
    const checkbox = kinds.indexOf("checkbox");
    if (checkbox !== -1) return checkbox;
  }
  return kinds.findIndex((kind) => kind !== "summary");
}
