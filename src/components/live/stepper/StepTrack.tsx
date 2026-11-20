import styles from "./step-track.module.css";
import { stepTrackStates } from "./step-track";

export interface StepTrackProps {
  /** The step names, in order. The caller holds the copy. */
  steps: readonly string[];
  /** The zero-based index of the current step, or null when no step is current. */
  current: number | null;
  /** The accessible name of the list. */
  label: string;
  /**
   * The phone line, with `{n}` (the step number, counted from 1), `{total}`
   * (the step count) and `{label}` (the current step name). Read from the
   * caller's copy file.
   */
  phoneTemplate: string;
}

/**
 * The one Step_Track (spec 15, requirement 5.2): one dot per step, joined by
 * hairlines. It draws the six-step track of /demo/live and the three- or
 * four-step track of persona pages. The current dot is orange, the one "you"
 * colour. Each step's state is in `data-state`. Below 600 px the labels hide
 * and a phone line shows the step number and name instead. The phone line is
 * aria-hidden, and the track adds no live region: the caller's own status
 * announces the step.
 */
export function StepTrack({
  steps,
  current,
  label,
  phoneTemplate,
}: StepTrackProps) {
  const states =
    current === null
      ? steps.map(() => "todo" as const)
      : stepTrackStates(current, steps.length);
  const currentName = current === null ? "" : (steps[current] ?? "");
  const phone =
    current === null
      ? null
      : phoneTemplate
          .replace("{n}", String(current + 1))
          .replace("{total}", String(steps.length))
          .replace("{label}", currentName);

  return (
    <div className={styles.track} data-step-indicator data-step-track>
      <ol className={styles.steps} aria-label={label}>
        {steps.map((name, position) => {
          const state = states[position];
          return (
            <li
              key={`${position}-${name}`}
              className={styles.step}
              data-state={state}
              aria-current={state === "current" ? "step" : undefined}
            >
              <span className={styles.dot} aria-hidden="true" />
              <span className={styles.label}>{name}</span>
            </li>
          );
        })}
      </ol>
      {phone === null ? null : (
        <p className={styles.phone} aria-hidden="true">
          {phone}
        </p>
      )}
    </div>
  );
}
