// Feature: 20-easier-sealing-and-receipts (Part C).
//
// The visible label of the Seal_Button, chosen by Seal_State. The label keys are
// separate from the press list (PRESS_COPY.stepOne and stepTwo) so the two can
// change apart later. Simulated_Mode labels come in a later task, so the
// `simulated` argument is accepted now and not read yet.

import { PRESS_COPY } from "../press/copy";
import type { PressStatusTag } from "./press-status";

export function sealButtonLabel(
  tag: PressStatusTag,
  simulated?: boolean,
): string {
  void simulated;
  switch (tag) {
    case "write":
    case "creating":
      return PRESS_COPY.sealButtonCreate;
    case "created":
    case "confirming":
    case "preparing":
    case "sealing":
      return PRESS_COPY.sealButtonSet;
  }
}
