"use client";

import { LIVE_COPY } from "./copy";
import styles from "./live.module.css";
import type { SealState } from "./seal-machine";

/**
 * The live step line for the Seal_Page (R15.10). It is a `role="status"`
 * region whose text is the one matching line from LIVE_COPY, so a reader is
 * told, politely, which step is in flight. States with no step line (the
 * `write` start and every terminal state) render an empty region, so the live
 * region stays in the tree and its clearing is announced.
 */
export function stepLine(state: SealState): string {
  switch (state.tag) {
    case "creating":
      return LIVE_COPY.stepCreating;
    case "created":
      return LIVE_COPY.stepCreated;
    case "confirming":
      return LIVE_COPY.stepConfirming;
    case "preparing":
      return LIVE_COPY.stepPreparing;
    case "sealing":
      return LIVE_COPY.stepSealing;
    default:
      return "";
  }
}

export interface StepStatusProps {
  /** The current sealing state, from the seal reducer. */
  state: SealState;
}

export function StepStatus({ state }: StepStatusProps) {
  return (
    <p role="status" className={styles.status}>
      {stepLine(state)}
    </p>
  );
}
