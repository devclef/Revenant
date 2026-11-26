// Feature: 20-easier-sealing-and-receipts (Part C, Part B for Simulated_Mode).
//
// The visible label of the Seal_Button, chosen by Seal_State. The label keys are
// separate from the press list (PRESS_COPY.stepOne and stepTwo) so the two can
// change apart later. In Simulated_Mode the write and creating states read the
// simulated label from sealStepCopy (Requirement 11.7).

import { PRESS_COPY } from "../press/copy";
import type { PressStatusTag } from "./press-status";
import { sealStepCopy } from "./simulated-copy";

export function sealButtonLabel(
  tag: PressStatusTag,
  simulated?: boolean,
): string {
  switch (tag) {
    case "write":
    case "creating":
      return sealStepCopy(simulated === true).sealButtonCreate;
    case "created":
    case "confirming":
    case "preparing":
    case "sealing":
      return PRESS_COPY.sealButtonSet;
  }
}
