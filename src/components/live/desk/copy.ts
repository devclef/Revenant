/**
 * User-facing strings of the Write desk on /demo/live (spec 14, W2 and W3).
 * The eyebrow reuses LIVE_COPY.liveHeading and the Occasion labels come from
 * LIVE_COPY.occasionLabels, so only the strings new to the desk live here.
 *
 * Tone (tone.md) and neutrality (neutrality.md) apply: second person, short
 * sentences, no exclamation mark, no judgement of the letter.
 *
 * Plain readonly constants only. No JSX lives here.
 */
export const DESK_COPY = {
  /** The h1 of the Write step (W2.3). */
  heading: "Write to the you who opens this.",
  /** The intro under the h1 (W2.4). */
  intro:
    "Say where things stand today. Then leave a few questions. When it opens, you answer them from memory first, then read what you wrote.",
  /** The visible legend above the Occasion pills (W3.1). */
  startFrom: "Start from",
  /** The salutation at the top of the Letter_Sheet (W4.2). Display only. */
  salutation: "Dear future me,",
  /** The sign-off under the Letter_Field (W4.4). Display only, never sealed. */
  signOff: "— me, today",
} as const;
