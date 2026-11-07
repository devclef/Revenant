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

  /** The wordmark in the Top_Bar, shown in capitals by CSS. */
  wordmark: "revenant",

  /** The chip beside the wordmark that marks the demo, shown in capitals by CSS. */
  demoChip: "Demo",

  /** The notice on the persona page. `{name}` is the persona's name. */
  personaNotice:
    "{name} is fictional. This letter was prepared later as a demo.",

  /** The persona page's headline (spec 09 F7). `{name}` is the persona's name. */
  personaHeading: "{name}'s letter",

  /** The `/demo` headline (spec 09 F7). */
  demoHeading: "The demo letters",

  landing: {
    /** The link text that leads to the demo letters. */
    demoLink: "Open the demo letters",
  },
} as const;

export type SceneCopy = typeof SCENE_COPY;
