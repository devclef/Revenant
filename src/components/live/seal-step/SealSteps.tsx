"use client";

// Feature: 15-the-flow (spec 15, task 9; prototype screens 9 to 15).
//
// The two presses listed under the wax: "Make your passkey" and "Set the seal".
// The done press shows a check mark and its line. The current press shows its
// number in orange, the reader's own next action. Pending presses are muted.

import { LIVE_COPY } from "../copy";
import type { BackupChoiceValue } from "../write-draft";
import type { PressStatusTag } from "./press-status";
import { sealStepsView, type SealStepState } from "./seal-steps";
import styles from "./seal-step.module.css";

export type SealStepsProps = {
  tag: PressStatusTag;
  backupChoice: BackupChoiceValue | null;
};

function StepItem({
  number,
  label,
  state,
  hint,
}: {
  number: number;
  label: string;
  state: SealStepState;
  hint: string | null;
}) {
  return (
    <li className={styles.stepItem} data-seal-step-state={state}>
      <span className={styles.stepDisc} aria-hidden="true">
        {state === "done" ? "✓" : number}
      </span>
      <span className={styles.stepText}>
        <span className={styles.stepLabel}>{label}</span>
        {hint !== null ? <span className={styles.stepHint}>{hint}</span> : null}
      </span>
    </li>
  );
}

export function SealSteps({ tag, backupChoice }: SealStepsProps) {
  const view = sealStepsView({ tag, backupChoice });
  return (
    <ol className={styles.steps} data-seal-steps="">
      <StepItem
        number={1}
        label={LIVE_COPY.sealStepOne}
        state={view.one.state}
        hint={view.one.hint}
      />
      <StepItem
        number={2}
        label={LIVE_COPY.sealStepTwo}
        state={view.two.state}
        hint={view.two.hint}
      />
    </ol>
  );
}
