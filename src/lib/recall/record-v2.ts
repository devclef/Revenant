/**
 * Recall_Record_V2 (design.md "C3. Recall_Record_V2").
 *
 * Version 2 of the Recall_Record. It adds two things to version 1: a Text_Answer
 * (kind `text`, at most 3 per record) and the Sample_Flag (`sample: true` on a
 * number answer that is a Kept_Sample). Version 1 is never edited; a v2 record is
 * a separate schema with `version` fixed at `2`.
 *
 * This module is pure and imports nothing from src/lib/crypto or src/lib/db, so
 * it is safe to import from either the browser or the server.
 */

import { z } from "zod";
import { numberAnswerSchema, type Draft } from "./record";
import { TEXT_ANSWERS_MAX, TEXT_ANSWER_MAX_CODE_POINTS } from "./limits";

/**
 * A Text_Answer value: 1 to 1,000 code points, already trimmed, with at least
 * one non-whitespace character (C3.2). Unlike the number answer, the schema does
 * not trim for the judge; an untrimmed value is rejected, so the stored text is
 * exactly what the builder produced.
 */
const textAnswerValue = z
  .string()
  .refine(
    (s) =>
      s === s.trim() &&
      s.length > 0 &&
      [...s].length <= TEXT_ANSWER_MAX_CODE_POINTS,
    {
      message: `text answer must be 1-${TEXT_ANSWER_MAX_CODE_POINTS} code points, trimmed`,
    },
  );

/**
 * A number answer. It uses the v1 rule (`numberAnswerSchema`, imported from
 * record.ts so the rule has one definition) and may carry the Sample_Flag.
 * `sample` is only accepted as the literal `true`.
 */
const numberAnswerV2 = z.strictObject({
  question_id: z.string().min(1).max(200),
  kind: z.literal("number"),
  value: numberAnswerSchema,
  sample: z.literal(true).optional(),
});

/** A Text_Answer. `sample` is an unknown key here (C3.4). */
const textAnswerV2 = z.strictObject({
  question_id: z.string().min(1).max(200),
  kind: z.literal("text"),
  value: textAnswerValue,
});

/** An explicit "no answer". `sample` is an unknown key here (C3.4). */
const noAnswerV2 = z.strictObject({
  question_id: z.string().min(1).max(200),
  kind: z.literal("no_answer"),
});

const answerV2 = z.discriminatedUnion("kind", [
  numberAnswerV2,
  textAnswerV2,
  noAnswerV2,
]);

/** One answer as it is stored in a version 2 record. */
export type AnswerV2 = z.infer<typeof answerV2>;

/**
 * Version 2 of the Recall_Record: a strict object with `version` fixed at `2`,
 * at most 20 answers and at most {@link TEXT_ANSWERS_MAX} of kind `text`
 * (C3.1, C3.3). Any unknown key, at any level, is rejected.
 */
export const recallRecordV2Schema = z
  .strictObject({
    version: z.literal(2),
    answers: z.array(answerV2).max(20),
  })
  .refine(
    (record) =>
      record.answers.filter((a) => a.kind === "text").length <=
      TEXT_ANSWERS_MAX,
    { message: `at most ${TEXT_ANSWERS_MAX} text answers per record` },
  );

/** The Recall_Record value, version 2. */
export type RecallRecordV2 = z.infer<typeof recallRecordV2Schema>;

/**
 * The question shape the bound schema needs: an ID and the answer type the
 * question was sealed with. A recall question from the sealed payload satisfies
 * this structurally, so this module does not import the seal format.
 */
export type BoundQuestion = {
  id: string;
  answer_type: "number" | "text";
};

/**
 * The Recall_Record_V2 schema bound to one letter's questions (C3.5).
 *
 * On top of {@link recallRecordV2Schema} it requires:
 * - exactly one answer per question ID: no duplicate, and no ID that is not a
 *   sealed question;
 * - for a `text` question, a text answer or "no answer" (not a number answer);
 * - for a `number` question, a number answer or "no answer" (not a text answer).
 *
 * The order of the answers is not checked. A value that breaks any rule is
 * rejected with a validation error and never returned as a partial record.
 */
