/**
 * User-facing strings for the live demo: the Seal_Page and the Letter_Page
 * pieces that share its copy file. Every string a reader sees comes from here
 * (R19.1), so none is a literal in a component.
 *
 * Tone (tone.md): calm, second person, short sentences, no exclamation marks,
 * the product words seal, sealed, open, letter, then and now. Neutrality
 * (neutrality.md): no party, policy, candidate or judgement, and each sentence
 * reads the same to any reader. Warnings about a lost passkey or key stay plain.
 *
 * `{name}` marks a value filled in at render time. The Demo_Index entry sits in
 * src/components/demo/copy.ts, not here.
 *
 * Hard constraints checked by copy.test.ts: no "!", no sentence over 25 words,
 * none of tone.md's clichés.
 *
 * Plain readonly constants only. No JSX lives here.
 */
export const LIVE_COPY = {
  heading: "Seal a letter of your own",
  intro:
    "This letter is sealed in your browser with your own passkey. It is locked for 30 seconds only because this is a demo.",
  letterLabel: "Your letter",
  letterHint: "Plain text. Up to 5,000 characters.",
  /** The label of the group of starter buttons under the letter field. */
  starterGroup: "Start with one of these sentences, or write your own",
  letterCount: "{count} of 5,000 characters",
  figuresLegend: "Choose the figures to seal with it",
  figuresHint:
    "Choose between 1 and {max}. Each is sealed as published, with its period and source.",
  /** Shown instead of any range when no figure can be sealed (A4.1). */
  figuresNoneAvailable:
    "No figure can be sealed right now. Try again later, or {link}.",
  /** The text of the `{link}` in figuresNoneAvailable; it links to /demo. */
  figuresNoneLink: "open a persona letter in the demo",
  /** The singular hint, used when the stated maximum is 1 (A4.3). */
  figuresHintOne:
    "Choose 1. It is sealed as published, with its period and source.",
  figuresTooManyOne: "Choose no more than 1 figure.",
  figureLatest: "Latest period: {period}",
  /** The published value, shown at full precision with its unit beside it. */
  figureValue: "Value: {value}",
  figureSource: "Source: {source}",
  figureSourceDetails: "Source details",
  figureSourceName: "Source name",
  figureSeriesId: "Series ID",
  figureSourceLink: "Source link",
  figureRetrieved: "Retrieved",
  /** A Fallback_Figure is not the latest, so it never says "Latest" (A1.8). */
  figurePeriod: "Period: {period}",
  fixtureLabel: "fixture data",
  /** Shown in place of the receipts while the figures request is in flight (X2.2). */
  receiptsLoading: "Loading the receipts you can add.",
  /**
   * The figures request failed or timed out (X2.3). Sealing does not wait for
   * it, and no picker is shown.
   */
  receiptsUnavailable:
    "Receipts can't be added right now. Your letter doesn't need one.",
  passkeySteps:
    'Your device will ask for the passkey twice. Each time, you press a button first. The passkey will be named "Revenant demo" in your passkey manager.',
  crossDeviceSummary: "Opening on another device",
  crossDevice:
    'A passkey may not work on a device from a different ecosystem. To open this letter, use a device that has the passkey, or your computer\'s "use a phone" option.',
  warning:
    "A lost or deleted passkey means this letter can never be opened, unless you also keep its backup key. Revenant cannot recover it.",
  warningLabel:
    "I understand that a lost or deleted passkey means this letter can never be opened, unless I keep its backup key.",
  createButton: "Press the seal with your passkey",
  confirmButton: "Confirm your passkey",
  nextButton: "Next",
  backButton: "Back",
  preparing: "Getting ready.",
  stepCreating: "Waiting for your device. Create the passkey when it asks.",
  stepCreated: "Your passkey is created. Press the button to confirm it.",
  stepConfirming: "Waiting for your device. Confirm the passkey when it asks.",
  stepPreparing: "Preparing your letter.",
  stepSealing: "Sealing your letter.",
  letterEmpty:
    "Write something first. A letter needs at least one character that is not a space.",
  letterTooLong:
    "This letter is longer than 5,000 characters. Shorten it and try again.",
  nothingToTestify: "Write a question or choose a figure before you seal.",
  figuresTooMany: "Choose no more than {max} figures.",
  prfHint:
    "This device may not be able to lock the letter with a passkey. If so, you will need a backup key card.",
  warningUnticked:
    "Tick the box to confirm you understand, then create your passkey.",
  unavailable:
    "Sealing your own letter is not available on this server. Go back to the demo.",
  cannotLockTitle: "This device cannot lock a letter with a passkey",
  cannotLockBody: "Your letter has not been sealed, and none of its text was sent to Revenant.",
  cannotLockNext1:
    "Try another device or browser. If your browser offers it, choose the option to use a phone or tablet.",
  cannotLockNext2:
    "You can also seal with a backup key instead, or open a persona letter.",
  passkeyDeleteNote:
    'If your device created a passkey named "Revenant demo", you can delete it from your passkey manager.',
  fallbackButton: "Seal with a backup key instead",
  backToDemo: "Back to the demo",
  cancelledTitle: "Nothing was sealed",
  cancelledBody:
    "You closed the prompt, or it timed out. Your letter is still here.",
  tryAgain: "Try again",
  failedBody:
    "Your letter was not sealed. Check your connection and try again.",
  failedServerBody:
    "The server could not finish. Nothing was sealed, and your letter is still here. Try again.",
  clockBody:
    "Your device clock differs from Revenant's clock by more than the demo allows. Nothing was sealed. Check your device time and try again.",
  busyBody: "Demo 2 is busy right now. Nothing was sealed. Try again later.",
  missingThenBody:
    "No figure is available for {name}. Nothing was sealed. Choose different figures and try again.",
  fallbackTitle: "Your backup key",
  fallbackIntro:
    "This key is the only way to open this letter. Save it somewhere safe.",
  fallbackWarning: "A lost key means a lost letter. Revenant cannot recover it.",
  copyKey: "Copy",
  copied: "Copied",
  savedLabel: "I have saved this key",
  sealWithKey: "Seal with this key",
  notNow: "Not now",
  sealedTitle: "Your letter is sealed",
  sealedBody: "It cannot be changed now.",
  opensAt: "Opens at {time}",
  countdown: "Time remaining: {seconds} seconds.",
  countdownDone: "The time has come.",
  linkLabel: "Your letter link",
  copyLink: "Copy link",
  goToLetter: "Go to your letter",
  keepLink: "Keep this link. This page does not keep your key, so it cannot show the key again after you close it.",
  keyReminder:
    "Your backup key opens this letter after the opening date. Paste it into the key field on the letter page.",
  regionLabel: "Your letter",
  unlockTitle: "Unlock your letter",
  unlockPasskey: "Unlock with your passkey",
  unlockPreparing: "Getting ready.",
  backupOnly: "This letter needs its backup key. Paste it below.",
  backupLabel: "Backup key",
  backupHint: "Paste the key from your backup card.",
  backupSubmit: "Unlock with this key",
  noticeCancelled: "Nothing was opened. Press the button to try again.",
  noticeFailed:
    "Your device did not finish. Nothing was opened. Try again.",
  noticeNoPrf:
    'This device could not produce the key for this passkey. Your letter is unchanged. Try a device that has the passkey, or your computer\'s "use a phone" option.',
  noticeWrongDomain:
    "This letter's passkey belongs to {domain}. The letter can only be unlocked there.",
  noticeWrongPasskey:
    "This is probably not the passkey that sealed this letter. Try another.",
  noticeMistyped: "That key does not look right. Check it and try again.",
  noticeWrongBackup: "That key does not match this letter.",
  sealedOn: "Sealed on {sealedAt}",
  lockNote:
    "This letter was locked for 30 seconds. For a longer comparison, open a persona letter.",
  lockNoteLink: "Open a persona letter",
  /** Heading of the /l/[id] not-found page. */
  letterNotFoundTitle: "No letter here",

  /** Body of the /l/[id] not-found page. */
  letterNotFound:
    "This link does not match a letter. Check the link and try again.",
  letterCardTitle: "Letter card",
  letterCardOpens: "Opens {time}",
  letterCardFingerprint: "Fingerprint at sealing",
  saveCardImage: "Save the card as an image",
  printCard: "Print or save as PDF",
  downloadIcs: "Add to your calendar",
  icsSummary: "Your letter opens",
  icsDescription: "Open your Revenant letter: {link}",
  backupCardOption: "Also make a backup key card",
  backupCardOptionHint:
    "A backup key opens the letter on its own after the opening date. Keep it like a house key.",
  backupCardTitle: "Backup key card",
  backupCardWhat: "This card opens your letter on its own after the opening date.",
  backupCardKeep: "Keep it somewhere safe, like a house key.",
  backupCardShow: "Show my backup key card",
  backupCardKeyLabel: "Your backup key",
  backupCardQrHint: "Scan this code to open the letter link with your backup key.",
  /** The headline of /demo/live (spec 09 F7). */
  liveHeading: "Seal your own letter",
  /** Brand_Copy has no Wait step, so the Live_Stepper takes its name from here. */
  waitStep: "Wait",
  stepsLabel: "Your progress",
  /** Announced once per step change. `{n}` is the step number, `{total}` the count. */
  stepAnnounce: "Step {n} of {total}: {label}",
  back: "Back",
  next: "Next",
  /** The Author_Question rows on the Write step (spec 10, C2.1). */
  authorQuestionsLegend: "Questions for your future self",
  authorQuestionsHint:
    "When the letter opens, you'll answer these from memory before you read it.",
  /** `{n}` is the row number, starting at 1. */
  authorQuestionLabel: "Question {n}",
  authorQuestionRemove: "Remove question {n}",
  authorQuestionAdd: "Add a question",
  /** Shown after the rows, so the author knows they can answer in the letter too. */
  answerInLetter: "Answer them in your letter too, in your own words.",
  /** Shown after the row was touched or a seal was attempted (C2.3). */
  questionTooLong: "Keep each question to 200 characters or fewer.",
  /** A self-reported name, unit or region outside 1 to 60 characters. */
  selfReportedTextLength: "Use 1 to 60 characters.",
  /** A self-reported value that is not 0 to 999,999,999 with at most 4 decimals. */
  selfReportedValue:
    "Use a number from 0 to 999,999,999, with up to 4 decimal places, such as 3.4125.",
  /** A period that is not a month or a date, or is later than the sealing day. */
  selfReportedPeriod:
    "Use a month, such as 2026-09, or a date, such as 2026-09-30. It cannot be after today.",
  /** Shown when the visitor has reached the limit on their own numbers. */
  selfReportedLimit: "You can add up to 10 numbers of your own.",
  /** The group heading on the Write step, after the questions (R26.1). */
  selfReportedTitle: "Your own numbers",
  /** Explains the group: sealed as typed, labelled self-reported, never official. */
  selfReportedHint:
    "Add numbers only you know, such as your own rent. They are sealed as you type them and labelled self-reported. Revenant does not check them against any source.",
  selfReportedAdd: "Add a number of your own",
  /** `{n}` is the row number, starting at 1. */
  selfReportedRowLabel: "Number {n}",
  selfReportedRemove: "Remove number {n}",
  selfReportedNameLabel: "Name, such as Rent",
  selfReportedValueLabel: "Value",
  selfReportedUnitLabel: "Unit, such as per month",
  selfReportedRegionLabel: "Region, such as your city",
  selfReportedPeriodLabel: "Period, such as 2026-09 or 2026-09-30",
  /** The first row of /demo/live, which the judge can edit, clear or remove (C9.5). */
  livePrefill: "What's on your mind right now?",
  /** The label of the group of Question_Starter buttons (C2.4). */
  questionStartersLabel: "Start from one:",
} as const;

