// Receipts helpers (spec 15 R12.2). Pure functions, no state and no clock.
//
// The receipts column shows each author question beside two answers: what the
// reader remembers now, and the answer sealed with the question. These helpers
// only pick the text to show. They never compare the two, score the gap or
// rewrite either text (neutrality.md, spec 15 R12.3).

import type { RecallRecordV1, RecallRecordV2 } from "@/lib/recall";
import type { RecallQuestion } from "./opening-machine";
import { REVEAL_COPY } from "./copy";

/**
 * The answer sealed with an author question, or `undefined` when the letter is
 * version 1 (no sealed answer) or the question is a number question.
 */
export function sealedAnswerOf(question: RecallQuestion): string | undefined {
  if (question.answer_type !== "text") return undefined;
  return "sealed_answer" in question ? question.sealed_answer : undefined;
}

/**
 * The reader's testimony for one author question, as the text the receipts
 * show. A text answer shows its words. "I don't remember" is stored as
 * `no_answer` on a text question, so it shows the same words the reader chose.
 * No stored answer shows "No answer".
 */
export function testimonyTextOf(
  record: RecallRecordV1 | RecallRecordV2 | null,
  questionId: string,
): string {
  const answer = record?.answers.find(
    (entry) => entry.question_id === questionId,
  );
  if (answer === undefined) return REVEAL_COPY.noAnswer;
  if (answer.kind === "text") return answer.value;
  if (answer.kind === "no_answer") return REVEAL_COPY.dontRemember;
  return REVEAL_COPY.noAnswer;
}

/**
 * The label above the sealed answer. A live letter dates it by the sealing day.
 * A persona dates it "as of" its written day, and has no sealing day to show, so
 * an undated persona letter gets the label without a date.
 */
export function sealedLabelOf(persona: boolean, date: string): string {
  if (!persona) return REVEAL_COPY.receiptsWrote.replace("{date}", date);
  if (date === "") return REVEAL_COPY.receiptsWroteUndatedPersona;
  return REVEAL_COPY.receiptsWrotePersona.replace("{date}", date);
}
