// Pre-written answers for the Text_Persona (content/personas/letters/answers.json).
//
// The file maps a persona key to a list of answers, one per author question, in
// the same order as the persona's author_questions. validatePersonaAnswers
// returns plain-language problems, empty when the file is valid. It checks the
// shape, the 1-500 code point length, and each answer's content through
// checkAnswerText.
//
// Pure module: no I/O. It imports only types and the sibling checks module.

import type { Persona } from "./schema";
import { checkAnswerText } from "./letter-checks";

/** Smallest and largest answer length, in code points. */
export const ANSWER_MIN_CODE_POINTS = 1;
export const ANSWER_MAX_CODE_POINTS = 500;

/**
 * Validate the parsed answers.json value against the persona list.
 *
 * Rejects an entry for a persona with no questions, an entry for an unknown
 * persona, a persona whose answer count does not equal its question count, an
 * answer that is not a string, an answer outside 1-500 code points or only
 * whitespace, and any answer that fails checkAnswerText.
 *
 * @param raw      the parsed JSON value of answers.json
 * @param personas the persona list, from PERSONAS
 * @returns a list of problem strings; empty when the answers are valid
 */
export function validatePersonaAnswers(
  raw: unknown,
  personas: readonly Persona[],
): string[] {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return ["answers: must be an object keyed by persona key"];
  }

  const entries = raw as Record<string, unknown>;
  const problems: string[] = [];
  const byKey = new Map(personas.map((p) => [p.key, p] as const));

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
      if (length < ANSWER_MIN_CODE_POINTS || length > ANSWER_MAX_CODE_POINTS) {
        problems.push(
          `${label}: must be ${ANSWER_MIN_CODE_POINTS}-${ANSWER_MAX_CODE_POINTS} code points`,
        );
      }
      if (answer.trim().length === 0) {
        problems.push(`${label}: must not be whitespace-only`);
      }

      problems.push(...checkAnswerText(persona.key, index, answer));
    });
  }

  return problems;
}

function questionsOf(persona: Persona): readonly string[] {
  return persona.author_questions ?? [];
}