export function recallRecordV2SchemaFor(
  questions: readonly BoundQuestion[],
): z.ZodType<RecallRecordV2> {
  const typeById = new Map<string, BoundQuestion["answer_type"]>();
  for (const question of questions) {
    typeById.set(question.id, question.answer_type);
  }

  return recallRecordV2Schema.superRefine((record, ctx) => {
    const seen = new Set<string>();
    for (const answer of record.answers) {
      const type = typeById.get(answer.question_id);
      if (type === undefined) {
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
      } else if (answer.kind === "text" && type !== "text") {
        ctx.addIssue({
          code: "custom",
          message: `text answer for a number question id: ${answer.question_id}`,
          path: ["answers"],
        });
      } else if (answer.kind === "number" && type !== "number") {
        ctx.addIssue({
          code: "custom",
          message: `number answer for a text question id: ${answer.question_id}`,
          path: ["answers"],
        });
      }
      seen.add(answer.question_id);
    }

    for (const id of typeById.keys()) {
      if (!seen.has(id)) {
        ctx.addIssue({
          code: "custom",
          message: `missing answer for question id: ${id}`,
          path: ["answers"],
        });
      }
    }
  }) as z.ZodType<RecallRecordV2>;
}

/** The result of {@link buildRecallRecordV2}. */
export type BuildRecallRecordV2Result =
  { ok: true; record: RecallRecordV2 } | { ok: false; invalid: string[] };

/**
 * Assemble a {@link RecallRecordV2} from the sealed questions, the judge's
 * drafts and the sample map, in question order (C3.4, C4.6).
 *
 * For each question:
 * - if its draft has `noAnswer: true`, it becomes `{ kind: "no_answer" }`,
 *   whatever the text holds;
 * - a `text` question takes the trimmed text. It is invalid when the trimmed
 *   text is empty, is over {@link TEXT_ANSWER_MAX_CODE_POINTS} code points, or
 *   would be the fourth text answer;
 * - a `number` question takes the trimmed text under the v1 number rule
 *   (`numberAnswerSchema`). It is invalid when that rule fails. When the
 *   stored value equals `samples[id]` exactly, the answer is a Kept_Sample and
 *   carries `sample: true`; otherwise it carries no flag. The untrimmed draft
 *   text must also equal the sample, so a padded draft is not a sample.
 *
 * `samples` maps a question ID to its Sample_Answer text. A question with no
 * entry is never a Kept_Sample. The drafts are never mutated.
 *
 * Returns `{ ok: true, record }` when every question is answered or marked "no
 * answer". Otherwise returns `{ ok: false, invalid }` with the question IDs
 * that failed, in order. The assembled record is checked against
 * {@link recallRecordV2SchemaFor} before it is returned. The per-question rules
 * above already cover that schema, so a failure there is reported as every
 * question ID.
 */
export function buildRecallRecordV2(
  questions: readonly BoundQuestion[],
  drafts: Readonly<Record<string, Draft>>,
  samples: Readonly<Record<string, string>>,
): BuildRecallRecordV2Result {
  const answers: AnswerV2[] = [];
  const invalid: string[] = [];
  let textAnswers = 0;

  for (const question of questions) {
    const draft = drafts[question.id];

    if (draft?.noAnswer) {
      answers.push({ question_id: question.id, kind: "no_answer" });
      continue;
    }

    const trimmed = (draft?.text ?? "").trim();

    if (question.answer_type === "text") {
      const fits =
        trimmed.length > 0 &&
        [...trimmed].length <= TEXT_ANSWER_MAX_CODE_POINTS &&
        textAnswers < TEXT_ANSWERS_MAX;
      if (!fits) {
        invalid.push(question.id);
        continue;
      }
      textAnswers += 1;
      answers.push({ question_id: question.id, kind: "text", value: trimmed });
      continue;
    }

    const parsed = numberAnswerSchema.safeParse(trimmed);
    if (!parsed.success) {
      invalid.push(question.id);
      continue;
    }

    const value = parsed.data;
    const sample = samples[question.id];
    // A Kept_Sample is the draft exactly as it was offered (C5.8): the untrimmed
    // draft text must equal the Sample_Answer, not only the trimmed value.
    if (
      sample !== undefined &&
      (draft?.text ?? "") === sample &&
      value === sample
    ) {
      answers.push({
        question_id: question.id,
        kind: "number",
        value,
        sample: true,
      });
    } else {
      answers.push({ question_id: question.id, kind: "number", value });
    }
  }

  if (invalid.length > 0) {
    return { ok: false, invalid };
  }

  const result = recallRecordV2SchemaFor(questions).safeParse({
    version: 2,
    answers,
  });
  if (!result.success) {
    return { ok: false, invalid: questions.map((q) => q.id) };
  }

  return { ok: true, record: result.data };
}
