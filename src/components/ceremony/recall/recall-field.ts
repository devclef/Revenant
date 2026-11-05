// Field state for the recall number input (spec 08 design.md, "Field state", R32).
//
// The judge's typed text lives in the pager. The draft only ever receives the
// canonical value or "". An ambiguous, unreadable or too-long entry therefore
// never reaches the Recall_Record as a guessed number.
//
// Pure module: each function takes the previous state and returns the next one.

import type { Draft } from "@/lib/recall/record";
import {
  parseRecallNumber,
  type RecallNumberParse,
} from "./parse-number";

/** The reading the judge picked for an Ambiguous_Input. */
export type Reading = "decimal" | "grouping";

/** Everything the pager keeps for one recall number field. */
export type FieldState = {
  /** The text in the input, as typed. */
  typed: string;
  /** The parse of `typed`. */
  parse: RecallNumberParse;
  /** The picked reading, set only while `parse` is ambiguous. */
  pick: Reading | null;
  /** The canonical value the Mark sits on, or null when no Mark is drawn. */
  mark: string | null;
};

/** The canonical value of a parse, or null when it has none. */
function valueOf(parse: RecallNumberParse): string | null {
  return parse.kind === "value" ? parse.value : null;
}

/** The field for a draft: the typed text is the draft text, the Mark is its value. */
export function initialField(draft: Draft): FieldState {
  const parse = parseRecallNumber(draft.text);
  return {
    typed: draft.text,
    parse,
    pick: null,
    mark: valueOf(parse),
  };
}

/**
 * The field after the judge types. The pick is dropped (R32.12). The Mark
 * moves for a value, clears for an empty field, and otherwise stays where it
 * was (R32.5, R32.7).
 */
export function typeText(prev: FieldState, text: string): FieldState {
  const parse = parseRecallNumber(text);
  let mark = prev.mark;
  if (parse.kind === "value") mark = parse.value;
  else if (parse.kind === "rejected" && parse.reason === "empty") mark = null;
  return { typed: text, parse, pick: null, mark };
}

/**
 * The field after the judge picks one reading of an Ambiguous_Input (R32.6).
 * Outside an ambiguous parse it changes nothing.
 */
export function pickReading(prev: FieldState, reading: Reading): FieldState {
  if (prev.parse.kind !== "ambiguous") return prev;
  const value =
    reading === "decimal" ? prev.parse.decimal : prev.parse.grouping;
  return { ...prev, pick: reading, mark: value };
}

/**
 * The field after the judge moves the scale. The typed text becomes the
 * canonical value of the new position, and the pick is dropped.
 */
export function setFromScale(prev: FieldState, canonical: string): FieldState {
  return {
    typed: canonical,
    parse: parseRecallNumber(canonical),
    pick: null,
    mark: canonical,
  };
}

/**
 * The value this field resolves to: the parsed value, or the value of the
 * picked reading. Null when the field is unresolved.
 */
export function resolvedValue(s: FieldState): string | null {
  if (s.parse.kind === "value") return s.parse.value;
  if (s.parse.kind === "ambiguous" && s.pick !== null) {
    return s.pick === "decimal" ? s.parse.decimal : s.parse.grouping;
  }
  return null;
}

/** The text the pager sends to the draft: the resolved value, or "". */
export function draftTextFor(s: FieldState): string {
  return resolvedValue(s) ?? "";
}

/** Whether the next control may be used. "No answer" always allows it. */
export function canAdvance(s: FieldState, noAnswer: boolean): boolean {
  return noAnswer || resolvedValue(s) !== null;
}
