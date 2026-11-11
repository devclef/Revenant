// Feature: 09-demo-polish (spec 09 C5.1, C5.5)
//
// Whether the Ghost holds the Envelope on the persona page (design.md "The
// Envelope"). The held Envelope sits in the Ghost's slot through the pre-reveal
// Stages. In reveal stage 1 (`marks` and `seal`) it is held only at the
// Desktop_Sizes and the Wide_Size, which is the R14.1 breakpoint (900 CSS px).
// At the Phone_Sizes the Compact_Ghost (task 14) carries the Envelope instead,
// and the Ghost stays out of the top-right of the recall card. The touch rules
// for the seal at phones are unchanged (task 17, C5.5).

import { isWideLayout } from "@/components/ceremony/scene/layout";
import type { FlowState } from "./opening-machine";

/** The tags in which the held Envelope is always shown. */
const HELD_TAGS: ReadonlySet<FlowState["tag"]> = new Set<FlowState["tag"]>([
  "loading",
  "openable",
  "verifying",
  "awaiting_key",
  "unlocking",
  "sealed",
  "recall",
  "submitting",
  "submit_failed",
]);

/**
 * The tags of the recall card. TestifyContext states the persona's written-as-of
 * and opens dates there, so the held Envelope must not repeat them (spec 11 P3.1).
 */
const RECALL_CARD_TAGS: ReadonlySet<FlowState["tag"]> = new Set<
  FlowState["tag"]
>(["recall", "submitting", "submit_failed"]);

/**
 * Whether the held Envelope shows its two date lines. False on the recall card
 * tags, true on every other tag.
 */
export function showsHeldDates(tag: FlowState["tag"]): boolean {
  return !RECALL_CARD_TAGS.has(tag);
}

export type HeldEnvelopeInput = {
  tag: FlowState["tag"];
  /** The reveal stage, or null outside the reveal. */
  stage: number | null;
  /** The viewport width in CSS px, or null before the client has read it. */
  viewportWidth: number | null;
};

/**
 * True when the Ghost should hold the Envelope. Reveal stage 1 holds it only
 * when the viewport is at or above the 900 px breakpoint. An unknown width
 * (null, before mount) does not hold it, so the first render matches the
 * server and the seal stays in the Content_Column until the width is known.
 */
export function holdsEnvelope({
  tag,
  stage,
  viewportWidth,
}: HeldEnvelopeInput): boolean {
  if (HELD_TAGS.has(tag)) return true;
  if (tag === "reveal" && stage === 1) {
    return viewportWidth !== null && isWideLayout(viewportWidth);
  }
  return false;
}
