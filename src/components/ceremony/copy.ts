/**
 * User-facing strings for the reveal Ceremony: the motion and sound controls,
 * the skip control, the envelope stage, the seal break, the recall scale, the
 * desk, and one short line per Stage for the polite live region.
 *
 * Every word a reader or screen reader hears in the Ceremony comes from here;
 * the components hold no inline literals (R15.1). Existing strings in
 * `reveal/copy.ts` and `demo/copy.ts` stay where they are.
 *
 * Tone (tone.md): calm, second person, short sentences, the product
 * vocabulary of seal / sealed / open / letter / record / then / now.
 * Neutrality (neutrality.md): names no party, policy, candidate or judgement,
 * and reads the same to any reader.
 *
 * Hard constraints checked by copy.test.ts (R15.2-R15.4): no "!", no sentence
 * over 25 words, none of tone.md's clichés. `{...}` marks a value filled in at
 * render time; the value itself is never a sentence and carries no judgement.
 *
 * Plain readonly constants only. No JSX lives here.
 */
export const CEREMONY_COPY = {
  // --- Motion and sound controls ---

  /** Turns motion off (the Calm control, when motion is currently on). */
  calmOn: "Turn off motion",

  /** Turns motion back on (the Calm control, when motion is currently off). */
  calmOff: "Turn motion back on",

  /** Skips the current stage's motion and settles it at once. */
  skip: "Skip",

  // --- Persona notice (Top_Bar and Persona_Intro) ---

  /**
   * The fictional-persona notice. `{name}` is the persona's name. It shows in
   * the Top_Bar and on the Persona_Intro, and it is the same text in both.
   */
  personaNotice: "{name} is fictional. This letter was prepared later as a demo.",

  // --- Persona_Intro (spec 09 C1.1, P5.3) ---

  /** The question count line. `{n}` is the number of recall questions (two or more). */
  introQuestions: "Before you read it, you'll answer {n} questions from memory.",

  /** The question count line when the letter has one question. */
  introQuestionsOne: "Before you read it, you'll answer one question from memory.",

  /** The time the reader should expect. `{minutes}` is the value of FLOW_MINUTES, once the owner has set it. */
  introTime: "It takes about {minutes} minutes.",

  // --- Envelope stage ---

  /** The envelope's written-as-of line. `{date}` is the written-as-of date. */
  envelopeWrittenAsOf: "Written as of {date}",

  /** The envelope's opening line. `{date}` is the opening date. */
  envelopeOpens: "Opens {date}",

  // --- Seal break ---

  /** The hint above the wax seal (spec 10 C6.4). It names no position. */
  sealHint: "Press and hold the wax seal to break it, or use the button.",

  /** The button that breaks the seal. */
  sealButton: "Break the seal",

  /** The Skip_Link under the seal: sends SHOW_ALL once (spec 09 C4.2). */
  skipToReceipts: "Skip to the receipts",

  /** The Skip_Link label when the letter has no figures (spec 10 C6.6, C8.9). */
  skipToLetter: "Skip to the letter",

  /** Live: the seal has not been held long enough yet. */
  sealHolds: "The seal holds. Press and hold a little longer to break it.",

  /** Live: the seal has been broken. */
  sealBroken: "The seal is broken. The letter is open.",

  // --- Recall scale ---

  /** Hint under the recall scale, on how to answer. */
  recallScaleHint:
    "Drag the ink mark to where you remember it. You can also type the number, or choose no answer.",

  /** Hint shown while the scale is zoomed in. */
  recallZoomHint: "Hold still to look closer.",

  /** The plain control that zooms in on the Mark without a pointer hold. */
  recallLookCloser: "Look closer at the mark",

  /** The control that returns the scale to its full width. */
  recallWholeScale: "Show the whole scale",

  /** Shown on the scale before the reader has given an answer. */
  recallNoMarkYet: "No answer yet",

  // --- Recall number field (spec 08 R32) ---

  /** Under the field, the number as read, for example "Read as 1,585.76". `{value}` is the number. */
  parsedValue: "Read as {value}",

  /** The legend of the two-reading choice for an Ambiguous_Input. */
  readingLegend: "This could be read two ways. Which did you mean?",

  /** The decimal reading in words. `{head}` and `{tail}` are the judge's digits. */
  readingDecimal: "{head} point {tail}",

  /** The grouping reading in words. `{head}` is the judge's digits; `{rest}` is the tail without leading zeros. */
  readingGrouping: "{head} thousand {rest}",

  /** Shown when the field text cannot be read as one number. One fixed example for every input. */
  numberUnreadable: "This number could not be read. Write it like 1585.76.",

  // --- Desk ---

  /** Shown on the desk when there are no envelopes to place on it. */
  deskEmpty: "No letters are on the desk yet.",

  /** Turns sound on (when sound is currently off). */
  soundOn: "Turn sound on",

  /** Turns sound off (when sound is currently on). */
  soundOff: "Turn sound off",

  /** The note explaining that sound and vibration start off. */
  soundNote: "Sound and vibration are off unless you turn them on.",

  // --- Number_Line (the figures stage) ---

  /**
   * The hidden text for the Mark on a Number_Line. `{value}` is the answer as
   * typed; `{unit}` is the figure's unit. Read by screen readers only.
   */
  markAnswer: "Your answer: {value} {unit}",

  // --- Number_Line labels (spec 08 R5) ---

  /** Visible label under the then point. Read by screen readers only through numberLineAlt. */
  lineThen: "Then",
  /** Visible label under the now point. */
  lineNow: "Now",
  /** Visible label for the judge's answer, followed by the value and unit. */
  lineAnswer: "Your answer",
  /** Visible label when the judge gave no answer. */
  lineNoAnswer: "No answer",
  /**
   * Text alternative for a Number_Line with an answer. `{then}`, `{now}` and
   * `{answer}` are the displayed values; `{thenPeriod}` and `{nowPeriod}` are
   * the figures' periods; `{unit}` is the figure's unit.
   */
  numberLineAlt:
    "Then {then} {unit}, {thenPeriod}. Now {now} {unit}, {nowPeriod}. Your answer {answer} {unit}.",
  /** Text alternative for a Number_Line with no answer. */
  numberLineAltNoAnswer:
    "Then {then} {unit}, {thenPeriod}. Now {now} {unit}, {nowPeriod}. No answer.",

  // --- Live region, one short line per Stage ---

  /**
   * One short line announced by the polite live region for each Stage, so a
   * screen-reader reader hears where the Ceremony is without any motion.
   */
  stageLive: {
    // The emerging Stage has no entry here. Its line comes from
    // stages.emergingStatus, the same REVEAL_COPY string the envelope shows.
    /** The letter, still sealed and not yet open. */
    sealed: "The letter is still sealed.",
    /** The sealed envelope resting on the desk. */
    envelope: "The envelope is on the desk.",
    /** The recall step, before the letter is opened. */
    recall: "Testify. Say what you remember.",
    /** The remembered answers, placed as ink marks. */
    marks: "Your answers are placed.",
    /** The seal, waiting to be broken. */
    seal: "The seal is ready to break.",
    /** The open letter. */
    letter: "The letter is open.",
    /** The figures stage, while the figures fade in. */
    figures: "The figures are coming in.",
    /** The closing stage. */
    close: "That is the whole letter.",
    /** An error state. */
    error: "The letter could not be opened. You can try again.",
  },

  // --- Step_Indicator on the persona page (spec 09 C2, design.md "Copy") ---

  /** The accessible name of the Step_Indicator list. */
  stepsLabel: "Your progress",

  /** The four steps, in order. Testify and See the receipts match Brand_Copy. */
  steps: ["Testify", "Break the seal", "Read", "See the receipts"],

  /**
   * The polite live-region line when the current step changes. `{n}` is the
   * step number from 1, `{total}` is the step count and `{label}` is the step name.
   */
  stepAnnounce: "Step {n} of {total}: {label}",

  // --- Close (spec 07 task 6, design.md "Close") ---
  /**
   * The persona close's heading (spec 09 C7.1, F5.1). It names the reader's
   * testimony and the record, and leaves what lies between them to the reader.
   */
  closeLine: "Your testimony sits beside the record. What lies between them is yours to read.",
  /**
   * The persona close's heading for a letter with no official figures (spec 11
   * L5.2). It names no numbers and no prices.
   */
  closeLineNoFigures: "Her testimony and her letter are side by side. What they say is yours to read.",
  /** The Accent link to /demo/live, shown only while Demo_2_On is true. */
  closeLink: "Seal your own. It opens 30 seconds after you seal it.",
  /** The smaller note under the link. */
  closeNote:
    "That is the whole letter. Nothing has been added to what you remembered, what was written, or the record.",
  /** The link back to the same persona, for a fresh opening. */
  startOver: "Start over",
} as const;

export type CeremonyCopy = typeof CEREMONY_COPY;
