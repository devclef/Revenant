// Feature: 07-judge-journey
//
// User-facing strings for the Scene: the headline, the Top_Bar, the persona
// notice and the landing copy that task 7 imports into `src/app/page.tsx`.
// The landing strings are copied verbatim from design.md "Copy" (spec 08).
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
    /** The four paragraphs of the landing page, in order (design.md "Copy"). */
    paragraphs: [
      "Revenant seals a letter to your future self. It opens on a date you choose, and you testify before you read it.",
      "You write what is on your mind, and you choose figures to seal with it: weekly fuel prices for the United States and the European Union, each from an official source, kept with its date and where it came from.",
      "You pick a date to open it. Then you seal the letter. Once sealed, it cannot be changed, not even by you, and no one else can read it.",
      "When that date arrives, the letter opens. First it asks how you remember things. Then it shows what you wrote, and the numbers then beside the numbers now. The space between the two is yours to read.",
    ] as const,

    /** The link text that leads to the demo letters. */
    demoLink: "Open the demo letters",

    /** The link text when the demo has one persona letter. */
    demoLinkOne: "Open the demo letter",

    /** The link text when the demo has two or more persona letters. */
    demoLinkMany: "Open the demo letters",

    /** The link to the live demo, where a judge seals a letter with a passkey. */
    liveLink: "Seal your own letter",

    /** The note under the live demo link, shown while real sealing is off. */
    liveNote: "It opens 30 seconds after you seal it.",

    /** The link to real sealing, shown while real sealing is on. */
    realLink: "Seal a letter to your future self",

    /** The link to the How_Page. */
    howLink: "How a letter is sealed",

    /** The link to the source code. */
    sourceLink: "Source code on GitHub",
  },
} as const;

export type SceneCopy = typeof SCENE_COPY;
