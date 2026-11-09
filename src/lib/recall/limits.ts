/**
 * Limits for the recall answers of a sealed letter (design.md "Constants").
 *
 * Pure constants with no imports, so the reducer can read them without pulling
 * in Zod. Changing a value changes what the server and the Opening_Flow accept,
 * so change it only together with the design.
 */

/** At most this many text questions per letter (C3.3, C3.9). */
export const TEXT_ANSWERS_MAX = 3;

/** A text answer may hold at most this many Unicode code points (C3.2, C4.5). */
export const TEXT_ANSWER_MAX_CODE_POINTS = 1000;
