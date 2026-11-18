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
  /** The legend of the P.S. Question_Section (W6.2). */
  psLegend: "P.S. Questions for opening day",
  /** The intro under the P.S. legend (W6.3). */
  psIntro:
    "These stay on top of the envelope. When it opens, you answer each one from memory, before a word of the letter is shown. You don't answer them now.",
  /** Shown instead of the suggestion pills once three rows exist (W8.6). */
  questionsFull: "Three is the most a letter holds.",
  /** The placeholder of an empty Question_Row input (W7.1). */
  questionPlaceholder: "Write a question for opening day…",
  /** The visible text of the Edit control on a Question_Row (W7.4). */
  edit: "Edit",
  /** The Lock_Line under each Question_Row input (W7.5). */
  lockLine: "Answered on opening day, before the letter is shown.",
} as const;
