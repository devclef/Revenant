// Feature: 20-easier-sealing-and-receipts, Part B (Simulated_Mode).
//
// The Seal_Step lines, chosen by one pure function (design.md section 4.3). With
// Simulated_Mode off, every line is the passkey-mode string, so the page reads
// the same words as before. With it on, each line is its Simulated_Mode
// replacement. No React here, so the table is plain data.

import { LIVE_COPY } from "../copy";
import { PRESS_COPY } from "../press/copy";

export type SealStepCopy = {
  sealParagraph: string;
  warning: string;
  stepCreating: string;
  stepCreated: string;
  stepConfirming: string;
  setting: string;
  stepOneHint: string;
  stepPasskeyMade: string;
  stepTwoHint: string;
  sealButtonCreate: string;
};

const PASSKEY: SealStepCopy = {
  sealParagraph: LIVE_COPY.sealParagraph,
  warning: LIVE_COPY.warning,
  stepCreating: LIVE_COPY.stepCreating,
  stepCreated: LIVE_COPY.stepCreated,
  stepConfirming: LIVE_COPY.stepConfirming,
  setting: PRESS_COPY.setting,
  stepOneHint: PRESS_COPY.stepOneHint,
  stepPasskeyMade: PRESS_COPY.stepPasskeyMade,
  stepTwoHint: PRESS_COPY.stepTwoHint,
  sealButtonCreate: PRESS_COPY.sealButtonCreate,
};

const SIMULATED: SealStepCopy = {
  sealParagraph: LIVE_COPY.sealParagraphSimulated,
  warning: LIVE_COPY.warningSimulated,
  stepCreating: LIVE_COPY.stepCreatingSimulated,
  stepCreated: LIVE_COPY.stepCreatedSimulated,
  stepConfirming: LIVE_COPY.stepConfirmingSimulated,
  setting: PRESS_COPY.settingSimulated,
  stepOneHint: PRESS_COPY.stepOneHintSimulated,
  stepPasskeyMade: PRESS_COPY.stepPasskeyMadeSimulated,
  stepTwoHint: PRESS_COPY.stepTwoHintSimulated,
  sealButtonCreate: PRESS_COPY.sealButtonCreateSimulated,
};

/** The Seal_Step lines for passkey mode, or for Simulated_Mode when `simulated` is true. */
export function sealStepCopy(simulated: boolean): SealStepCopy {
  return simulated ? SIMULATED : PASSKEY;
}