/**
 * Opening sentences offered on the Write step. Pressing one inserts it at the
 * cursor in the letter.
 *
 * Copy review (neutrality.md copy test, tone.md copy rules). Each sentence was
 * read as if by someone who holds the opposite political view:
 * - "Right now, the thing on my mind is": open, personal, no subject matter
 *   named, so it reads the same to any reader. No digits, no "!".
 * - "Today, the thing I most want to remember is": asks for a memory, takes no
 *   side and names no party, candidate, policy or election. No digits, no "!".
 * - "Over the past few months, I have been": a neutral lead-in about the
 *   writer's own life. No judgement word, no digits, no "!".
 * copy.test.ts checks the digit and "!" rules for all three.
 */
export const promptStarters: readonly [string, string, string] = [
  "Right now, the thing on my mind is",
  "Today, the thing I most want to remember is",
  "Over the past few months, I have been",
] as const;

/**
 * The Question_Starters (spec 10, C2.6): neutral lead-ins about the author's
 * everyday life. They do not lead toward an answer and contain no digit, no
 * figure, no party, policy or election term, and no direction word. A press
 * puts one into the first empty Author_Question row (author-questions.ts).
 */
export const questionStarters: readonly [
  string,
  string,
  string,
  string,
  string,
] = [
  "What was on your mind most days?",
  "Who did you spend your evenings with?",
  "What were you saving for?",
  "What did a normal Saturday look like?",
  "What were you looking forward to?",
] as const;

