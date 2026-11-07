"use client";

import { LIVE_COPY } from "../copy";

import styles from "./stepper.module.css";
import { LIVE_STEPS, stepIndex, stepName, type LiveStep } from "./live-steps";

export interface StepIndicatorProps {
  /** The step the visitor is on. */
  current: LiveStep;
}

/**
 * The ordered list of the six steps (spec 09 D2.1). The current step carries
 * `aria-current="step"`. Each step's state is in `data-state`, so the layout
 * check can tell them apart; nothing is coded by colour.
 */
export function StepIndicator({ current }: StepIndicatorProps) {
  const currentIndex = stepIndex(current);
  const total = LIVE_STEPS.length;
  const announce = LIVE_COPY.stepAnnounce
    .replace("{n}", String(currentIndex + 1))
    .replace("{total}", String(total))
    .replace("{label}", stepName(current));

  return (
    <div className={styles.indicator} data-step-indicator>
      <ol className={styles.steps} aria-label={LIVE_COPY.stepsLabel}>
        {LIVE_STEPS.map((step, index) => {
          const state =
            index < currentIndex
              ? "done"
              : index === currentIndex
                ? "current"
                : "todo";
          return (
            <li
              key={step}
              className={styles.step}
              data-state={state}
              aria-current={state === "current" ? "step" : undefined}
            >
              <span className={styles.number} aria-hidden="true">
                {index + 1}
              </span>
              <span className={styles.name}>{stepName(step)}</span>
            </li>
          );
        })}
      </ol>
      <p className={styles.announce} role="status" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
