/**
 * The Step_Track states (spec 14, S1). Pure module: no React and no import
 * from live-steps, so the states are tested in Node and live-steps can
 * re-export them without a cycle.
 */

/** The number of steps on the Step_Track of /demo/live. */
export const STEP_TRACK_COUNT = 6;

/** The state of one dot on the Step_Track (spec 14, S1). */
export type StepTrackState = "done" | "current" | "future";

/**
 * The Step_Track state of every step, in order, for the step at `currentStep`
 * (counted from 0). Steps before it are done, the step itself is current, and
 * the steps after it are future. Exactly one entry is current.
 */
export function stepTrackStates(
  currentStep: number,
  stepCount: number = STEP_TRACK_COUNT,
): StepTrackState[] {
  return Array.from({ length: stepCount }, (_, position) => {
    if (position < currentStep) return "done";
    if (position === currentStep) return "current";
    return "future";
  });
}
