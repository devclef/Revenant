// Receipt kind (spec 12-submission-polish, Z1.3, Z1.4, Z2.7; spec 14 R7).
//
// receiptKindFor decides which card a sealed figure gets on the figures Stage:
// the Single_Figure_View, the same-period card, the compared card, or the
// not-comparable card. It is a pure function over the sealed figure, the now
// figure, the change that computeChange gave for that pair and the kind of
// letter. It does not compute the change itself and does not alter
// computeChange.
//
// This module imports nothing from src/lib/crypto, src/lib/db or Node
// built-ins, so it is pure and safe to use in the browser and on the server.

import type { FigureV1 } from "@/lib/seal-format";
import { isSameFigure, type ChangeResult } from "@/lib/figures";
import type { LetterKind } from "./FigureLine";

/**
 * The card a figure gets:
 *
 * - `no_now`: there is no now figure to compare against.
 * - `single`: the now figure is the same record as the sealed one
 *   (a Same_Figure) on a persona letter. The card prints the figure once and
 *   no change (spec 12 Z2).
 * - `same_period`: the same record as the sealed one (a Same_Figure) on a live
 *   or real letter. The card shows both rows, the Number_Line and the
 *   Same_Period_Line, and no change (spec 14 R7.1).
 * - `compared`: the two figures are comparable, so the then and now card
 *   shows the change. This includes a zero change across two periods.
 * - `not_comparable`: the figures differ in some way computeChange rejects,
 *   including a revised figure for the same period.
 */
export type ReceiptKind =
  "no_now" | "single" | "same_period" | "compared" | "not_comparable";

/**
 * Pick the receipt kind for one sealed figure.
 *
 * `change` is the result of `computeChange(then, now)` for the same pair. It is
 * only read when the figures are not a Same_Figure and a now figure exists.
 * `letterKind` decides between `single` (persona) and `same_period` (live and
 * real) for a Same_Figure. It defaults to `"persona"`, so existing callers keep
 * the spec 12 Z2 view.
 */
export function receiptKindFor(
  then: Readonly<FigureV1>,
  now: Readonly<FigureV1> | undefined,
  change: ChangeResult | undefined,
  letterKind: LetterKind = "persona",
): ReceiptKind {
  if (now === undefined) {
    return "no_now";
  }
  if (isSameFigure(then as FigureV1, now as FigureV1)) {
    return letterKind === "persona" ? "single" : "same_period";
  }
  if (change !== undefined && change.comparable) {
    return "compared";
  }
  return "not_comparable";
}

/** The change line shows only on a compared card (spec 14 R7.4). */
export function showsChangeLine(kind: ReceiptKind): boolean {
  return kind === "compared";
}
