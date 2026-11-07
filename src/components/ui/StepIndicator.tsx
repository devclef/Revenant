// Feature: 09-demo-polish, C2.1 to C2.5 (Step_Indicator)
//
// The ordered list of steps that shows the reader where they are on the persona
// page. The current step carries `aria-current="step"`; the others carry none.
// The names come in as props, so this component holds no copy (the caller reads
// them from CEREMONY_COPY). It uses no Accent colour: the current step is marked
// by weight and underline, in the text colour.
//
// Server-safe: no hooks, no browser APIs.

import styles from "./StepIndicator.module.css";

export type StepIndicatorProps = {
  /** The step names, in order. */
  steps: readonly string[];
  /** The zero-based index of the current step, or null when no step is current. */
  current: number | null;
  /** The accessible name of the list. */
  label: string;
};

export function StepIndicator({ steps, current, label }: StepIndicatorProps) {
  return (
    <ol className={styles.steps} aria-label={label} data-step-indicator>
      {steps.map((name, index) => {
        const isCurrent = index === current;
        return (
          <li
            key={name}
            className={isCurrent ? styles.current : styles.step}
            aria-current={isCurrent ? "step" : undefined}
          >
            {name}
          </li>
        );
      })}
    </ol>
  );
}
