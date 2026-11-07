// Feature: 09-demo-polish (landing hero, B1 and B2)
//
// User-facing strings for the landing hero's calls to action. Copied from
// design.md "Copy" (landing/copy.ts rows). The hero's own eyebrow, tagline and
// sentence come from Brand_Copy, not from this module.
//
// `primaryCost` takes `{minutes}`. The hero does not render it yet: the
// minutes come from FLOW_MINUTES, which is blocked until the owner's B1.7
// timings are in issue #255's body (see constants.ts).
//
// Tone (tone.md) and neutrality (neutrality.md) apply. Plain readonly
// constants only. No JSX lives here.

import { BRAND_COPY } from "@/components/brand/copy";

export const LANDING_COPY = {
  /** The primary call to action with one persona letter. */
  primaryCtaOne: "Open the demo letter",

  /** The primary call to action with two or more persona letters. */
  primaryCtaMany: "Open the demo letters",

  /** The line under the primary call to action. `{minutes}` is FLOW_MINUTES. */
  primaryCost: "About {minutes} minutes · no sign-up, no passkey",

  /** The outlined call to action to the live demo, shown while Demo_2_On. */
  secondaryCta: "Seal your own. It opens 30 seconds after you seal it.",
} as const;

export type LandingCopy = typeof LANDING_COPY;

/**
 * Copy for the below-the-fold landing sections (B3, F6). The ritual steps and
 * the seal mapping rows are not defined here: they come from the Brand_Copy
 * module, the one place that holds them (F2.1, F2.2).
 *
 * Historical claims: the pli cacheté paragraph names no date or number, so it
 * needs no source link (B3.3). The README gives 1735 and a deposit count;
 * neither is used until an Académie des sciences page is checked to state it.
 */
export const LANDING_SECTION_COPY = {
  /** The heading above the five ritual cards (B3.2). */
  ritualTitle: "The ritual",

  /** The heading above the pli cacheté story and the seal mapping table (F6.1). */
  resurrectedTitle: "What we resurrected",

  /**
   * The pli cacheté story, at most four sentences, with the classroom time
   * capsule only as an example (F6.1). Paraphrases the README's "What we
   * resurrected".
   */
  resurrectedBody: [
    "The French Académie des sciences has kept plis cachetés for centuries: sealed envelopes that people deposit to prove what they knew, and when.",
    "A classroom time capsule works the same way: a letter to your future self, sealed and mailed back years later.",
    "The seal carries the meaning: this was written then, by you, and nobody has touched it since.",
    "Revenant is that envelope rebuilt for the browser, with each part of the old seal given a modern replacement.",
  ],

  /** The heading of the section on what no wax seal could do (F6.2). */
  noSealTitle: "What no wax seal could do",

  /** At most three sentences, with none of the F1.3 banned words (F6.2, F6.3). */
  noSealBody:
    "A seal proves the letter wasn't changed. It can't stop your memory changing. So before you read, you testify, and Revenant never says what the gap means.",

  /** The ritual steps from Brand_Copy, in README order (B3.2). */
  ritualSteps: BRAND_COPY.ritualSteps,

  /** The four seal mapping rows from Brand_Copy (F6.1). */
  sealMapping: BRAND_COPY.sealMapping,

  /** The heading above the Sample_Receipt (B3.4). */
  receiptTitle: "A receipt from the record",

  /** Shown when the request fails or the first series has no figure (B3.4). */
  receiptNone: "No figure is available to show right now.",

  /** Labels for the provenance rows under the Sample_Receipt figure. */
  receiptSource: "Source",
  receiptSeries: "Series",
  receiptRetrieved: "Retrieved",

  /** The link to the publisher's page for the Sample_Receipt figure. */
  receiptCheck: "Check the figure at its source",

  /** The heading above the Coven_Strip (B3.5). `{n}` is the count. */
  covenTitle: "Built by a coven of Kiro agents",

  /** The Coven_Strip count labels, singular and plural (B3.5). */
  covenCounts: {
    specs: { one: "{n} spec", other: "{n} specs" },
    steering: { one: "{n} steering doc", other: "{n} steering docs" },
    agents: { one: "{n} custom agent", other: "{n} custom agents" },
    hooks: { one: "{n} hook", other: "{n} hooks" },
  },

  /** The two Coven_Strip links to GitHub (B3.5). */
  covenKiroLink: "Browse the .kiro folder on GitHub",
  covenLoopLink: "Read how the agent loop works",
} as const;
