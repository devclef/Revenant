/**
 * User-facing strings for the reveal Ceremony: the motion and sound controls,
 * the skip control, the envelope stage, the seal break, the recall scale, the
 * tilt prompt, and one short
 * line per Stage for the polite live region.
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


  // --- Envelope stage ---

  /** The envelope's written-as-of line. `{date}` is the written-as-of date. */
  envelopeWrittenAsOf: "Written as of {date}",

  /** The envelope's opening line. `{date}` is the opening date. */
  envelopeOpens: "Opens {date}",

  /** The quiet note on the demo envelope that it was prepared later. */
  envelopeDemoNote: "Prepared later as a demo.",

  // --- Seal break ---

  /** The instruction above the wax seal. */
  sealInstruction:
    "Press and hold the seal to break it, or use the button below.",

  /** The button that breaks the seal. */
  sealButton: "Break the seal",

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

  /** The Unit_Helper_Line for the euro-per-1,000-litres unit (spec 08 R7.8). */
  unitHelperEurPer1000L: "1,000 here means 1 euro per litre.",

  // --- Tilt and sound ---

  /** The control that asks for device-motion permission for the light tilt. */
  tiltEnable: "Let the light follow your phone",

  /** The note beside the tilt control: what the permission request is for. */
  tiltPermissionNote:
    "Your phone asks for permission to read its motion. Saying no keeps the light where it is.",

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
    /** The intact seal, before it is broken. */
    intact: "The seal is intact.",
    /** The recall step, before the letter is opened. */
    recall: "Tell us how you remember it.",
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

  // --- Close (spec 07 task 6, design.md "Close") ---
  /** The persona close's heading. */
  closeLine: "The space between the two is yours to read.",
  /** The Accent link to /demo/live, shown only while Demo_2_On is true. */
  closeLink: "Seal your own. It opens 30 seconds after you seal it.",
  /** The smaller note under the link. */
  closeNote:
    "That is the whole letter. Nothing has been added to what you remembered, what was written, or the record.",
  /** The link back to the same persona, for a fresh opening. */
  startOver: "Start over",
} as const;

export type CeremonyCopy = typeof CEREMONY_COPY;
