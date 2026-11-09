// The Sample_Pick (spec 10 design.md, "C5. Sample answers"; requirements
// C5.4, C5.6; Property 16).
//
// For one visit, `pickSamples` chooses one stored Sample_Candidate for each
// number question whose metric has candidates. The pick is driven only by the
// injected seed, so tests can fix it. It reads no clock and no Math.random, and
// it never returns a value that is not in the candidate list it was given.

import { mulberry32 } from "@/components/ceremony/scene/rng";
import type { PayloadV1 } from "@/lib/seal-format";

/** A sealed recall question, read from the frozen payload schema. */
export type PickQuestion = PayloadV1["recall_questions"][number];

/** Metric ID to that metric's candidates, as the persona file stores them. */
export type PickCandidates = Readonly<Record<string, readonly string[]>>;

/** Question ID to the one Sample_Answer picked for it. */
export type SampleAnswers = Readonly<Record<string, string>>;

/**
 * Pick one candidate per number question, walking the questions in payload
 * order. A text question, a question whose metric has no candidates, and a
 * metric with an empty list get no entry.
 */
export function pickSamples(
  candidates: PickCandidates,
  questions: readonly PickQuestion[],
  seed: number,
): SampleAnswers {
  const rng = mulberry32(seed);
  const picked: Record<string, string> = {};
  for (const question of questions) {
    if (question.answer_type !== "number") {
      continue;
    }
    if (!Object.hasOwn(candidates, question.metric_id)) {
      continue;
    }
    const list = candidates[question.metric_id];
    if (list === undefined || list.length === 0) {
      continue;
    }
    const candidate = list[Math.floor(rng() * list.length)];
    if (candidate !== undefined) {
      picked[question.id] = candidate;
    }
  }
  return picked;
}
