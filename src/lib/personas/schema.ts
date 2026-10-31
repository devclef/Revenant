// Persona_List schema and cross-checks (design.md "Persona_List", R1.3, R1.5,
// R2.4, R5.2).
//
// A Zod schema validates each persona's field shapes, and a superRefine runs
// the cross-persona and cross-field checks that a per-field schema can't
// express: letter IDs and keys are unique, each metric exists in the demo
// catalogue, each recall subject is acceptable for that metric, opens_at is
// later than written_as_of, and no current letter ID is also retired. Issues
// carry paths like `personas.0.metrics.1.metric_id` so a test can name the
// offending persona and field (R1.5).
//
// This module is pure: it imports only Zod and sibling pure libraries. It must
// NOT import any .txt file or node:fs — letter text is read elsewhere, by the
// tests and the sealing script.

import { z } from "zod";

import { isLetterId } from "@/lib/seal-format";
import { isRealDate } from "@/lib/figures";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import { checkRecallSubject } from "@/lib/recall";

// --- Field schemas -----------------------------------------------------------

// key: a URL segment. Lowercase alphanumerics in hyphen-separated groups, with
// no leading, trailing or doubled hyphen, 1-40 characters.
const keySchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

// display_name and region: 1-60 characters.
const nameSchema = z.string().min(1).max(60);

// letter_id: a canonical unpadded-base64url encoding of 16 bytes (22 chars).
const letterIdSchema = z.string().refine(isLetterId, {
  message: "letter_id must be 22 base64url characters decoding to 16 bytes",
});

// written_as_of: a real YYYY-MM-DD calendar date.
const writtenAsOfSchema = z.string().refine(isRealDate, {
  message: "written_as_of must be a real YYYY-MM-DD date",
});

// opens_at: a millisecond-precision UTC instant that round-trips through Date.
const opensAtSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, {
    message: "opens_at must be YYYY-MM-DDTHH:mm:ss.sssZ",
  })
  .refine((s) => new Date(s).toISOString() === s, {
    message: "opens_at must be a real instant",
  });

// letter_path: a .txt file inside the letters/ folder, no path escape.
const letterPathSchema = z.string().regex(/^letters\/[a-z0-9-]+\.txt$/, {
  message: "letter_path must match letters/<name>.txt",
});

const metricSchema = z.strictObject({
  metric_id: z.string().min(1),
  recall_subject: z.string().min(1),
});

const personaSchema = z.strictObject({
  key: keySchema,
  display_name: nameSchema,
  region: nameSchema,
  letter_id: letterIdSchema,
  written_as_of: writtenAsOfSchema,
  opens_at: opensAtSchema,
  metrics: z.array(metricSchema).min(1).max(20),
  letter_path: letterPathSchema,
});

export type Persona = z.infer<typeof personaSchema>;

const personaListBaseSchema = z.strictObject({
  personas: z.array(personaSchema),
  retired_letter_ids: z.array(z.string()),
});

export type PersonaList = z.infer<typeof personaListBaseSchema>;

// --- Cross-checks ------------------------------------------------------------

export const personaListSchema = personaListBaseSchema.superRefine(
  (list, ctx) => {
    const seenKeys = new Set<string>();
    const seenLetterIds = new Set<string>();

    for (let i = 0; i < list.personas.length; i++) {
      const persona = list.personas[i];

      // Unique keys (R1.5).
      if (seenKeys.has(persona.key)) {
        ctx.addIssue({
          code: "custom",
          message: "duplicate persona key",
          path: ["personas", i, "key"],
        });
      } else {
        seenKeys.add(persona.key);
      }

      // Unique letter IDs (R1.5).
      if (seenLetterIds.has(persona.letter_id)) {
        ctx.addIssue({
          code: "custom",
          message: "duplicate letter_id",
          path: ["personas", i, "letter_id"],
        });
      } else {
        seenLetterIds.add(persona.letter_id);
      }

      // opens_at must be later than written_as_of midnight UTC (R1.5).
      const writtenMidnight = `${persona.written_as_of}T00:00:00.000Z`;
      if (Date.parse(persona.opens_at) <= Date.parse(writtenMidnight)) {
        ctx.addIssue({
          code: "custom",
          message: "opens_at must be later than written_as_of midnight UTC",
          path: ["personas", i, "opens_at"],
        });
      }

      // Metrics: unique metric_id, each present in DEMO_FIGURES.series, and
      // each recall_subject acceptable for that series' metric (R1.5, R2.4).
      const seenMetricIds = new Set<string>();
      for (let j = 0; j < persona.metrics.length; j++) {
        const metric = persona.metrics[j];

        if (seenMetricIds.has(metric.metric_id)) {
          ctx.addIssue({
            code: "custom",
            message: "duplicate metric_id",
            path: ["personas", i, "metrics", j, "metric_id"],
          });
          continue;
        }
        seenMetricIds.add(metric.metric_id);

        const series = DEMO_FIGURES.series.get(metric.metric_id);
        if (series === undefined) {
          ctx.addIssue({
            code: "custom",
            message: "metric_id is not in DEMO_FIGURES",
            path: ["personas", i, "metrics", j, "metric_id"],
          });
          continue;
        }

        const problem = checkRecallSubject(metric.recall_subject, series.metric);
        if (problem !== null) {
          ctx.addIssue({
            code: "custom",
            message: `recall_subject rejected: ${problem}`,
            path: ["personas", i, "metrics", j, "recall_subject"],
          });
        }
      }
    }

    // retired_letter_ids: no current letter ID appears in it, and no id appears
    // twice across both lists (R5.2).
    const seenRetired = new Set<string>();
    for (let i = 0; i < list.retired_letter_ids.length; i++) {
      const id = list.retired_letter_ids[i];

      if (seenLetterIds.has(id)) {
        ctx.addIssue({
          code: "custom",
          message: "retired_letter_ids contains a current letter_id",
          path: ["retired_letter_ids", i],
        });
      }
      if (seenRetired.has(id)) {
        ctx.addIssue({
          code: "custom",
          message: "duplicate id in retired_letter_ids",
          path: ["retired_letter_ids", i],
        });
      } else {
        seenRetired.add(id);
      }
    }
  },
);

/**
 * Parse and validate a raw Persona_List value. Throws a ZodError whose issues
 * carry paths like `personas.0.metrics.1.metric_id`, so a caller can name the
 * offending persona and field.
 */
export function parsePersonaList(raw: unknown): PersonaList {
  return personaListSchema.parse(raw);
}
