// Feature: 09-demo-polish, C2.2 (Step_Indicator)
//
// Maps a persona-page Stage to the Step_Indicator step that is current. The
// four steps are Testify (0), Break the seal (1), Read (2) and See the
// receipts (3), in the order CEREMONY_COPY.steps gives them.
//
// Pure: no React, no DOM. CeremonyRoot and the Step_Indicator use it.

import { CEREMONY_COPY } from "./copy";
import { PERSONA_STEPS } from "./constants";
import type { Stage } from "./stages";

export type PersonaStep = 0 | 1 | 2 | 3;

/**
 * The current Step_Indicator step for a Stage, or null when no step is current.
 *
 * - `intact` and the Stages before it: null (no step is current yet).
 * - `recall`: 0, Testify.
 * - `marks` and `seal`: 1, Break the seal.
 * - `letter`: 2, Read.
 * - `figures` and `close`: 3, See the receipts.
 * - `emerging`, `sealed`, `envelope` and `error`: null.
 */
export function personaStepFor(stage: Stage): PersonaStep | null {
  switch (stage) {
    case "recall":
      return 0;
    case "marks":
    case "seal":
      return 1;
    case "letter":
      return 2;
    case "figures":
    case "close":
      return 3;
    default:
      return null;
  }
}

/**
 * The polite live-region line for a Step_Indicator step, from
 * `CEREMONY_COPY.stepAnnounce` (`Step {n} of {total}: {label}`). `n` counts
 * from 1. Pure, so the announcement is testable without a DOM.
 */
export function stepAnnouncement(step: PersonaStep): string {
  return CEREMONY_COPY.stepAnnounce
    .replace("{n}", String(step + 1))
    .replace("{total}", String(PERSONA_STEPS))
    .replace("{label}", CEREMONY_COPY.steps[step]);
}
