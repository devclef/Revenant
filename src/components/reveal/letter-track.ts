/**
 * The step of the three-step track on `/l/{id}` (spec 15, R10.1): unlock (0),
 * Testify (1) or receipts (2). Pure, so the mapping is tested in Node.
 *
 * The still-sealed state returns null: the reader sees only the sealed notice
 * and the countdown (R10.2), so no track shows. Errors return null too, since
 * no step applies to them.
 */

import type { FlowState } from "./opening-machine";

export type LetterTrackStep = 0 | 1 | 2;

export function letterTrackStep(tag: FlowState["tag"]): LetterTrackStep | null {
  switch (tag) {
    case "loading":
    case "openable":
    case "awaiting_key":
    case "unlocking":
    case "verifying":
      return 0;
    case "recall":
    case "submitting":
    case "submit_failed":
    case "reading":
      return 1;
    case "reveal":
      return 2;
    default:
      return null;
  }
}
