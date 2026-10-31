// Persona list loader (design.md "Persona_List").
//
// Imports the committed personas.json, validates it ONCE at module load via
// schema.ts's parse function, deep-freezes the result, and exports PERSONAS as
// the single source of which personas /demo shows. If the list is invalid,
// parsing throws at import time, so the build and the tests fail and a bad
// list never reaches judges (design.md: "Throws at import").
//
// Web-safe: this module imports only Zod-backed sibling libraries and the JSON
// data. It must NOT import any .txt file or node:fs — letter text is read
// elsewhere, by the tests and the sealing script.

import rawPersonaList from "../../../content/personas/personas.json";

import { parsePersonaList, type Persona, type PersonaList } from "./schema";
import { checkLetterText } from "./letter-checks";

export type { Persona, PersonaList };
export { parsePersonaList, checkLetterText };

/**
 * Recursively freeze a value and everything reachable from it, so neither the
 * list, its persona entries, nor their nested metrics arrays can be mutated
 * after load. Returns the same reference, typed as deeply readonly.
 */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

// Validate once at import. A ZodError here fails the build and every test.
const PERSONA_LIST: PersonaList = deepFreeze(parsePersonaList(rawPersonaList));

/**
 * The parsed, frozen persona list. This is the only source of which personas
 * /demo shows (design.md). Validated once at import and deeply immutable.
 */
export const PERSONAS: readonly Persona[] = PERSONA_LIST.personas;

/**
 * The letter IDs retired from earlier persona payloads (R5.2). Frozen.
 */
export const RETIRED_LETTER_IDS: readonly string[] =
  PERSONA_LIST.retired_letter_ids;
