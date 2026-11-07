// Phone sizing rules for the live demo (spec 09 P9). Pure module: no imports,
// no DOM, so the rules can be unit tested in the node environment.

import { LETTER_FIELD_MAX_VH } from "./constants";

/**
 * The tallest the letter textarea may grow, in CSS pixels, for a visual
 * viewport of the given height. Half the visual viewport at the default
 * LETTER_FIELD_MAX_VH, so the keyboard never covers the whole field.
 */
export function letterFieldMaxPx(visualViewportHeight: number): number {
  return Math.floor((visualViewportHeight * LETTER_FIELD_MAX_VH) / 100);
}

/**
 * The height the letter textarea should take: its content height, capped at
 * the maximum for the visual viewport. Never below zero.
 */
export function letterFieldHeightPx(
  contentHeightPx: number,
  visualViewportHeight: number,
): number {
  const content = Math.max(0, contentHeightPx);
  return Math.min(content, letterFieldMaxPx(visualViewportHeight));
}
