// Sample_Candidates for the persona figure questions (spec 10 design.md,
// "C5. Sample answers"; requirements C5.1 to C5.3, C5.11).
//
// content/personas/letters/samples.json holds, per persona and per tracked
// metric, the 3 to 5 candidate answers a judge can start from. The file is not
// sealed. It is checked strictly at import, so a bad file fails the build and
// the tests instead of reaching a judge:
//   - every persona metric has a list, and no list names a metric the persona
//     does not track or a persona that does not exist (C5.1);
//   - each list holds 3 to 5 distinct candidates (C5.1);
//   - each candidate is a non-negative decimal with exactly SAMPLE_DECIMALS
//     decimal places, is a value that the Recall_Number_Parser reads back as
//     the same text, and passes the v1 number rule (C5.3).
//
// The Spread_Rule and the Record_Candidate need the sealed Then_Value, so they
// are checked against DEMO_FIGURES in the tests, not here.
//
// Pure module: imports the persona list, Zod and the recall number parser only.

import { z } from "zod";

import { parseRecallNumber } from "@/components/ceremony/recall/parse-number";

import rawSampleCandidates from "../../../content/personas/letters/samples.json";

import { parsePersonaList, type Persona } from "./schema";
import rawPersonaList from "../../../content/personas/personas.json";

/** Fewest candidates a Figure_Question may hold (C5.1). */
export const SAMPLE_CANDIDATES_MIN = 3;
/** Most candidates a Figure_Question may hold (C5.1). */
export const SAMPLE_CANDIDATES_MAX = 5;
/** Decimal places every candidate is written with (C5.3). */
export const SAMPLE_DECIMALS = 2;

/** A candidate written with exactly SAMPLE_DECIMALS decimal places. */
const TWO_DECIMALS = new RegExp(`^[0-9]+\\.[0-9]{${SAMPLE_DECIMALS}}$`);
/** The v1 Recall_Record number rule (record.ts numberAnswer). */
const V1_NUMBER = /^[0-9]+(\.[0-9]+)?$/;
/** The longest canonical value the Recall_Record accepts (record-v2 limit). */
const MAX_CANONICAL_LENGTH = 40;

const candidateSchema = z
  .string()
  .max(MAX_CANONICAL_LENGTH)
  .regex(TWO_DECIMALS, "a candidate needs exactly two decimal places")
  .regex(V1_NUMBER, "a candidate must pass the Recall_Record number rule");

const candidateListSchema = z
  .array(candidateSchema)
  .min(SAMPLE_CANDIDATES_MIN)
  .max(SAMPLE_CANDIDATES_MAX)
  .superRefine((list, ctx) => {
    if (new Set(list).size !== list.length) {
      ctx.addIssue({
        code: "custom",
        message: "candidates in one list must be distinct",
      });
    }
    for (const candidate of list) {
      const parsed = parseRecallNumber(candidate);
      if (parsed.kind !== "value" || parsed.value !== candidate) {
        ctx.addIssue({
          code: "custom",
          message: `candidate ${JSON.stringify(candidate)} is not read back as itself`,
        });
      }
    }
  });

const sampleFileSchema = z.record(
  z.string(),
  z.record(z.string(), candidateListSchema),
);

/** Persona key → metric ID → candidates, as validated. */
export type SampleCandidates = Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
>;

/**
 * Validate a raw sample file against the persona list. Throws on the first
 * failure: a malformed value (ZodError) or a persona metric with no list, a
 * list for an unknown persona, or a list for a metric its persona does not
 * track (RangeError).
 */
export function parseSampleCandidates(
  raw: unknown,
  personas: readonly Persona[],
): SampleCandidates {
  const parsed = sampleFileSchema.parse(raw);

  const tracked = new Map<string, Set<string>>();
  for (const persona of personas) {
    tracked.set(
      persona.key,
      new Set(persona.metrics.map((metric) => metric.metric_id)),
    );
  }

  for (const [personaKey, byMetric] of Object.entries(parsed)) {
    const metrics = tracked.get(personaKey);
    if (metrics === undefined) {
      throw new RangeError(`samples name an unknown persona: ${personaKey}`);
    }
    for (const metricId of Object.keys(byMetric)) {
      if (!metrics.has(metricId)) {
        throw new RangeError(
          `samples for ${personaKey} name a metric it does not track: ${metricId}`,
        );
      }
    }
  }

  for (const persona of personas) {
    const byMetric = parsed[persona.key] ?? {};
    for (const metric of persona.metrics) {
      if (!Object.hasOwn(byMetric, metric.metric_id)) {
        throw new RangeError(
          `no sample candidates for ${persona.key} metric ${metric.metric_id}`,
        );
      }
    }
  }

  return deepFreeze(parsed);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

const PERSONA_LIST = parsePersonaList(rawPersonaList);

/**
 * The validated sample candidates for every persona metric. Validated once at
 * import against the persona list; a bad file throws here.
 */
export const SAMPLE_CANDIDATES: SampleCandidates = parseSampleCandidates(
  rawSampleCandidates,
  PERSONA_LIST.personas,
);

/**
 * The candidates for one persona, keyed by metric ID, to pass to the opening
 * flow. An unknown key gets an empty object, so no field is prefilled.
 */
export function sampleCandidatesFor(
  personaKey: string,
): Readonly<Record<string, readonly string[]>> {
  return Object.hasOwn(SAMPLE_CANDIDATES, personaKey)
    ? SAMPLE_CANDIDATES[personaKey]
    : {};
}
