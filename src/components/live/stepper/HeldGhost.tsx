// The Ghost held behind the sealed Envelope on the live Wait card (spec 09 D1,
// and the Wait layout). It sits in the page flow, inside the Envelope's light
// box, under the Envelope. It is clipped to that box, so it never reaches the
// countdown lines or the Keep_Section below.
//
// The Ghost sinks while the countdown runs and rises from behind the view at
// zero (the sink state goes idle, which plays the CSS rise). Calm_Mode and
// reduced motion show it settled, with no rise. The glow is static. The shake
// and the Idle_Bob are off for this Ghost, so the sink is the only motion.
//
// The drawing is the Scene's Ghost. Its layout overrides live in
// live.module.css under .heldGhost, keyed on the data-held-pit attribute.

import { GHOST_SIZE_COMPACT } from "@/components/ceremony/constants";
import { Ghost, type GhostSink } from "@/components/ceremony/scene/Ghost";

import styles from "../live.module.css";

/**
 * The sink state for the held Ghost. At zero the Ghost is idle and rises. Before
 * zero it sinks, or holds the settled sunk pose under Calm_Mode.
 */
export function heldGhostSink(done: boolean, calm: boolean): GhostSink {
  if (done) return "idle";
  return calm ? "sunk" : "sinking";
}

export interface HeldGhostProps {
  /** The sink state, from heldGhostSink. */
  sink: GhostSink;
}

/** The held Ghost, in the envelope's light box. Decorative and pass-through. */
export function HeldGhost({ sink }: HeldGhostProps) {
  return (
    <div className={styles.heldGhost} data-held-ghost aria-hidden="true">
      <Ghost
        size={GHOST_SIZE_COMPACT}
        sink={sink}
        gradientId="held-ghost-body"
        rootAttributes={{ "data-held-pit": "" }}
      />
    </div>
  );
}
