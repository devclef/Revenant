/**
 * Recall_Generator (design.md "Recall_Generator").
 *
 * Writes the recall questions that are sealed inside a letter at sealing time.
 * Each question asks the judge to remember what a tracked figure cost "then",
 * without hinting at which way the figure moved: a subject may not carry a
 * digit, the figure's own source or series ID, or any R2.4 direction word.
 *
 * The output is deterministic and depends only on position and the metric's
 * `id`. No other metric field reaches the question text (R2.1-R2.5). The fixed
 * sentence template contains none of the banned words, so a generated question
 * always satisfies the same R2.4 rule its subject is checked against.
 *
 * This module imports nothing from src/lib/crypto or src/lib/db. It is pure and
 * safe to import from either the browser or the server. The Opening_Flow never
 * imports it (R2.9); a boundary test enforces that.
 */

import type { PayloadV1, MetricDefinitionV1 } from "@/lib/seal-format";
import { BANNED_DIRECTION_WORDS } from "./banned-words";

/**
 * A recall question exactly as it is sealed, taken from the frozen payload
 * schema rather than redeclared here so the two can never drift.
 */
export type RecallQuestionV1 = PayloadV1["recall_questions"][number];

/** A number question: the only kind this generator produces. */
export type NumberRecallQuestionV1 = Extract<
  RecallQuestionV1,
  { answer_type: "number" }
>;

/**
 * One item to turn into a recall question: a metric definition and the plain
 * subject the question asks about (for example "a gallon of regular gasoline").
 */
export type RecallInput = {
  metric: MetricDefinitionV1;
  recall_subject: string;
};

/**
 * Why a recall subject was rejected. Each value names one rule from
 * {@link checkRecallSubject}, so an error can say exactly what was wrong.
 */
export type RecallSubjectProblem =
  | "empty"
  | "too_long"
  | "contains_exclamation"
  | "contains_digit"
  | "contains_source"
  | "contains_series_id"
  | "contains_banned_word";

/** The maximum length of a recall subject, in UTF-16 code units. */
const MAX_SUBJECT_LENGTH = 100;

/** The maximum number of items {@link generateRecallQuestions} accepts. */
const MAX_ITEMS = 20;

/**
 * Whole-word, case-insensitive matcher for the R2.4 direction words. Compiled
 * once from {@link BANNED_DIRECTION_WORDS}. `\b` boundaries mean a banned word
 * only matches on its own, so "upland" and "dropout" are allowed (R2.4).
 */
const BANNED_WORD_RE = new RegExp(
  `\\b(?:${BANNED_DIRECTION_WORDS.join("|")})\\b`,
  "i",
);

/** A single digit anywhere in the subject. Covers figure values and periods. */
const DIGIT_RE = /[0-9]/;

/**
 * Check one recall subject against the metric it belongs to.
 *
 * Returns the first {@link RecallSubjectProblem} the subject hits, or `null`
 * when the subject is acceptable. The checks run in a fixed order so the
 * reported problem is stable.
 *
 * A subject is rejected when it (R2.4):
 * - has no non-whitespace character, or is longer than 100 characters;
 * - contains `!`;
 * - contains any digit;
 * - contains the metric's `source` or `series_id` (case-insensitive substring);
 * - contains a banned direction word as a whole word, case-insensitive.
 */
export function checkRecallSubject(
  subject: string,
  metric: MetricDefinitionV1,
): RecallSubjectProblem | null {
  if (subject.trim().length === 0) return "empty";
  if (subject.length > MAX_SUBJECT_LENGTH) return "too_long";
  if (subject.includes("!")) return "contains_exclamation";
  if (DIGIT_RE.test(subject)) return "contains_digit";

  const lowerSubject = subject.toLowerCase();
  if (lowerSubject.includes(metric.source.toLowerCase())) {
    return "contains_source";
  }
  if (lowerSubject.includes(metric.series_id.toLowerCase())) {
    return "contains_series_id";
  }
  if (BANNED_WORD_RE.test(subject)) return "contains_banned_word";

  return null;
}

/**
 * Thrown by {@link generateRecallQuestions} when an input cannot be turned into
 * valid recall questions. The message is fixed and names the problem and, where
 * one applies, the zero-based item index, so callers surface which item failed
 * without leaking any subject text (R2.6).
 */
export class RecallInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecallInputError";
  }
}

/**
 * Map a {@link RecallSubjectProblem} to the fixed phrase used in the error
 * message. Kept here so the wording stays in one place.
 */
function describeProblem(problem: RecallSubjectProblem): string {
  switch (problem) {
    case "empty":
      return "subject has no non-whitespace character";
    case "too_long":
      return "subject is longer than 100 characters";
    case "contains_exclamation":
      return "subject contains an exclamation mark";
    case "contains_digit":
      return "subject contains a digit";
    case "contains_source":
      return "subject contains the metric source";
    case "contains_series_id":
      return "subject contains the metric series id";
    case "contains_banned_word":
      return "subject contains a banned direction word";
  }
}

/**
 * Turn 0 to 20 {@link RecallInput}s into the number recall questions that are
 * sealed into a letter, one per item in order.
 *
 * Each question is `{ id: "q" + (i + 1), answer_type: "number", metric_id:
 * metric.id, text: "What do you think <subject> cost then?" }`, where
 * `<subject>` is the trimmed recall subject. No metric field other than `id`
 * reaches the output (R2.1-R2.3). The IDs depend only on position, so the
 * output is deterministic (R2.5).
 *
 * Throws {@link RecallInputError} with a fixed message for: more than 20 items,
 * a duplicate metric id, or any subject problem (R2.6). It returns nothing in
 * that case.
 */
export function generateRecallQuestions(
  items: readonly RecallInput[],
): NumberRecallQuestionV1[] {
  if (items.length > MAX_ITEMS) {
    throw new RecallInputError(
      `too many items: ${items.length} given, at most ${MAX_ITEMS} allowed`,
    );
  }

  const seenMetricIds = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    const { metric, recall_subject } = items[i];

    if (seenMetricIds.has(metric.id)) {
      throw new RecallInputError(`duplicate metric id at item ${i}`);
    }
    seenMetricIds.add(metric.id);

    const problem = checkRecallSubject(recall_subject, metric);
    if (problem !== null) {
      throw new RecallInputError(`${describeProblem(problem)} at item ${i}`);
    }
  }

  return items.map((item, i) => ({
    id: `q${i + 1}`,
    answer_type: "number" as const,
    metric_id: item.metric.id,
    text: `What do you think ${item.recall_subject.trim()} cost then?`,
  }));
}
