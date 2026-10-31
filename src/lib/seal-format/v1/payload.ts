// Sealed payload, format version 1 (encrypted content of a letter).
//
// This schema is FROZEN. Never change the meaning of version 1; a later change
// is format version 2 with its own module. See design.md "Data Models" and
// crypto.md. Every object is a strict object so an unknown field is rejected
// rather than silently dropped, which keeps the canonical form (and so the
// envelope hash) stable.
//
// This module imports nothing from src/lib/crypto or src/lib/db. It is pure and
// safe to import from either the browser or the server.

import { z } from "zod";

// --- Primitive field schemas -------------------------------------------------

// String fields whose length is not otherwise sized by the spec: id, metric_id,
// display_name, unit, region, source, series_id, period. 1-200 characters.
const shortString = z.string().min(1).max(200);

// A figure value: the number exactly as published, kept as a string so no
// precision is lost. "^-?[0-9]+(\.[0-9]+)?$": optional leading minus, digits,
// optional fractional part. No exponent, no '+', no thousands separator, no
// surrounding whitespace. At most 40 characters.
const figureValue = z
  .string()
  .max(40)
  .regex(/^-?[0-9]+(\.[0-9]+)?$/);

// retrieved_at: an ISO-8601 UTC instant kept as the published string. It must
// match the fixed shape and parse to a real date.
const retrievedAt = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/)
  .refine((s) => !Number.isNaN(Date.parse(s)), {
    message: "retrieved_at is not a valid date",
  });

// written_as_of: optional YYYY-MM-DD calendar date. The refine builds a UTC
// date and checks it round-trips, which rejects impossible dates such as
// 2024-02-30, 2023-02-29 and month 13. The "not later than sealedAt" rule needs
// the header and is enforced by sealLetter, not here.
const writtenAsOf = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    // Zod runs this refine even when the regex above failed, so `s` may be a
    // malformed string here. Build the date defensively and treat an invalid
    // one (e.g. 2024-02-30, or a non-matching shape) as a rejection rather than
    // letting Date#toISOString throw.
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m === null) return false;
    const [, y, mo, d] = m.map(Number);
    const date = new Date(Date.UTC(y, mo - 1, d));
    if (Number.isNaN(date.getTime())) return false;
    return date.toISOString().slice(0, 10) === s;
  }, { message: "written_as_of is not a real calendar date" });

// --- Object schemas ----------------------------------------------------------

const metricSchema = z.strictObject({
  id: shortString,
  display_name: shortString,
  unit: shortString,
  region: shortString,
  source: shortString,
  series_id: shortString,
});

// Figures are a discriminated union on `kind`. An official figure carries an
// https source_url (<= 2048 chars). A self-reported figure must use the fixed
// source "self-reported" and has no source_url field at all; because the object
// is strict, a self-reported figure carrying source_url is rejected.
const officialFigureSchema = z.strictObject({
  kind: z.literal("official"),
  metric_id: shortString,
  value: figureValue,
  unit: shortString,
  region: shortString,
  period: shortString,
  source: shortString,
  series_id: shortString,
  retrieved_at: retrievedAt,
  source_url: z.string().max(2048).regex(/^https:\/\//),
});

const selfReportedFigureSchema = z.strictObject({
  kind: z.literal("self-reported"),
  metric_id: shortString,
  value: figureValue,
  unit: shortString,
  region: shortString,
  period: shortString,
  source: z.literal("self-reported"),
  series_id: shortString,
  retrieved_at: retrievedAt,
});

const figureSchema = z.discriminatedUnion("kind", [
  officialFigureSchema,
  selfReportedFigureSchema,
]);

// Recall questions are a discriminated union on `answer_type`. A number
// question requires a metric_id (its unit and region come from that metric). A
// text question's metric_id is optional. Question text is 1-500 characters.
const questionText = z.string().min(1).max(500);

const numberQuestionSchema = z.strictObject({
  id: shortString,
  answer_type: z.literal("number"),
  text: questionText,
  metric_id: shortString,
});

const textQuestionSchema = z.strictObject({
  id: shortString,
  answer_type: z.literal("text"),
  text: questionText,
  metric_id: shortString.optional(),
});

const recallQuestionSchema = z.discriminatedUnion("answer_type", [
  numberQuestionSchema,
  textQuestionSchema,
]);

// letter_text: 1-5,000 code points (counted with [...s].length so astral
// characters count once), and not whitespace-only.
const letterText = z
  .string()
  .refine((s) => {
    const len = [...s].length;
    return len >= 1 && len <= 5000;
  }, { message: "letter_text must be 1-5,000 code points" })
  .refine((s) => s.trim().length > 0, {
    message: "letter_text must not be whitespace-only",
  });

// --- Root schema -------------------------------------------------------------

const payloadBaseSchema = z.strictObject({
  format_version: z.literal(1),
  letter_text: letterText,
  written_as_of: writtenAsOf.optional(),
  metrics: z.array(metricSchema).max(50),
  figures: z.array(figureSchema).max(50),
  recall_questions: z.array(recallQuestionSchema).max(20),
});

// Cross-reference and uniqueness checks, reporting the path of the first
// offending item so the caller can surface which field failed.
export const payloadV1Schema = payloadBaseSchema.superRefine((payload, ctx) => {
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

export type PayloadV1 = z.infer<typeof payloadV1Schema>;

// Single-figure and single-metric schemas, for code that validates figures and
// metric definitions on their own (spec 02-demo-figures). These are the same
// schema objects payloadV1Schema uses, not copies, so they can never drift.
export const figureV1Schema = figureSchema;
export const metricDefinitionV1Schema = metricSchema;
export type FigureV1 = z.infer<typeof figureV1Schema>;
export type MetricDefinitionV1 = z.infer<typeof metricDefinitionV1Schema>;
