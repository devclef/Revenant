// Feature: 07-judge-journey
//
// The current Stage, handed down by CeremonyRoot so the scene (the Ghost and
// the backdrop) can read the pose without new props. The default is `emerging`,
// the risen pose, so a scene rendered on its own is in its rest pose.

import { createContext, useContext } from "react";

import type { Stage } from "./stages";

export const StageContext = createContext<Stage>("emerging");

export function useStage(): Stage {
  return useContext(StageContext);
}
