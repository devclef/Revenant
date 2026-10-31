/**
 * Recall_Record (design.md "Recall_Record").
 *
 * The versioned, strict Zod schema that holds a judge's recall answers: for
 * each sealed recall question, either the answer as a decimal string or an
 * explicit "no answer". The record is encrypted with the opening records key
 * and stored through `POST /api/openings`; the operator never reads it.
 *
 * The schema rejects any unknown key (R3.1), accepts a number answer only when,
 * after trimming, it is a 1-40 character non-negative decimal (R3.3), and
 * stores it exactly as typed apart from the trim, with no rounding or
 * reformatting (R3.7). A schema bound to one letter's questions additionally
 * requires every question ID exactly once, with no duplicate and no unknown ID
 * (R3.2).
 *
 * This module imports nothing from src/lib/crypto or src/lib/db. It is pure and
 * safe to import from either the browser or the server.
 */

import { z } from "zod";
import type { RecallQuestionV1 } from "./generate";

/**
 * A number answer: a non-negative decimal string of 1 to 40 characters, made of
 * one or more digits and an optional fractional part of a dot followed by one
 * or more digits (R3.3).
 *
 * `trim()` runs before `max(40)` and `regex`, because Zod v4's `trim()` rewrites
 * the value before later checks run. So `"  3.50 "` is accepted and stored as
 * `"3.50"`, while `"03.50"` stays `"03.50"` (R3.3, R3.7). Nothing else is
 * reformatted.
 */
const numberAnswer = z
  .string()
  .trim()
  .max(40)
  .regex(/^[0-9]+(\.[0-9]+)?$/);

/**
 * One answer entry: either a number answer carrying its decimal string, or an
 * explicit "no answer". Both are strict objects on the discriminant `kind`, so
 * an entry with any extra key is rejected (R3.1).
 */
const answerSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    question_id: z.string().min(1).max(200),
    kind: z.literal("number"),
    value: numberAnswer,
  }),
  z.strictObject({
    question_id: z.string().min(1).max(200),
    kind: z.literal("no_answer"),
  }),
]);

/** One answer as it is stored in the record. */
export type AnswerV1 = z.infer<typeof answerSchema>;

/**
 * Version 1 of the Recall_Record: a strict object with `version` fixed at `1`
 * and up to 20 answers (R3.1). Any extra key is rejected. This base schema does
 * not tie the answers to a particular letter's questions; `recallRecordSchemaFor`
 * adds that (R3.2).
 *
 * This shape is version 1. Any change adds a version 2; v1 is never edited.
 */
export const recallRecordV1Schema = z.strictObject({
  version: z.literal(1),
  answers: z.array(answerSchema).max(20),
});

/** The Recall_Record value, version 1. */
export type RecallRecordV1 = z.infer<typeof recallRecordV1Schema>;

/**
 * The Recall_Record schema bound to one letter's recall questions (R3.2).
 *
 * On top of {@link recallRecordV1Schema} it requires the record's answers to
 * carry every question ID in `questionIds` exactly once: no duplicate ID and no
 * ID that is not a sealed question. The order of the answers is not checked.
 *
 * A value that breaks any of these, or the base schema (wrong version, extra
 * key, bad number answer), is rejected with a validation error and never
 * returned as a partial record (R3.5).
 */
export function recallRecordSchemaFor(
  questionIds: readonly string[],
): z.ZodType<RecallRecordV1> {
  const expected = new Set(questionIds);

  return recallRecordV1Schema.superRefine((record, ctx) => {
    const seen = new Set<string>();
    for (const answer of record.answers) {
      if (!expected.has(answer.question_id)) {
        ctx.addIssue({
          code: "custom",
          message: `answer for unknown question id: ${answer.question_id}`,
          path: ["answers"],
        });
      } else if (seen.has(answer.question_id)) {
        ctx.addIssue({
          code: "custom",
          message: `duplicate answer for question id: ${answer.question_id}`,
          path: ["answers"],
        });
      }
      seen.add(answer.question_id);
    }

    for (const id of expected) {
      if (!seen.has(id)) {
        ctx.addIssue({
          code: "custom",
          message: `missing answer for question id: ${id}`,
          path: ["answers"],
        });
      }
    }
  }) as z.ZodType<RecallRecordV1>;
}

/**
 * One judge's in-progress input for a recall question: the text they typed and
 * whether they picked the "no answer" control. Keyed by question ID in the
 * Opening_Flow's drafts map.
 */
export type Draft = { text: string; noAnswer: boolean };

/**
 * Assemble a {@link RecallRecordV1} from the sealed questions and the judge's
 * drafts, in payload (question) order (R3.4, R8.3, R8.4).
 *
 * For each question, in order:
 * - if its draft has `noAnswer: true`, it becomes `{ kind: "no_answer" }`,
 *   whatever the text holds;
 * - otherwise the text is trimmed and must match the R3.3 number pattern; an
 *   empty text without the toggle, or any non-matching text, makes the question
 *   invalid.
 *
 * A question with no draft is treated as empty text and not "no answer", so it
 * is invalid unless answered. The assembled record is validated with
 * {@link recallRecordSchemaFor} before it is returned.
 *
 * On success returns `{ ok: true, record }`. If any question is invalid,
 * returns `{ ok: false, invalid }` with the question IDs that failed, in order.
 * The drafts are never mutated.
 */
export function buildRecallRecord(
  questions: readonly RecallQuestionV1[],
  drafts: Readonly<Record<string, Draft>>,
): { ok: true; record: RecallRecordV1 } | { ok: false; invalid: string[] } {
  const answers: AnswerV1[] = [];
  const invalid: string[] = [];

  for (const question of questions) {
    const draft = drafts[question.id];

    if (draft?.noAnswer) {
      answers.push({ question_id: question.id, kind: "no_answer" });
      continue;
    }

    const trimmed = (draft?.text ?? "").trim();
    const parsed = numberAnswer.safeParse(trimmed);
    if (!parsed.success) {
      invalid.push(question.id);
      continue;
    }

    answers.push({
      question_id: question.id,
      kind: "number",
      value: parsed.data,
    });
  }

  if (invalid.length > 0) {
    return { ok: false, invalid };
  }

  const schema = recallRecordSchemaFor(questions.map((q) => q.id));
  const result = schema.safeParse({ version: 1, answers });
  if (!result.success) {
    return {
      ok: false,
      invalid: result.error.issues.map((issue) => issue.message),
    };
  }

  return { ok: true, record: result.data };
}
