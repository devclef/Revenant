// Sealed payload, format version 2 (encrypted content of a letter).
//
// Version 2 is version 1 plus one change: every text (author) recall question
// carries the author's `sealed_answer`, the answer written on the sealing day.
// Every other field keeps the meaning it has in version 1. The v1 module is
// FROZEN and is not changed by this module; the primitives below are copies of
// the v1 ones so that a later edit to one version cannot move the other. See
// .kiro/specs/15-the-flow/design.md "1. Sealed format version 2" and crypto.md.
//
// Every object is a strict object so an unknown field is rejected rather than
// silently dropped, which keeps the canonical form (and so the envelope hash)
// stable.
//
// This module imports nothing from src/lib/crypto or src/lib/db. It is pure and
// safe to import from either the browser or the server.

import { z } from "zod";
import { figureV1Schema, metricDefinitionV1Schema } from "../v1/payload";

// --- Primitive field schemas -------------------------------------------------

// String fields whose length is not otherwise sized by the spec: id, metric_id,
// unit, region, period. 1-200 characters.
const shortString = z.string().min(1).max(200);

// letter_text: 1-5,000 code points (counted with [...s].length so astral
// characters count once), and not whitespace-only.
const letterText = z
  .string()
  .refine(
    (s) => {
      const len = [...s].length;
      return len >= 1 && len <= 5000;
    },
    { message: "letter_text must be 1-5,000 code points" },
  )
  .refine((s) => s.trim().length > 0, {
    message: "letter_text must not be whitespace-only",
  });

// written_as_of: optional YYYY-MM-DD calendar date. The refine builds a UTC date
// and checks it round-trips, which rejects impossible dates such as 2024-02-30.
const writtenAsOf = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) => {
      // Zod runs this refine even when the regex above failed, so `s` may be
      // malformed. Treat an invalid one as a rejection rather than letting
      // Date#toISOString throw.
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      if (m === null) return false;
      const [, y, mo, d] = m.map(Number);
      const date = new Date(Date.UTC(y, mo - 1, d));
      if (Number.isNaN(date.getTime())) return false;
      return date.toISOString().slice(0, 10) === s;
    },
    { message: "written_as_of is not a real calendar date" },
  );

// Recall question text: 1-500 characters.
const questionText = z.string().min(1).max(500);

// sealed_answer: the author's answer, 1-1,000 code points, and not only
// whitespace. Counted with [...s].length, as letter_text is.
const sealedAnswer = z
  .string()
  .refine(
    (s) => {
      const len = [...s].length;
      return len >= 1 && len <= 1000;
    },
    { message: "sealed_answer must be 1-1,000 code points" },
  )
  .refine((s) => s.trim().length > 0, {
    message: "sealed_answer must not be whitespace-only",
  });

// --- Recall questions --------------------------------------------------------

// A number question is unchanged from version 1: it requires a metric_id and
// carries no answer.
const numberQuestionSchema = z.strictObject({
  id: shortString,
  answer_type: z.literal("number"),
  text: questionText,
  metric_id: shortString,
});

// A text question requires the sealed answer in version 2. Its metric_id stays
// optional, as in version 1.
const textQuestionSchema = z.strictObject({
  id: shortString,
  answer_type: z.literal("text"),
  text: questionText,
  metric_id: shortString.optional(),
  sealed_answer: sealedAnswer,
});

const recallQuestionSchema = z.discriminatedUnion("answer_type", [
  numberQuestionSchema,
  textQuestionSchema,
]);

// --- Root schema -------------------------------------------------------------

const payloadBaseSchema = z.strictObject({
  format_version: z.literal(2),
  letter_text: letterText,
  written_as_of: writtenAsOf.optional(),
  metrics: z.array(metricDefinitionV1Schema).max(50),
  figures: z.array(figureV1Schema).max(50),
  recall_questions: z.array(recallQuestionSchema).max(20),
});

// Cross-reference and uniqueness checks, the same as version 1, reporting the
// path of the first offending item so the caller can surface which field failed.
export const payloadV2Schema = payloadBaseSchema.superRefine((payload, ctx) => {
  // Unique metric ids.
  const metricIds = new Set<string>();
  for (let i = 0; i < payload.metrics.length; i++) {
    const id = payload.metrics[i].id;
    if (metricIds.has(id)) {
      ctx.addIssue({
        code: "custom",
        message: "duplicate metric id",
        path: ["metrics", i, "id"],
      });
      return;
    }
    metricIds.add(id);
  }

  // Every figure's metric_id must match a declared metric.
  for (let i = 0; i < payload.figures.length; i++) {
    if (!metricIds.has(payload.figures[i].metric_id)) {
      ctx.addIssue({
        code: "custom",
        message: "figure metric_id does not match any metric",
        path: ["figures", i, "metric_id"],
      });
      return;
    }
  }

  // Unique recall-question ids.
  const questionIds = new Set<string>();
  for (let i = 0; i < payload.recall_questions.length; i++) {
    const id = payload.recall_questions[i].id;
    if (questionIds.has(id)) {
      ctx.addIssue({
        code: "custom",
        message: "duplicate recall question id",
        path: ["recall_questions", i, "id"],
      });
      return;
    }
    questionIds.add(id);
  }

  // A number question's metric_id must match a declared metric.
  for (let i = 0; i < payload.recall_questions.length; i++) {
    const q = payload.recall_questions[i];
    if (q.answer_type === "number" && !metricIds.has(q.metric_id)) {
      ctx.addIssue({
        code: "custom",
        message: "recall question metric_id does not match any metric",
        path: ["recall_questions", i, "metric_id"],
      });
      return;
    }
  }
});

export type PayloadV2 = z.infer<typeof payloadV2Schema>;
export type RecallQuestionV2 = PayloadV2["recall_questions"][number];
export type TextRecallQuestionV2 = Extract<
  RecallQuestionV2,
  { answer_type: "text" }
>;

/**
 * The author's sealed answer to a version 2 recall question. Returns the
 * `sealed_answer` of a text question, and `undefined` for a number question,
 * which carries no answer. The schema above already requires `sealed_answer`
 * on every text question, so a parsed text question always has one.
 */
export function sealedAnswerOf(question: RecallQuestionV2): string | undefined {
  return question.answer_type === "text" ? question.sealed_answer : undefined;
}
