// Feature: 13-the-seal
//
// Copy for the press control on the Seal step (spec 13, design section 2).
// Kept with the press feature so the seal, recall and reveal strings stay
// together for review. Plain, neutral, no exclamation marks (tone.md).

export const PRESS_COPY = {
  /** The accessible name of the one press control. */
  name: "Press the seal",
  /** The one plain line shown while the press is disabled (P1.5). */
  chooseFirst: "Choose a backup option first.",
  /** The Press_Status_Line once a choice is made, with full motion (S6.7). */
  holdToSeal: "Press and hold the wax, or use the button under it.",
  /** The Press_Status_Line once a choice is made, with reduced or calm motion (S6.7). */
  pressToSeal: "Press the wax, or use the button under it.",
  /**
   * The one plain line while the press is blocked after a Backup_Choice is made
   * (P1.5). It points at the fields, so the status line is never empty.
   */
  fixFields: "Fix the fields marked above. Then press the wax, or use the button under it.",
  /** The one plain line of the Setting_State (P5.5). No "Confirm your passkey". */
  setting:
    "Your device will ask once more to set the seal. Press the wax, or use the button under it.",
  /** The two presses listed under the wax (spec 15, task 9; screens 9 to 15). */
  stepOne: "Make your passkey",
  stepTwo: "Set the seal",
  /** The Seal_Button's label in the write and creating states (spec 20, Requirement 1.9). */
  sealButtonCreate: "Make your passkey",
  /** The Seal_Button's label in the created, confirming, preparing and sealing states. */
  sealButtonSet: "Set the seal",
  stepOneHint:
    'Press the wax, or use the button under it. The passkey is saved as "Revenant demo".',
  stepPasskeyMade: 'Passkey made. Saved as "Revenant demo".',
  stepTwoHint:
    "Your device will ask once more to set the seal. Press the wax, or use the button under it.",
  /** Simulated_Mode replacements for the press copy (spec 20, Part B, design 1.5 and 4.3). */
  settingSimulated: "The simulated passkey is ready. Press the wax, or use the button under it.",
  stepOneHintSimulated:
    "Press the wax, or use the button under it. The simulated passkey lives only in this tab.",
  stepPasskeyMadeSimulated: "Simulated passkey made. It lives only in this tab.",
  stepTwoHintSimulated:
    "The simulated passkey sets the seal in this tab. Press the wax, or use the button under it.",
  /** The Seal_Button's label in Simulated_Mode in the write and creating states (Requirement 11.7). */
  sealButtonCreateSimulated: "Make the simulated passkey",
} as const;
