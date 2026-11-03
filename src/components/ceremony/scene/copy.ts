// Feature: 07-judge-journey
//
// User-facing strings for the Scene: the headline, the Top_Bar, the persona
// notice and the landing copy that task 7 imports into `src/app/page.tsx`.
// The landing strings are copied verbatim from that page (JSX line breaks
// collapsed to single spaces, which is how the browser renders them).
//
// Tone (tone.md) and neutrality (neutrality.md) apply. Scene_Copy_Modules are
// checked for scoring words by scene/copy.test.ts (R24.6, R24.7).
//
// Plain readonly constants only. No JSX lives here.

import { REVEAL_COPY } from "@/components/reveal/copy";

export const SCENE_COPY = {
  /**
   * The one emerging status (spec 07 task 2). The envelope's visible statement
   * and the Stage's role=status line both use these strings. They are the same
   * sentences as REVEAL_COPY, referenced here so the scene copy is the source.
   */
  emergingStatus: {
    /** While the letter is fetched and verified. */
    loading: REVEAL_COPY.loading,
    /** While the seal is checked (openable and verifying). */
    verifying: REVEAL_COPY.verifying,
  },

  /** The first part of the headline. The Accent word follows it. */
  headlineLead: "Your past self returns with the",

  /** The Accent word of the headline, set in the Accent colour. */
  headlineAccent: "receipts.",

  /** The control that opens a persona letter. `{name}` is the persona's first name. */
  openLetter: "Open {name}'s letter",

  /** The wordmark in the Top_Bar, shown in capitals by CSS. */
  wordmark: "revenant",

  /** The chip beside the wordmark that marks the demo, shown in capitals by CSS. */
  demoChip: "Demo",

  /** The notice on the persona page. `{name}` is the persona's name. */
  personaNotice:
    "{name} is fictional. This letter was prepared later as a demo.",

  landing: {
    /** The three paragraphs of the landing page, in order. */
    paragraphs: [
      "Revenant is a sealed letter to your future self. You write what is on your mind today, and you choose the numbers that matter to you — the price of fuel, groceries, rent — each one a real figure from an official source, kept with its date and where it came from.",
      "You pick a date to open it. Then you seal the letter. Once sealed, it cannot be changed, not even by you, and no one else can read it.",
      "When that date arrives, the letter opens. First it asks how you remember things. Then it shows what you wrote, and the numbers then beside the numbers now. The space between the two is yours to read.",
    ] as const,

    /** The link text that leads to the demo letters. */
    demoLink: "Open the demo letters",
  },
} as const;

export type SceneCopy = typeof SCENE_COPY;
