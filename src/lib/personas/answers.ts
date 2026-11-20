// Pre-written answers for the Text_Persona. Two files share one shape:
//   - content/personas/letters/answers.json: recollections, shown on the Testify
//     step and never sealed. Each is 1-500 code points.
//   - content/personas/letters/sealed-answers.json: the answers sealed with the
//     persona's questions (format v2). Each is 1-1,000 code points.
//
// Both files map a persona key to a list of answers, one per author question, in
// the same order as the persona's author_questions. validatePersonaAnswers
// returns plain-language problems, empty when the file is valid. It checks the
// shape, the length for the file's kind, and each answer's content through
// checkAnswerText. A sealed answer may refer to changing a mind; a recollection
// may not.
//
// Pure module: no I/O. It imports only types and the sibling checks module.

import type { Persona } from "./schema";
import { checkAnswerText } from "./letter-checks";

/** Which answer file is being validated. */
export type AnswerKind = "recollection" | "sealed";

/** Smallest answer length, in code points, for both kinds. */
export const ANSWER_MIN_CODE_POINTS = 1;

/** Largest answer length, in code points, for each kind. */
export const ANSWER_MAX_CODE_POINTS: Record<AnswerKind, number> = {
  recollection: 500,
  sealed: 1000,
};

/**
 * Validate the parsed value of answers.json or sealed-answers.json against the
 * persona list.
 *
 * Rejects an entry for a persona with no questions, an entry for an unknown
 * persona, a persona whose answer count does not equal its question count, an
 * answer that is not a string, an answer outside the length for its kind or only
 * whitespace, and any answer that fails checkAnswerText.
 *
 * @param raw      the parsed JSON value of the answer file
 * @param personas the persona list, from PERSONAS
 * @param kind     "recollection" for answers.json (the default), "sealed" for
 *                 sealed-answers.json
 * @returns a list of problem strings; empty when the answers are valid
 */
export function validatePersonaAnswers(
  raw: unknown,
  personas: readonly Persona[],
  kind: AnswerKind = "recollection",
): string[] {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return ["answers: must be an object keyed by persona key"];
  }

  const entries = raw as Record<string, unknown>;
  const problems: string[] = [];
  const byKey = new Map(personas.map((p) => [p.key, p] as const));
  const maxLength = ANSWER_MAX_CODE_POINTS[kind];

  for (const key of Object.keys(entries)) {
    const persona = byKey.get(key);
    if (persona === undefined) {
      problems.push(`persona "${key}": entry for an unknown persona`);
    } else if (questionsOf(persona).length === 0) {
      problems.push(`persona "${key}": entry for a persona with no questions`);
    }
  }

  for (const persona of personas) {
    const questions = questionsOf(persona);
    if (questions.length === 0) {
      continue;
    }

    const answers = entries[persona.key];
    if (!Array.isArray(answers)) {
      problems.push(
        `persona "${persona.key}": answers must be a list with one answer per question`,
      );
      continue;
    }

    if (answers.length !== questions.length) {
      problems.push(
        `persona "${persona.key}": ${answers.length} answers for ${questions.length} questions`,
      );
      continue;
    }

    answers.forEach((answer: unknown, index: number) => {
      const label = `persona "${persona.key}": answer ${index + 1}`;
      if (typeof answer !== "string") {
        problems.push(`${label}: must be a string`);
        return;
      }

      const length = [...answer].length;
      if (length < ANSWER_MIN_CODE_POINTS || length > maxLength) {
        problems.push(
          `${label}: must be ${ANSWER_MIN_CODE_POINTS}-${maxLength} code points`,
        );
      }
      if (answer.trim().length === 0) {
        problems.push(`${label}: must not be whitespace-only`);
      }

      problems.push(
        ...checkAnswerText(persona.key, index, answer, {
          sealed: kind === "sealed",
        }),
      );
    });
  }

  return problems;
}

function questionsOf(persona: Persona): readonly string[] {
  return persona.author_questions ?? [];
}
