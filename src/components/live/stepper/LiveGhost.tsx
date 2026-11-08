"use client";

// The Ghost on the live demo's wait card (spec 09, D1.2 and D1.3). The live
// page is not a persona page, so this wrapper supplies the motion, Skip and
// local-view providers that PersonaGhost reads. Under SceneShell those
// providers already exist, and each one defers to its parent, so the page keeps
// one Calm control and one Skip registry.
//
// The Ghost sits in the Scene's Ghost layer (scene.module.css), above the
// stepper card and below the Top_Bar. It passes pointer events through.

import type { GhostSink } from "@/components/ceremony/scene/Ghost";
import { PersonaGhost } from "@/components/ceremony/scene/PersonaGhost";
import sceneStyles from "@/components/ceremony/scene/scene.module.css";
import { LocalViewProvider } from "@/components/ceremony/local-view";
import { MotionProvider } from "@/components/ceremony/motion";
import { SkipProvider } from "@/components/ceremony/skip";

export interface LiveGhostProps {
  /**
   * The sink state (spec 09 D1). `sinking` plays the sink on a stored seal,
   * `sunk` holds the settled pose (Calm and reduced motion), and `idle` rises
   * the Ghost again, the Emergence on unlock in place.
   */
  sink: GhostSink;
}

/** The Ghost for the live demo's wait card, in the Scene's Ghost layer. */
export function LiveGhost({ sink }: LiveGhostProps) {
  return (
    <MotionProvider>
      <SkipProvider>
        <LocalViewProvider>
          <div className={sceneStyles.ghostLayer} aria-hidden="true" data-live-ghost-layer>
            <PersonaGhost sink={sink} compact />
          </div>
        </LocalViewProvider>
      </SkipProvider>
    </MotionProvider>
  );
}
