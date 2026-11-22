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
   * What a wax seal showed, in one sentence (16.15.1). Names no number or date,
   * so it links to no source.
   */
  resurrectedBody: [
    "For centuries, a wax seal showed that a letter was written then and nobody had opened it since.",
  ],

  /**
   * What no wax seal could do, in two sentences (16.15.1). Read under the
   * "What we resurrected" heading, with no separate heading of its own.
   */
  noSealBody:
    "No wax seal could make you remember first. Revenant asks before you read, and never says what the gap means.",

  /** The maker's story heading, shown under the short section (16.15.4). */
  makerTitle: "Why I built it",

  /**
   * The maker's story in the first person, at most two sentences (16.15.4).
   * The "fifteen years" is the maker's own recollection, not a sourced figure.
   */
  makerBody:
    "My English teacher had us write letters to ourselves, then mailed them back fifteen years later. What I read wasn't what I remembered.",

  /** The ritual steps from Brand_Copy, in README order (B3.2). */
  ritualSteps: BRAND_COPY.ritualSteps,

  /** The heading above the Coven_Strip (B3.5). */
  covenTitle: "Built by a coven of Kiro agents",

  /** The two Coven_Strip links to GitHub (B3.5). */
  covenKiroLink: "Browse the .kiro folder on GitHub",
  covenLoopLink: "Read how the agent loop works",
} as const;
