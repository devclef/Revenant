// Feature: 07-judge-journey
//
// The current Stage, handed down by CeremonyRoot so the scene (the Ghost and
// the backdrop) can read the pose without new props. The default is `emerging`,
// the risen pose, so a scene rendered on its own is in its rest pose.
//
// StageReportContext runs the other way. The Top_Bar sits above the Ceremony
// region (SceneShell renders it first), so the region reports its Stage up
// through this context and SceneShell holds it for the Top_Bar. Null means no
// Top_Bar listens, for example on a live page, and the report does nothing.

import { createContext, useContext } from "react";

import type { Stage } from "./stages";

export const StageContext = createContext<Stage>("emerging");

export function useStage(): Stage {
  return useContext(StageContext);
}

/** The callback a Stage is reported through, or null when nothing listens. */
export const StageReportContext = createContext<
  ((stage: Stage) => void) | null
>(null);

export function useStageReport(): ((stage: Stage) => void) | null {
  return useContext(StageReportContext);
}
