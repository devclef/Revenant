// Feature: 15-the-flow (spec 15, task 9; prototype screens 9 to 15).
//
// The two presses shown under the wax on the Press the seal step, as plain
// data. Each press is `pending`, `current` or `done`. Only the reader's own
// next press is `current`, and only `current` carries its hint line.

import { REAL_COPY } from "../copy";
import type { BackupChoiceValue } from "../write-draft";
import type { PressStatusTag } from "./press-status";
import { sealStepCopy } from "./simulated-copy";

export type SealStepState = "pending" | "current" | "done";

export type SealStepsView = {
  one: { state: SealStepState; hint: string | null };
  two: { state: SealStepState; hint: string | null };
};

/**
 * The state of each press for a seal state. Before a backup choice nothing is
 * current. After it, the first press is the next action. Once the passkey is
 * made the second press is the next action. Press one's hint is `stepOneHint`
 * while it is pending or current, and `stepPasskeyMade` once it is done. Press
 * two's hint is `stepTwoHint` only in the confirming state, so it is null in
 * `created` and while the letter is prepared or sealed.
 */
export function sealStepsView(input: {
  tag: PressStatusTag;
  backupChoice: BackupChoiceValue | null;
  real?: boolean;
  /** Simulated_Mode hints (spec 20, Part B, Requirement 11.7). */
  simulated?: boolean;
}): SealStepsView {
  const { tag, backupChoice } = input;
  const copy = sealStepCopy(input.simulated === true);
  // Real_Mode swaps the two first-press hints for their REAL_COPY wording.
  const stepOneHint =
    input.real === true ? REAL_COPY.stepOneHint : copy.stepOneHint;
  const stepPasskeyMade =
    input.real === true ? REAL_COPY.stepPasskeyMade : copy.stepPasskeyMade;
  if (tag === "write" && backupChoice === null) {
    return {
      one: { state: "pending", hint: stepOneHint },
      two: { state: "pending", hint: null },
    };
  }
  if (tag === "write" || tag === "creating") {
    return {
      one: { state: "current", hint: stepOneHint },
      two: { state: "pending", hint: null },
    };
  }
  if (tag === "created") {
    return {
      one: { state: "done", hint: stepPasskeyMade },
      two: { state: "current", hint: null },
    };
  }
  // confirming, preparing, sealing: the first press is done.
  return {
    one: { state: "done", hint: stepPasskeyMade },
    two: {
      state: "current",
      hint: tag === "confirming" ? copy.stepTwoHint : null,
    },
  };
}
