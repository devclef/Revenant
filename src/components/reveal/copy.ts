/**
 * User-facing strings for the Opening_Flow, its error states, the recall step
 * and stage 1 of the reveal. Every word a reader sees in these views comes
 * from here; the components hold no inline literals (R15.1).
 *
 * Tone (tone.md): calm, second person, short sentences, the product
 * vocabulary of seal / sealed / open / letter / record / then / now.
 * Neutrality (neutrality.md): names no party, policy, candidate or judgement,
 * and reads the same to any reader.
 *
 * Hard constraints checked by copy.test.ts (R15.2-R15.4): no "!", no sentence
 * over 25 words, none of tone.md's clichés, and every error or empty-state
 * string names an action the reader can take.
 *
 * `{...}` marks a value filled in at render time; the value itself is never a
 * sentence and carries no judgement.
 *
 * The stage 2 and stage 3 figure strings are added by a later task; this
 * module carries only the flow, recall and stage 1 copy for now.
 *
 * Plain readonly constants only. No JSX lives here.
 */
export const REVEAL_COPY = {
  // --- Opening and still sealed ---

  /** Shown while the letter is being fetched and verified. */
  loading: "Breaking the seal.",

  /** Heading for the still-sealed state. */
  sealedTitle: "Still sealed",

  /** Body for the still-sealed state. `{date}` is the opening date. */
  sealedBody: "This letter is still sealed. It opens on {date}.",

  /**
   * The countdown line in the still-sealed state. `{days}`, `{hours}` and
   * `{minutes}` are filled in from the time remaining.
   */
  sealedRemaining:
    "Time remaining: {days} days, {hours} hours and {minutes} minutes.",

  /** The control that retries after the countdown reaches zero. */
  sealedRetry: "Try again",

  // --- Verification ---

  /** Shown while the opened letter's seal is being checked. */
  verifying: "Checking the seal.",

  /** The verification statement shown before the recall step (R7.5). */
  sealIntact: "The seal is intact. Nothing here has changed since it was sealed.",

  /** The control that moves from the verification statement to recall. */
  begin: "Begin",

  // --- Errors ---

  /** The letter record has not been placed yet (404). */
  notPlaced:
    "This demo letter hasn't been placed yet. Try again later, or go back to the demo letters.",

  /** The letter could not be reached (network, 5xx, other 4xx). */
  unreachable:
    "The letter could not be reached. Check your connection and try again.",

  /** The retry control shown in reachable error states. */
  retry: "Try again",

  /** The sealed hash did not match (verification_failed). */
  verificationFailed:
    "This letter failed verification. Its contents may have changed since sealing, so they can't be trusted. Nothing from it is shown. Go back to the demo letters.",

  /** The demo key did not open the letter (wrong_key). */
  wrongKey:
    "The demo key did not open this letter. Nothing from it is shown. Go back to the demo letters and choose another.",

  /** The decrypted contents did not match their seal (tampered). */
  tampered:
    "The sealed contents did not match their seal, so nothing from them is shown. Go back to the demo letters.",

  /** The letter is in a format this version can't read (unsupported_format). */
  unsupportedFormat:
    "This letter was sealed in a format this version of Revenant can't read. Try again after the next update, or go back to the demo letters.",

  /** The letter opened but its contents are malformed (invalid_payload). */
  invalidPayload:
    "This letter opened, but its contents are not in the expected form. Nothing from it is shown. Go back to the demo letters.",

  /** The letter's record is incomplete (invalid_input). */
  invalidInput:
    "This letter's record is incomplete, so it can't be opened. Go back to the demo letters.",

  // --- Recall step ---

  /** Heading for the recall step. */
  recallTitle: "Before you read it",

  /** Intro for the recall step. `{date}` is the written-as-of date. */
  recallIntro:
    "This letter was written as of {date}. Before you read it, tell us how you remember that time.",

  /** Hint under the recall intro. */
  recallHint: "Answer from memory. You can mark any question as no answer.",

  /** Label shown beside a recall input. `{unit}` is the figure's unit (R8.2). */
  unitLabel: "in {unit}",

  /** The "no answer" checkbox label (R8.3). */
  noAnswer: "No answer",

  /** The inline error shown under an invalid recall answer (R8.4). */
  answerInvalid:
    "Enter a number, such as 3.50, or mark this question as no answer.",

  /** The submit control for the recall step. */
  submit: "Record my answers",

  /** Shown while the encrypted record is being posted. */
  submitting: "Recording your answers.",

  /** Shown when the post failed; the answers are kept and can be retried (R8.7). */
  submitFailed:
    "Your answers could not be recorded. Nothing has been revealed yet. Try again when you're ready.",

  // --- Reveal, stage 1 ---

  /** Heading for stage 1 of the reveal: what the reader just remembered. */
  stage1Title: "What you remembered",

  /** Prefix for a remembered answer. `{value}` is filled in at render time. */
  yourAnswer: "Your answer",

  /** The control that advances from stage 1 to the letter. */
  stage1Next: "Read the letter",

  /**
   * The control that reveals every hidden stage at once, in order. Shown
   * alongside the next-stage button while a stage is still hidden (R9.4).
   */
  showAll: "Show everything",
} as const;

export type RevealCopy = typeof REVEAL_COPY;
