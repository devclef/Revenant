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
  holdToSeal: "Press and hold the wax to seal it.",
  /** The Press_Status_Line once a choice is made, with reduced or calm motion (S6.7). */
  pressToSeal: "Press the wax to seal it.",
  /**
   * The one plain line while the press is blocked after a Backup_Choice is made
   * (P1.5). It points at the fields, so the status line is never empty.
   */
  fixFields: "Fix the fields marked above, then press the wax.",
  /** The one plain line of the Setting_State (P5.5). No "Confirm your passkey". */
  setting: "Your device will ask once more to set the seal. Press the wax.",
  /** The two presses listed under the wax (spec 15, task 9; screens 9 to 15). */
  stepOne: "Make your passkey",
  stepTwo: "Set the seal",
  stepOneHint: 'Press the wax. The passkey is saved as "Revenant demo".',
  stepPasskeyMade: 'Passkey made. Saved as "Revenant demo".',
  stepTwoHint: "Your device will ask once more to set the seal. Press the wax.",
} as const;
