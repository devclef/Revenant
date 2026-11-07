/**
 * User-facing strings for the Demo_Index page, its persona cards and the
 * shared "Demo" label. The demo pages hold no inline literals; every word a
 * reader sees comes from here (R15.1).
 *
 * Tone (tone.md): calm, second person, short sentences, the product
 * vocabulary of seal / letter / open / then / now. Neutrality (neutrality.md):
 * names no party, policy, candidate or judgement, and reads the same to any
 * reader.
 *
 * Hard constraints checked by copy.test.ts: no "!", no sentence over 25 words,
 * none of tone.md's clichés, and every empty-state string names an action.
 *
 * Plain readonly constants only. No JSX lives here.
 */
export const DEMO_COPY = {
  /** The small "Demo" badge shown before the heading on every demo page (R6.5). */
  demoLabel: "Demo",

  /** The Demo_Index page heading. */
  heading: "Demo letters",

  /**
   * The intro note under the heading (R6.4). It says the personas are
   * fictional, that their letters were prepared later as a demo, and that no
   * passkey is needed. Kept short so it is visible without scrolling on a
   * 360 by 640 viewport.
   */
  introNote:
    "These people are made up. Their letters were written as of a past date and prepared later as a demo. You need no passkey to open one.",

  /** Prefix for a persona's written date on a card. */
  writtenAsOfPrefix: "Written as of",

  /** Prefix for a persona's opening date on a card. */
  opensPrefix: "Opens",

  /**
   * The accessible name and the orange button text of a persona's envelope.
   * `{name}` is replaced with the persona's display name (for example
   * "Open Maya's letter").
   */
  openLetterFor: "Open {name}'s letter",

  /** Joins a date to the public event it is taken from. */
  eventSeparator: " · ",

  /**
   * Empty-state text when the Persona_List is empty (R6.8). It names an
   * action so the reader knows what to do next.
   */
  indexEmpty: "No demo letters are sealed yet. Come back later to open one.",

  /** Heading of the persona not-found page (no demo letter at that address). */
  notFoundTitle: "No letter here",

  /**
   * Body of the persona not-found page. It names an action so the reader
   * knows what to do next.
   */
  notFoundBody:
    "There is no demo letter at this address. Go back to the demo letters to choose one.",

  /** The link back to the demo letters index from the not-found page. */
  backToDemo: "Back to the demo letters",

  /** Heading of the live demo entry on the Demo_Index page (R12.1). */
  liveEntryHeading: "Seal your own letter",

  /**
   * Body of the live demo entry. It says the lock is 30 seconds because this is
   * a demo, and that the passkey is the reader's own.
   */
  liveEntryBody:
    "Write a short letter and seal it with your own passkey. The lock lasts 30 seconds, so you can open it here.",

  /** The link to the live demo Seal_Page. */
  liveEntryLink: "Go to the live demo",
} as const;

export type DemoCopy = typeof DEMO_COPY;
