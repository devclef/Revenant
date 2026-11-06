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
