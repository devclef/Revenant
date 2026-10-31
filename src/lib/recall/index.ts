/**
 * Public surface of the recall feature (design.md "Recall_Generator" and
 * "Recall_Record").
 *
 * This is a thin barrel with no logic: it re-exports the recall question
 * generator and the recall record schema so callers import from one place. It
 * imports nothing from src/lib/crypto or src/lib/db and is pure, so it is safe
 * to import from either the browser or the server.
 */

export {
  generateRecallQuestions,
  checkRecallSubject,
  RecallInputError,
} from "./generate";
export type {
  RecallQuestionV1,
  RecallInput,
  RecallSubjectProblem,
} from "./generate";

export {
  recallRecordV1Schema,
  recallRecordSchemaFor,
  buildRecallRecord,
} from "./record";
export type { RecallRecordV1, Draft } from "./record";

export { BANNED_DIRECTION_WORDS } from "./banned-words";
