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

  /**
   * The three-step track on `/l/{id}`, in order: unlock, Remember, Receipts.
   * It is drawn by StepTrack from letter-track.ts.
   */
  letterTrackSteps: ["Unlock", "Remember", "Receipts"] as const,

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

  /** The Testify_Context line naming the persona. `{name}` is the persona's name. */
  contextFrom: "A letter from {name}",

  /**
   * The Memory_Line on a persona letter (spec 10 C4.2): it frames the testimony
   * as the reader's own memory of the written-as-of month. `{month}` is that
   * month in en-GB, taken from `written_as_of` (the month and year of the letter's date).
   */
  memoryLine: "You lived through {month} too. Answer from your own memory of it.",

  // --- Author_Testimony (spec 10 C8.2) ---

  /** The Author_Testimony_Heading: the block of the author's own questions above the letter. */
  authorTestimonyTitle: "Questions you left for yourself",

  /** The label above each Text_Answer on the Author_Testimony (spec 10 C8.2). */
  saidJustNow: "You remembered, just now",

  /**
   * The Fictional_Label (spec 11 P1.7): shown next to every Persona_Answer on
   * every screen that shows one, so a reader never takes her answer for the
   * judge's own.
   */
  personaAnswerLabel: "Her answer (fictional)",

  /** The testimony heading for the Text_Persona: her questions, not the judge's. */
  personaTestimonyTitle: "Her questions to herself",

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
    "This letter was sealed in a format this version of Efterhand can't read. Try again after the next update, or go back to the demo letters.",

  /** The letter opened but its contents are malformed (invalid_payload). */
  invalidPayload:
    "This letter opened, but its contents are not in the expected form. Nothing from it is shown. Go back to the demo letters.",

  /** The letter's record is incomplete (invalid_input). */
  invalidInput:
    "This letter's record is incomplete, so it can't be opened. Go back to the demo letters.",

  // --- Recall step ---

  /** Heading for the recall step. */
  recallTitle: "Before you read it",

  /** Intro for the recall step. It holds no date (spec 16, Requirement 13). */
  recallIntro: "Before you read it, say what you remember about that time.",

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

  /**
   * The sealed-on part of a figure question's counter on a live or real letter
   * (spec 15, 11.4). `{date}` is the sealing day in the reader's zone. Author
   * questions show no date here, because their "On {date} you asked yourself"
   * line carries it. The counter is `questionCounter` plus the separator plus
   * this text.
   */
  questionCounterSealedOn: "sealed on {date}",

  /**
   * The visible label above an author question's field (spec 15, 11.1). The
   * reader writes what they think they answered, from memory.
   */
  answerFromMemory: "What you think you answered",

  /** The hint under the author question's field (spec 15, 11.1). */
  answerHint: "What did you answer? Write what you remember.",

  /**
   * The checkbox on an author question. It replaces "No answer" for text
   * questions only; figure questions keep "No answer" (spec 15, 11.1).
   */
  dontRemember: "I don't remember",

  /**
   * The line above an author question on a live or real letter (spec 15,
   * 11.1). `{date}` is the sealing day in the reader's zone. The question
   * itself carries no date.
   */
  askedOn: "On {date} you asked yourself:",

  /**
   * The same line on a persona letter, where the date is its written-as-of
   * day, not a sealing day. `{date}` is in the spec 03 R6.3 format.
   */
  askedAsOf: "As of {date} you asked yourself:",

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

  /** The live count under a text answer. `{count}` is the trimmed length in code points. */
  textCount: "{count} of 1,000 characters",

  /** The inline error under a text answer that is empty or too long (C4.6). */
  textAnswerInvalid:
    "Write an answer of up to 1,000 characters, or choose I don't remember.",

  /** The submit control for the recall step. */
  submit: "Record my answers",

  /** Shown while the encrypted record is being posted. */
  submitting: "Recording your answers.",

  /** Shown when the post failed; the answers are kept and can be retried (R8.7). */
  submitFailed:
    "Your answers could not be recorded. Nothing has been revealed yet. Try again when you're ready.",

  // --- Reveal, stage 1 ---

  /** Heading for stage 1 of the reveal: what the reader just remembered. */
  stage1Title: "You remembered, just now",

  /**
   * The summary of the marks card on the figures and close Stages at 600 px and
   * wider (C3.4). The card stays closed until the reader opens it.
   */
  marksSummary: "You remembered, just now",

  /**
   * The Remembered_Phrase: the label beside what the reader remembered on the
   * receipts, the marks card and the figure card (spec 16, item 3).
   */
  yourAnswer: "You remembered, just now",

  /**
   * The spoken prefix for a remembered answer on the recall scale. It is read
   * by screen readers only, before the value and unit: "Your answer: 3.50 USD
   * per gallon". It is never drawn on screen.
   */
  answerSpokenPrefix: "Your answer",

  /**
   * The note under a field that holds its Sample_Answer (spec 10 C5.5). The
   * field counts as answered, and the judge can change or clear it.
   */
  sampleNote: "A sample answer is filled in. Change it if you remember differently.",

  /**
   * The label after a submitted answer that is a Kept_Sample (spec 10 C5.8).
   * It sits in the row's text colour and appears nowhere else.
   */
  sampleLabel: "· sample answer",

  /**
   * The control that reveals every hidden stage at once, in order. Shown
   * alongside the next-stage button while a stage is still hidden (R9.4).
   */
  showAll: "Show everything",

  /** Shown under a clamped answer. It shows the full text (spec 11 P4.2). */
  answerShowFull: "Show full answer",
  /** Shown under an expanded answer. It clamps the text again (spec 11 P4.2). */
  answerShowLess: "Show less",

  // --- Reveal, stage 2: the sealed letter ---

  /** Heading for stage 2 of the reveal: what was written then. */
  stage2Title: "What was written then",

  /** Summary of the letter disclosure on the phone's figures and close Stages. */
  letterDisclosureSummary: "Read the letter again",

  /**
   * The one-line disclosure at a persona letter (C6.1, C6.3): the persona is
   * fictional and the letter was written as of its date. `{name}` is the
   * persona's name; `{writtenAsOf}` is the written-as-of date.
   */
  letterDisclosure:
    "{name} is fictional. This letter was written as of {writtenAsOf}.",

  /** The "written as of" line. `{date}` is the payload's written-as-of date. */
  writtenAsOfPrefix: "Written as of {date}",

  /**
   * The always-shown demo letter label (R10.3). `{name}` is the persona's
   * display name.
   */
  demoLetterLabel:
    "A demo letter. {name} is fictional, and this letter was prepared later than its written as of date.",

  /**
   * The seal line at a persona letter (C6.3), in the Caption_Block. `{sealedAt}`
   * is the header's seal date, the only date that says when the demo was sealed.
   */
  sealedForThisDemo: "Sealed later, for this demo, on {sealedAt}.",

  /** The control that advances from the letter to the figures (R9.4). */
  stage2Next: "See the receipts",

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

  /**
   * The verdict shown first at a persona letter once its hash check has passed
   * (C6.4). It replaces `fingerprintPassed` on that path.
   */
  sealVerdict: "The seal is intact. This is exactly the text that was sealed.",

  /** The summary of the closed disclosure that holds a persona's Fingerprint (C6.4). */
  fingerprintShow: "Show the fingerprint",

  /** The link from a persona's Fingerprint to the How_Page (C6.4). */
  fingerprintHowLink: "How the seal is checked",

  // --- Reveal, stage 3: the figures then and now ---

  /** Heading for stage 3 of the reveal: the figures then and now. */
  stage3Title: "The receipts",

  // --- Receipts column (spec 15 R12.2) ---

  /** Heading above the question pairs, for a live letter (the reader's own). */
  receiptsQuestionsTitle: "Your questions",

  /** Heading above the question pairs, for a persona letter (fictional). */
  receiptsQuestionsTitlePersona: "Her questions",

  /** Label on the question as it was sealed, for a live letter. */
  receiptsAsWritten: "Your question, as you wrote it",

  /** Label on the question as it was sealed, for a persona letter. */
  receiptsAsWrittenPersona: "Her question, as she wrote it",

  /** Label on the reader's testimony, for a live letter. */
  receiptsRemembered: "You remembered, just now",

  /** Label on a persona's recollection. It carries the fictional label. */
  receiptsRememberedPersona: "She remembered · fictional",

  /** Label on the sealed answer, for a live letter. {date} is the sealing day. */
  receiptsWrote: "You wrote, {date}",

  /** Label on the sealed answer, for a persona letter. {date} is its written-as-of day. */
  receiptsWrotePersona: "She wrote, as of {date}",

  /** Shown in place of the sealed answer on a version 1 letter (no sealed answer). */
  noSealedAnswer: "No answer was sealed with this question.",

  /** Label on a persona's sealed answer when the letter has no written-as-of day. */
  receiptsWroteUndatedPersona: "She wrote",

  /** Label on the then figure. */
  then: "Then",

  /** Label on the now figure: the figure as it stood at opening. */
  now: "At opening",

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

  /**
   * The heading over the self-reported figures, after the official figures
   * (spec 08 later-tasks, R26.6). Only the figures the judge typed sit under it.
   */
  selfReportedTitle: "Your own numbers",

  /**
   * The line under the heading. It says what the numbers are, with no
   * comment on them (neutrality.md).
   */
  selfReportedHint:
    "Numbers you typed in when you sealed the letter. They are not official figures, and nothing here has been checked against a source.",

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
  rescaledNote: "Shown in {toUnit}. Published in {fromUnit}.",

  /**
   * The source-details line with the exact sealed value (P5.2). `{value}` and
   * `{unit}` are the sealed figure's value and unit, unrescaled.
   */
  asPublished: "As published: {value} {unit}",

  /**
   * The one line on a card whose values are rounded for display (P5.3). It
   * points to the published values in the source details.
   */
  roundedNote: "Values here are rounded for display. The published values are under Source.",

  /** Label before the then-vs-now formula (R12.9). */
  formulaLabel: "Formula",

  /**
   * The neutral connector between the then period and the now period on a
   * change line, e.g. "Sep 2024" + this + "Sep 2026". Shown with a leading and
   * trailing space; it names no direction and carries no judgement.
   */
  periodRange: " to ",
  changeSeparator: " · ",

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
    "This figure is no longer published by Efterhand. The figure written then is shown with it.",

  /**
   * The figures request failed: a network error, a non-2xx status or a body
   * that could not be read. The then figure above stays. It says only that no
   * newer figure was reached, so it never claims the series is gone (issue
   * #339, X3).
   */
  nowRequestFailed: "No newer figure could be reached for this series.",

  /**
   * The series is no longer in Revenant's catalogue or published, so the figure
   * is missing from the figures response. Only this string may say "no longer
   * published" (issue #250, A3.1).
   */
  nowRetired:
    "Efterhand no longer publishes this series. The sealed figure is shown on its own.",

  /**
   * The series is in the catalogue but has no figure yet (A3.2). It never says
   * the series is gone.
   */
  nowNotYet:
    "Efterhand hasn't fetched a figure for this series yet. The sealed figure is shown on its own.",

  /**
   * The now figure is a bundled fallback, not a stored one (A3.3). `{date}` is
   * the figure's retrieved date in UTC.
   */
  fallbackNote:
    "Efterhand hasn't fetched a newer figure yet. This one was retrieved {date}.",

  /**
   * The one line on a Single_Figure_View card (spec 12 Z2.2): the sealed figure
   * and the figure now are the same record, so there is nothing to compare.
   */
  nothingToCompare:
    "This is the same record as the one you sealed, so there is nothing to compare yet.",

  /**
   * The Same_Period_Line on a live or real letter whose sealed period is a day
   * in a week (YYYY-MM-DD). The period is read from the sealed string only
   * (spec 14 R7.2). The change is never shown for the same period.
   */
  samePeriodWeek:
    "Same week as when you sealed it. A letter kept for months would show the change.",

  /** The Same_Period_Line for a sealed period written YYYY-MM. */
  samePeriodMonth:
    "Same month as when you sealed it. A letter kept for months would show the change.",

  /** The Same_Period_Line for any other sealed period string. */
  samePeriodOther:
    "Same period as when you sealed it. A letter kept for months would show the change.",

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
} as const;

export type LiveCopy = typeof LIVE_COPY;
