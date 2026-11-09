// The Kept_Sample check for the reveal (spec 10 C5.8, Property 17).
//
// A stored number answer is a Kept_Sample when the record marks it with
// `sample: true`. buildRecallRecordV2 sets that flag only when the submitted
// text equals the question's Sample_Answer exactly, so this module only reads
// the flag. It never compares text, and it never judges an answer.

import type { RecallRecordV1, RecallRecordV2 } from "@/lib/recall";
import type { Opened } from "./opening-machine";

type AnswerOf = (RecallRecordV1 | RecallRecordV2)["answers"][number];

/** True when the answer is a number answer carrying the Sample_Flag. */
export function isKeptSample(answer: AnswerOf | undefined): boolean {
  return (
    answer !== undefined &&
    answer.kind === "number" &&
    "sample" in answer &&
    answer.sample === true
  );
}

/**
 * True when the number question about `metricId` was answered with a
 * Kept_Sample. False for no record, no number question, "No answer", or a
 * typed answer that differs from its sample.
 */
export function keptSampleFor(
  metricId: string,
  questions: Opened["payload"]["recall_questions"],
  record: RecallRecordV1 | RecallRecordV2 | undefined,
): boolean {
  if (record === undefined) return false;
  const question = questions.find(
    (q) => q.answer_type === "number" && q.metric_id === metricId,
  );
  if (question === undefined) return false;
  return isKeptSample(
    record.answers.find((a) => a.question_id === question.id),
  );
}
