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
 * - `recall`: 0, Testify.
 * - `marks` and `seal`: 1, Break the seal.
 * - `letter`: 2, Read.
 * - `figures`: 3, See the receipts.
 * - `close`: 3, See the receipts, or 2, Read, when the letter has no figures
 *   (spec 10 L5.3). A text-only letter has no figures Stage.
 * - `emerging`, `sealed`, `envelope` and `error`: null.
 *
 * `hasFigures` defaults to true, so callers that do not know the letter's shape
 * keep the four-step behaviour.
 */
export function personaStepFor(stage: Stage, hasFigures = true): PersonaStep | null {
  switch (stage) {
    case "recall":
      return 0;
    case "marks":
    case "seal":
      return 1;
    case "letter":
      return 2;
    case "figures":
      return 3;
    case "close":
      return hasFigures ? 3 : 2;
    default:
      return null;
  }
}

/**
 * The Step_Indicator names for a letter. A letter with figures shows all four
 * steps. A text-only letter shows exactly Testify, Break the seal and Read
 * (spec 10 L5.3).
 */
export function personaStepLabels(hasFigures: boolean): readonly string[] {
  return hasFigures ? CEREMONY_COPY.steps : CEREMONY_COPY.steps.slice(0, 3);
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
