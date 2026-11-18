import { LIVE_COPY } from "../copy";

import styles from "./step-track.module.css";
import {
  LIVE_STEPS,
  LIVE_STEP_NAMES,
  stepIndex,
  stepTrackStates,
  type LiveStep,
} from "./live-steps";

export interface StepTrackProps {
  /** The step the visitor is on. */
  current: LiveStep;
}

/**
 * The Step_Track (spec 14, S1): six dots joined by hairlines, one per step of
 * /demo/live. The current dot is orange, the one "you" colour. Each step's
 * state is in `data-state`. Below 600 px the labels hide and a phone line
 * shows the step number and name instead. The phone line is aria-hidden, and
 * the track adds no live region: the stepper's own status announces the step.
 */
export function StepTrack({ current }: StepTrackProps) {
  const index = stepIndex(current);
  const states = stepTrackStates(index);
  const phone = LIVE_COPY.stepTrackPhone
    .replace("{n}", String(index + 1))
    .replace("{label}", LIVE_STEP_NAMES[index] ?? "");

  return (
    <div className={styles.track} data-step-indicator data-step-track>
      <ol className={styles.steps} aria-label={LIVE_COPY.stepsLabel}>
        {LIVE_STEPS.map((step, position) => {
          const state = states[position];
          return (
            <li
              key={step}
              className={styles.step}
              data-state={state}
              aria-current={state === "current" ? "step" : undefined}
            >
              <span className={styles.dot} aria-hidden="true" />
              <span className={styles.label}>{LIVE_STEP_NAMES[position]}</span>
            </li>
          );
        })}
      </ol>
      <p className={styles.phone} aria-hidden="true">
        {phone}
      </p>
    </div>
  );
}
