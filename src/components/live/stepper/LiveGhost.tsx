"use client";

// The Ghost on the live demo's Wait card (spec 09 D1.2 and D1.3). It is now the
// held Ghost behind the sealed Envelope (HeldGhost), in the page flow. The fixed
// Ghost layer it replaced is gone, so this component no longer needs the motion,
// Skip or local-view providers.
//
// The sink state is passed in by LiveWaitStep, which reads Calm_Mode.

import type { GhostSink } from "@/components/ceremony/scene/Ghost";

import { HeldGhost } from "./HeldGhost";

export interface LiveGhostProps {
  /**
   * The sink state (spec 09 D1). `sinking` plays the sink on a stored seal,
   * `sunk` holds the settled pose (Calm and reduced motion), and `idle` rises
   * the Ghost again, the Emergence on unlock in place.
   */
  sink: GhostSink;
}

/** The Ghost for the live demo's Wait card, held behind the Envelope. */
export function LiveGhost({ sink }: LiveGhostProps) {
  return <HeldGhost sink={sink} />;
}
