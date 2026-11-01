/**
 * User-facing strings for the reveal Ceremony: the motion and sound controls,
 * the skip control, the envelope stage, the seal break, the recall scale, the
 * passage between then and now, the close stage, the tilt prompt, and one short
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

  /** The control that returns the scale to its full width. */
  recallWholeScale: "Show the whole scale",

  /** Shown on the scale before the reader has given an answer. */
  recallNoMarkYet: "No answer yet",

  // --- Passage and figures ---

  /** Live: time passes between the then and now figures. */
  passageLive: "Time passes between then and now.",

  /** Live: the figures have settled into place. */
  figuresLive: "The figures are in place.",

  // --- Close stage ---

  /** Heading for the closing stage. */
  closeTitle: "That is the whole letter",

  /** Body for the closing stage. */
  closeBody:
    "Nothing has been added to what you remembered, what was written, or the record.",

  /** The control that returns to the desk. */
  closeBack: "Back to the desk",

  // --- Tilt and sound ---

  /** The control that asks for device-motion permission for the light tilt. */
  tiltEnable: "Let the light follow your phone",

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

  // --- Live region, one short line per Stage ---

  /**
   * One short line announced by the polite live region for each Stage, so a
   * screen-reader reader hears where the Ceremony is without any motion.
   */
  stageLive: {
    /** The desk, before anything is picked up. */
    desk: "The desk is in front of you.",
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
    /** The then figures. */
    then: "The figures from then are shown.",
    /** The passage of time between then and now. */
    passage: "Time passes between then and now.",
    /** The now figures. */
    now: "The figures from now are shown.",
    /** The closing stage. */
    close: "That is the whole letter.",
    /** An error state. */
    error: "Something went wrong. You can try again.",
  },
} as const;

export type CeremonyCopy = typeof CEREMONY_COPY;
