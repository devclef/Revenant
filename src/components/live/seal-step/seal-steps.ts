// Feature: 15-the-flow (spec 15, task 9; prototype screens 9 to 15).
//
// The two presses shown under the wax on the Press the seal step, as plain
// data. Each press is `pending`, `current` or `done`. Only the reader's own
// next press is `current`, and only `current` carries its hint line.

import { PRESS_COPY } from "../press/copy";
import type { BackupChoiceValue } from "../write-draft";
import type { PressStatusTag } from "./press-status";

export type SealStepState = "pending" | "current" | "done";

export type SealStepsView = {
  one: { state: SealStepState; hint: string | null };
  two: { state: SealStepState; hint: string | null };
};

/**
 * The state of each press for a seal state. Before a backup choice nothing is
 * current. After it, the first press is the next action. Once the passkey is
 * made the second press is the next action, and while the letter is prepared
 * or sealed the second press stays current with no hint of its own.
 */
export function sealStepsView(input: {
  tag: PressStatusTag;
  backupChoice: BackupChoiceValue | null;
}): SealStepsView {
  const { tag, backupChoice } = input;
  if (tag === "write" && backupChoice === null) {
    return {
      one: { state: "pending", hint: null },
      two: { state: "pending", hint: null },
    };
  }
  if (tag === "write" || tag === "creating") {
    return {
      one: { state: "current", hint: PRESS_COPY.stepOneHint },
      two: { state: "pending", hint: null },
    };
  }
  if (tag === "created") {
    return {
      one: { state: "done", hint: PRESS_COPY.stepPasskeyMade },
      two: { state: "current", hint: PRESS_COPY.stepTwoHint },
    };
  }
  // confirming, preparing, sealing: the first press is done.
  return {
    one: { state: "done", hint: PRESS_COPY.stepPasskeyMade },
    two: {
      state: "current",
      hint: tag === "confirming" ? PRESS_COPY.stepTwoHint : null,
    },
  };
}
