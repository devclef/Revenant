/**
 * User-facing strings for the Opening_Flow, its error states, the recall step
 * and all three stages of the reveal. Every word a reader sees in these views
 * comes from here; the components hold no inline literals (R15.1).
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
 * Stage 2 (the sealed letter) and stage 3 (the figures then and now) strings
 * are now present, including the figure labels, the fixture note, the source
 * summary, the missing-now messages, the formula line and the one neutral
 * "not comparable" sentence per NotComparableReason. The direction words
 * (rose / fell / unchanged) live only in format-change.ts, never here (R12.9).
 *
 * Plain readonly constants only. No JSX lives here.
 */
export const REVEAL_COPY = {
  // --- Opening and still sealed ---

  /** Shown while the letter is being fetched and verified. */
  loading: "Bringing the letter into the light.",

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
  sealedRemainingSeconds:
    "Time remaining: {minutes} minutes and {seconds} seconds.",

  /** The control that retries after the countdown reaches zero. */
  sealedRetry: "Try again",

  // --- Verification ---

  /** Shown while the opened letter's seal is being checked. */
  verifying: "Checking the seal.",

  /** The verification statement shown before the recall step (R7.5). */
  sealIntact: "The seal is intact. Nothing here has changed since it was sealed.",

  /** The control that moves from the verification statement to recall. */
  begin: "Begin",

  /** The Pick_Up_Button on the persona page: moves from intact to recall (R10.4). */
  pickUp: "Pick up the letter",

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

  /**
   * The counter line for one question (R11.5). `{n}` counts from 1 and `{total}`
   * is the number of recall questions in the payload.
   */
  questionCounter: "Question {n} of {total}",

  /**
   * The as-of part of the counter on a persona letter (R11.5). `{date}` is the
   * written-as-of date in the spec 03 R6.3 format. It sits in a nowrap span.
   */
  questionCounterAsOf: "as of {date}",

  /** The separator between the counter and its as-of part (R11.5). */
  questionCounterSeparator: " · ",

  /** Moves to the next question. Shown on every question but the last (R11.5). */
  nextQuestion: "Next question",

  /** Moves to the previous question. Shown on every question but the first (R11.5). */
  previousQuestion: "Previous question",

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

  /**
   * The control that reveals every hidden stage at once, in order. Shown
   * alongside the next-stage button while a stage is still hidden (R9.4).
   */
  showAll: "Show everything",

  // --- Reveal, stage 2: the sealed letter ---

  /** Heading for stage 2 of the reveal: what was written then. */
  stage2Title: "What was written then",

  /** The "written as of" line. `{date}` is the payload's written-as-of date. */
  writtenAsOfPrefix: "Written as of {date}",

  /**
   * The always-shown demo letter label (R10.3). `{name}` is the persona's
   * display name.
   */
  demoLetterLabel:
    "A demo letter. {name} is fictional, and this letter was prepared later than its written as of date.",

  /** The "sealed for the demo on" line. `{sealedAt}` is the header's seal date. */
  sealedForDemoOn: "Sealed for the demo on {sealedAt}",

  /** The control that advances from the letter to the figures (R9.4). */
  stage2Next: "See the numbers",

  // --- The opening Fingerprint (R14.3, R14.8) ---

  /** The heading above the opening Fingerprint block. An h3, so the focus rule is unchanged. */
  fingerprintTitle: "Fingerprint at sealing",

  /** The statement shown with the Fingerprint once the seal check has passed (R14.3). */
  fingerprintPassed: "The seal check passed.",

  /**
   * The card sentence shown after `fingerprintPassed` on a live or real letter
   * (R14.3): the same Fingerprint is printed on the reader's letter card.
   */
  fingerprintPassedCard:
    "Compare it with the fingerprint printed on your letter card.",

  /**
   * The label shown after `fingerprintPassed` on a persona letter (R14.8). A
   * persona letter has no card, so no card wording is shown next to it.
   */
  fingerprintDemo: "demo letter",

  // --- Reveal, stage 3: the figures then and now ---

  /** Heading for stage 3 of the reveal: the figures then and now. */
  stage3Title: "The numbers, then and now",

  /** Label on the then figure. */
  then: "Then",

  /** Label on the now figure. */
  now: "Now",

  /**
   * The fixture note, shown once at the top of stage 3 when any shown figure
   * is a fixture (R13.5).
   */
  fixtureNote:
    "Some figures here are fixture data. They were made up for building the demo and are not real prices.",

  /** The "fixture data" label on a fixture figure or change line (R13.4). */
  labelFixtureData: "fixture data",

  /**
   * The historical-record label on a non-fixture then figure in a persona
   * letter (R13.1). `{date}` is the retrieved date in UTC.
   */
  labelHistoricalRecord: "historical record, retrieved {date}",

  /**
   * The then label on a non-fixture official figure in a Live_Letter or
   * Real_Letter (R13.2). `{date}` is the retrieved date in UTC. It never
   * contains "historical record".
   */
  labelSealedWithLetter: "sealed with the letter, retrieved {date}",

  /**
   * The label on a self-reported figure (R13.4). It never contains "historical
   * record" or "retrieved": a self-reported number is the reader's own, not a
   * fetched record.
   */
  labelSelfReported: "self-reported",

  /** The retrieved label on a now figure. `{date}` is the retrieved date in UTC. */
  labelRetrieved: "retrieved {date}",

  /** The summary that opens a figure's source details (R11.2, R13.1). */
  sourceSummary: "Source",

  /** Label before a figure's series identifier. */
  seriesLabel: "Series",

  /** The link text to a figure's source URL. */
  checkAtSource: "Check this figure at the source",

  /**
   * The display-rescale note (R11.10). `{toUnit}` is the shown unit and
   * `{fromUnit}` is the published unit.
   */
  rescaledNote: "Shown per {toUnit}. Published per {fromUnit}.",

  /** Label before the then-vs-now formula (R12.9). */
  formulaLabel: "Formula",

  /**
   * The neutral connector between the then period and the now period on a
   * change line, e.g. "Sep 2024" + this + "Sep 2026". Shown with a leading and
   * trailing space; it names no direction and carries no judgement.
   */
  periodRange: " to ",

  /**
   * Shown in place of a Now_Figure while the figures request is in flight. Only
   * the then figure is drawn meanwhile: no Now_Figure, change or Number_Line.
   */
  nowLoading: "Loading this figure.",

  /**
   * The Now_Figure is missing from the figures response: its series is no
   * longer published, or the series has no figure. The then figure stays with it.
   */
  nowUnavailableMissing:
    "This figure is no longer published by Revenant. The figure written then is shown with it.",

  /**
   * The figures request failed: a network error, a non-2xx status or a body
   * that could not be read. The then figure above stays.
   */
  nowUnavailableFetch:
    "This figure could not be loaded. Check your connection and reload the page.",

  /** The lead line shown when the then and now figures can't be compared. */
  notComparable:
    "These figures can't be compared, so no change is shown.",

  /**
   * One neutral "not comparable" sentence per NotComparableReason, named for
   * the first failing check in computeChange (change.ts). None describes a
   * direction or a judgement.
   */
  reason: {
    /** `kind`: one figure is not official data. */
    kind: "One of them is not official data.",
    /** `source`: the figures come from different publishers. */
    source: "They come from different sources.",
    /** `series_id`: the figures come from different series. */
    series_id: "They come from different series.",
    /** `unit`: the figures use different units. */
    unit: "They use different units.",
    /** `region`: the figures cover different regions. */
    region: "They cover different regions.",
    /** `unreadable_period`: a period could not be read. */
    unreadable_period:
      "A figure's period could not be read, so no change is shown.",
    /** `no_newer_figure`: there is no newer figure for the series yet. */
    no_newer_figure: "There is no newer figure for this series yet.",
  },
} as const;

export type RevealCopy = typeof REVEAL_COPY;

/**
 * Live_Letter strings for the reveal (spec 06, R18). A live letter is the
 * reader's own letter, not a demo persona, so none of the demo wording
 * ("Written as of", "Prepared later as a demo", "Sealed for the demo on")
 * appears in live mode.
 */
export const LIVE_COPY = {
  /** The seal line for a live letter. `{sealedAt}` is the local seal time. */
  sealedOn: "Sealed on {sealedAt}",

  /**
   * The fixed note after stage 3 of a live reveal (R18.6). It says nothing
   * about whether any number changed.
   */
  lockNote:
    "This letter was locked for 30 seconds. For a longer comparison, open a persona letter.",

  /** The link text in the lock note. It leads to `/demo`. */
  lockNoteLink: "Open a persona letter",
} as const;

export type LiveCopy = typeof LIVE_COPY;