/**
 * User-facing strings for the Real_Seal_Page at `/seal` (spec 08, R15.1). Kept
 * apart from LIVE_COPY because a Real_Letter is not a demo: none of these
 * strings mention the 30-second lock or the demo label.
 *
 * `{date}` is filled with a calendar date in the R15.1 form, for example
 * "12 May 2027". Same tone rules as LIVE_COPY.
 */
export const REAL_COPY = {
  intro:
    "Your letter is sealed with your own passkey. It opens at midnight on the date you choose, and no one can open it before then.",
  dateLabel: "Opening date",
  dateHint:
    "Your letter opens at midnight on this date. It must be at least three months after you seal it. You cannot change the date once it is sealed.",
  dateChosen: "Opens at midnight on {date}, in your time zone.",
  utcFallback: "It opens at midnight UTC.",
  testNotice:
    "This is a test site. A letter sealed here can only be opened here, or with its backup key.",
  passkeyUserName: "Revenant letter · opens {date}",
  tooEarly:
    "That date is too soon. A letter must open at least three months after it is sealed. Choose a later date and try again. Nothing was sealed, and your letter is still here.",
  invalidDate:
    "Revenant could not seal the letter with that date. Choose another date and try again. Nothing was sealed, and your letter is still here.",
  dateMissing: "Choose an opening date before you seal.",
  stillSealed: "This letter is still sealed.",
  /**
   * The figure hint on /seal (spec 10, C2.13). A real letter with a question
   * may seal with no figure, so the hint says so. `{max}` is the most figures.
   */
  figuresHintReal:
    "Choose up to {max} figures, or none if you write a question above. Each is sealed as published, with its period and source.",
  /** The same hint when the stated maximum is 1. */
  figuresHintRealOne:
    "Choose 1 figure, or none if you write a question above. It is sealed as published, with its period and source.",
} as const;
